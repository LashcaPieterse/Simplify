import { reconcileAdminOperations } from "../admin/financial";
import { orderDisposition } from "../orders/fulfillment-disposition";
import type { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import prisma from "../db/client";
import { claimJob, enqueueJob, finishJob, wakeJob, jobEligibleAt, type JobKind } from "./store";
import { processingContext, processingWait, withProcessingContext, type ProcessingTrigger } from "./execution";
import { finaliseOrderFromCheckout, verifyPaymentTransaction } from "../payments/checkouts";
import type { CreateOrderOptions } from "../orders/service";
import { recoverAiraloOrders } from "../orders/recovery";
import { ensureOrderInstallation } from "../orders/installation";
import { resolveDpoClient, type DpoClient } from "../payments/dpo";
import { queueOrderReceipt, wakeOrderReceipt, deliverReceipt, deliverReceipts } from "../notifications/receipt-outbox";
import { resolveReceiptDeliveryDetails } from "../notifications/receipts";

const kinds: JobKind[] = ["verify_payment", "fulfill_checkout", "reconcile_supplier", "complete_installation", "ack_payment"];
type LifecycleJobOptions = { dpoClient?: Pick<DpoClient, "verifyTransaction">; airaloOptions?: CreateOrderOptions; trigger?: ProcessingTrigger; correlationId?: string };
type ProcessingOptions = LifecycleJobOptions & { receiptOptions?: Parameters<typeof deliverReceipt>[2]; budgetMs?: number };
type Db = PrismaClient | Prisma.TransactionClient;

export async function seedLifecycleWork(db: PrismaClient, limit = 25) {
  // Select only missing business keys. Repeatedly selecting the oldest unresolved
  // rows would prevent bounded backfills from ever reaching the remaining rows.
  const payments = await db.$queryRaw<Array<{ id: string }>>`
    SELECT p.id FROM "PaymentTransaction" p WHERE p.provider='dpo'
    AND p.status IN ('creating','creation_unknown','pending','authorized','partially_paid','verification_error')
    AND NOT EXISTS (SELECT 1 FROM "LifecycleJob" j WHERE j."businessKey"='verify_payment:' || p.id)
    ORDER BY p."updatedAt", p.id LIMIT ${limit}`;
  for (const payment of payments) await enqueueJob(db, "verify_payment", payment.id);
  const checkouts = await db.$queryRaw<Array<{ id: string }>>`
    SELECT c.id FROM "CheckoutSession" c LEFT JOIN "EsimOrder" o ON o.id=c."orderId"
    WHERE EXISTS (SELECT 1 FROM "PaymentTransaction" p WHERE p."checkoutId"=c.id AND p.status='approved')
    AND (o.id IS NULL OR o.status <> 'completed')
    AND NOT EXISTS (SELECT 1 FROM "LifecycleJob" j WHERE j."businessKey"='fulfill_checkout:' || c.id)
    ORDER BY c."updatedAt", c.id LIMIT ${limit}`;
  for (const checkout of checkouts) await enqueueJob(db, "fulfill_checkout", checkout.id);
  const orders = await db.$queryRaw<Array<{ id: string }>>`
    SELECT o.id FROM "EsimOrder" o LEFT JOIN "CheckoutSession" c ON c."orderId"=o.id WHERE
    (o.status IN ('pending','airalo_submitting','airalo_outcome_unknown','airalo_failed')
      AND NOT EXISTS (SELECT 1 FROM "LifecycleJob" j WHERE j."businessKey"='reconcile_supplier:' || o.id))
    OR (o.status='completed' AND COALESCE(c.intent, 'purchase') <> 'top-up' AND (
      NOT EXISTS (SELECT 1 FROM "LifecycleJob" j WHERE j."businessKey"='complete_installation:' || o.id)
      OR NOT EXISTS (SELECT 1 FROM "ReceiptDelivery" r WHERE r."orderId"=o.id)))
    ORDER BY o."updatedAt", o.id LIMIT ${limit}`;
  for (const order of orders) {
    await enqueueJob(db, "reconcile_supplier", order.id);
    await enqueueJob(db, "complete_installation", order.id);
    await queueOrderReceipt(db, order.id);
  }
  const acknowledgments = await db.$queryRaw<Array<{ id: string }>>`
    SELECT p.id FROM "PaymentTransaction" p WHERE p.status='approved'
    AND EXISTS (SELECT 1 FROM "EsimOrder" o WHERE o."paymentTransactionId"=p.id AND o.status='completed' AND o."orderNumber" IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM "LifecycleJob" j WHERE j."businessKey"='ack_payment:' || p.id)
    ORDER BY p."updatedAt", p.id LIMIT ${limit}`;
  for (const payment of acknowledgments) await enqueueJob(db, "ack_payment", payment.id);
}

async function runLifecycleAttempt(db: PrismaClient, id: string, options: LifecycleJobOptions) {
  const job = await claimJob(db, id);
  if (!job) return { result: "busy" as const, wakeVersion: undefined };
  console.info("checkout.stage.started", { jobId: id, kind: job.kind, targetId: job.targetId, wakeVersion: job.wakeVersion,
    trigger: processingContext()?.trigger, correlationId: processingContext()?.correlationId });
  try {
    let done = false;
    switch (job.kind as JobKind) {
      case "verify_payment": {
        const payment = await db.paymentTransaction.findUniqueOrThrow({ where: { id: job.targetId } });
        if (["creating", "creation_rejected"].includes(payment.status)) {
          if (payment.status === "creation_rejected") done = true;
        } else {
          const result = await verifyPaymentTransaction(job.targetId, { prisma: db, source: processingContext()?.trigger ?? "recovery", deferFulfillment: true, dpoClient: options.dpoClient });
          if (result.retryable && result.message === "Verification failed.") throw new Error("Provider unavailable.");
          done = ["approved", "declined", "expired", "cancelled"].includes(result.paymentStatus);
          if (result.paymentStatus === "verification_mismatch") {
            await finishJob(db, job, "review", "payment_discrepancy");
            return { result: "review" as const, wakeVersion: job.wakeVersion };
          }
        }
        // A process may have died while creating a token; do not leave "creating" forever.
        if (payment.status === "creating" && Date.now() - payment.createdAt.getTime() > 120_000) {
          await db.paymentTransaction.updateMany({ where: { id: payment.id, status: "creating" }, data: { status: "creation_unknown" } });
        }
        break;
      }
      case "fulfill_checkout": {
        const checkout = await db.checkoutSession.findUniqueOrThrow({ where: { id: job.targetId } });
        if (checkout.orderId) {
          const existing = await db.esimOrder.findUniqueOrThrow({ where: { id: checkout.orderId } });
          // These states can only be reconciled, never resubmitted by a job retry.
          if (["airalo_submitting", "airalo_outcome_unknown", "airalo_failed"].includes(existing.status)) {
            await enqueueJob(db, "reconcile_supplier", existing.id);
            await finishJob(db, job, "review", "supplier_outcome_unknown");
            return { result: "review" as const, wakeVersion: job.wakeVersion };
          }
        }
        const result = await finaliseOrderFromCheckout(job.targetId, { prisma: db, airaloOptions: options.airaloOptions });
        await enqueueJob(db, "reconcile_supplier", result.orderId);
        await enqueueJob(db, "complete_installation", result.orderId);
        done = true;
        break;
      }
      case "reconcile_supplier": {
        const order = await db.esimOrder.findUniqueOrThrow({ where: { id: job.targetId }, include: { profiles: true, checkout: true, saleCheckout: true } });
        done = order.status === "completed" && Boolean(order.orderNumber) && ((order.saleCheckout ?? order.checkout)?.intent === "top-up" || order.profiles.length > 0);
        if (!done) {
          const result = await recoverAiraloOrders({ prisma: db, orderId: order.id, limit: 1, airalo: options.airaloOptions?.airaloClient });
          done = result.recovered > 0;
        }
        break;
      }
      case "complete_installation": {
        const disposition = await orderDisposition(db, job.targetId);
        if (disposition.blocked) { await finishJob(db, job, disposition.permanent ? "done" : "retry", "delivery_held_or_superseded"); return { result: disposition.permanent ? "done" as const : "retry" as const, wakeVersion: job.wakeVersion }; }
        const order = await db.esimOrder.findUniqueOrThrow({ where: { id: job.targetId }, include: { installation: true, profiles: true, checkout: true, saleCheckout: true } });
        if ((order.saleCheckout ?? order.checkout)?.intent === "top-up") { done = order.status === "completed"; break; }
        if (order.orderNumber && order.profiles.length) {
          await ensureOrderInstallation(order.id, { prisma: db, airaloClient: options.airaloOptions?.airaloClient });
          const current = await db.esimOrder.findUniqueOrThrow({ where: { id: order.id }, include: { installation: true, profiles: true } });
          let payload = null;
          try { payload = current.installation ? JSON.parse(current.installation.payload) : null; } catch { /* Retry missing installation. */ }
          done = current.status === "completed" && resolveReceiptDeliveryDetails(payload, current.profiles[0]?.activationCode).ready;
          if (done) await wakeOrderReceipt(db, order.id);
        }
        break;
      }
      case "ack_payment": {
        const payment = await db.paymentTransaction.findUniqueOrThrow({ where: { id: job.targetId }, include: { orders: true } });
        if (payment.status === "approved" && payment.orders.some(order => order.status === "completed" && order.orderNumber)) {
          const result = await (options.dpoClient ?? resolveDpoClient(payment.dpoMode)).verifyTransaction(payment.transactionToken ?? "", payment.checkoutId ?? undefined, { markProcessed: true });
          done = result.resultCode === "000";
        }
        break;
      }
    }
    await finishJob(db, job, done ? "done" : "retry", done ? undefined : "incomplete");
    return { result: done ? "done" as const : "retry" as const, wakeVersion: job.wakeVersion };
  } catch {
    await finishJob(db, job, "retry", "stage_unavailable");
    return { result: "failed" as const, wakeVersion: job.wakeVersion };
  }
}

export async function runLifecycleJob(db: PrismaClient, id: string, options: LifecycleJobOptions = {}): Promise<{ result: "done" | "retry" | "review" | "failed" | "busy" }> {
  if (!processingContext()) return withProcessingContext({ trigger: options.trigger ?? "recovery", correlationId: options.correlationId ?? randomUUID(), deadline: Date.now() + 120_000 }, () => runLifecycleJob(db, id, options));
  for (;;) {
    const context = processingContext()!;
    if (context.signal.aborted) return { result: "busy" };
    const current = await db.lifecycleJob.findUnique({ where: { id } });
    if (!current) return { result: "busy" };
    const delay = jobEligibleAt(current) - Date.now();
    if (current.status === "pending" && delay > 0 && delay <= 15_000) {
      console.info("checkout.stage.cooldown", { jobId: id, waitMs: delay, trigger: context.trigger, correlationId: context.correlationId });
      await processingWait(delay);
    }
    const { wakeVersion, ...outcome } = await runLifecycleAttempt(db, id, options);
    console.info("checkout.stage.finished", { jobId: id, kind: current.kind, result: outcome.result, trigger: context.trigger, correlationId: context.correlationId });
    if (wakeVersion === undefined || outcome.result === "review") return outcome;
    const after = await db.lifecycleJob.findUnique({ where: { id } });
    // The lease owner drains a fresh signal instead of overwriting it with a
    // five-minute retry. Without new information, ordinary backoff still applies.
    if (!after || after.status !== "pending" || after.wakeVersion <= wakeVersion || jobEligibleAt(after) > Date.now() + 15_000) return outcome;
  }
}

export async function queuePaymentVerification(paymentId: string, db: PrismaClient = prisma, expedite = false) {
  const job = await enqueueJob(db, "verify_payment", paymentId);
  return expedite || ["done", "review"].includes(job.status)
    ? wakeJob(db, "verify_payment", paymentId, { reopenDone: true, reopenReview: true }) : job;
}

export async function reconcilePayment(paymentId: string, db: PrismaClient = prisma) {
  const job = await queuePaymentVerification(paymentId, db);
  if (process.env.PURCHASE_LIFECYCLE_ENABLED !== "true") return { result: "busy" as const };
  // Synchronous tooling never waits out the cooldown. Public return/callback
  // handlers use the durable post-response processing path below.
  if (jobEligibleAt(job) > Date.now()) return { result: "busy" as const };
  return runLifecycleJob(db, job.id);
}

async function queueDelivery(db: Db, orderId: string) {
  await wakeJob(db, "reconcile_supplier", orderId);
  await wakeJob(db, "complete_installation", orderId);
  await wakeOrderReceipt(db, orderId);
  const order = await db.esimOrder.findUnique({ where: { id: orderId }, select: { paymentTransactionId: true, status: true, orderNumber: true } });
  if (order?.paymentTransactionId && order.status === "completed" && order.orderNumber) await wakeJob(db, "ack_payment", order.paymentTransactionId);
}

/** Commit the complete wakeup before the browser or provider is acknowledged. */
export async function requestPaymentProcessing(paymentId: string, db: PrismaClient = prisma, trigger: ProcessingTrigger = "browser", correlationId = randomUUID()) {
  await db.$transaction(async tx => {
    const payment = await tx.paymentTransaction.findUniqueOrThrow({ where: { id: paymentId }, include: { checkout: true } });
    if (payment.status !== "approved") {
      const closed = ["declined", "expired", "cancelled", "verification_mismatch", "creation_rejected"].includes(payment.status);
      if (!closed || trigger === "dpo_push") await wakeJob(tx, "verify_payment", paymentId, { reopenDone: true, reopenReview: trigger === "dpo_push" });
    } else if (payment.checkout && !payment.checkout.fulfillmentHold) {
      await wakeJob(tx, "fulfill_checkout", payment.checkout.id);
      const orderId = payment.checkout.activeOrderId ?? payment.checkout.orderId;
      if (orderId) await queueDelivery(tx, orderId);
    }
  });
  console.info("checkout.processing.queued", { paymentId, trigger, correlationId, at: new Date().toISOString() });
}

export async function requestOrderProcessing(orderId: string, db: Db = prisma) { await queueDelivery(db, orderId); }

async function advanceOrder(orderId: string, db: PrismaClient, options: ProcessingOptions) {
  const disposition = await orderDisposition(db, orderId);
  if (disposition.blocked || disposition.order?.ownershipReviewRequired) return;
  let order = await db.esimOrder.findUnique({ where: { id: orderId }, include: { payment: true, profiles: true, installation: true } });
  if (!order || (order.payment && order.payment.status !== "approved")) return;
  if (order.status !== "completed" && Date.now() - order.createdAt.getTime() >= 15_000) {
    const supplier = await enqueueJob(db, "reconcile_supplier", orderId);
    await runLifecycleJob(db, supplier.id, options);
    order = await db.esimOrder.findUnique({ where: { id: orderId }, include: { payment: true, profiles: true, installation: true } });
  }
  if (!order || order.status !== "completed" || !order.orderNumber) return;
  const installation = await enqueueJob(db, "complete_installation", orderId);
  const ack = order.paymentTransactionId ? await enqueueJob(db, "ack_payment", order.paymentTransactionId) : null;
  // Email or installation failure cannot prevent the separate DPO acknowledgement.
  await Promise.allSettled([runLifecycleJob(db, installation.id, options), ...(ack ? [runLifecycleJob(db, ack.id, options)] : [])]);
  const ready = await db.esimOrder.findUnique({ where: { id: orderId }, include: { installation: true, profiles: true } });
  let payload = null;
  try { payload = ready?.installation ? JSON.parse(ready.installation.payload) : null; } catch { /* Durable retry retains missing installation. */ }
  if (ready && resolveReceiptDeliveryDetails(payload, ready.profiles[0]?.activationCode).ready && process.env.RECEIPT_OUTBOX_ENABLED === "true") {
    const receipt = await wakeOrderReceipt(db, orderId);
    if (receipt) await deliverReceipt(db, receipt.id, options.receiptOptions);
  }
}

export async function processOrderDelivery(orderId: string, db: PrismaClient = prisma, options: ProcessingOptions = {}) {
  if (process.env.PURCHASE_LIFECYCLE_ENABLED !== "true") return;
  await withProcessingContext({ trigger: options.trigger ?? "supplier_webhook", correlationId: options.correlationId ?? randomUUID(), deadline: Date.now() + Math.min(options.budgetMs ?? 120_000, 120_000) }, () => advanceOrder(orderId, db, options));
}

/** Browser return, callback and recovery all execute the same leased stages. */
export async function processPaymentWorkflow(paymentId: string, db: PrismaClient = prisma, options: ProcessingOptions = {}) {
  if (process.env.PURCHASE_LIFECYCLE_ENABLED !== "true") return;
  await withProcessingContext({ trigger: options.trigger ?? "browser", correlationId: options.correlationId ?? randomUUID(), deadline: Date.now() + Math.min(options.budgetMs ?? 120_000, 120_000) }, async () => {
  const current = await db.paymentTransaction.findUnique({ where: { id: paymentId }, select: { status: true } });
  if (current?.status !== "approved") {
    const verify = await enqueueJob(db, "verify_payment", paymentId);
    await runLifecycleJob(db, verify.id, options);
  }
  const payment = await db.paymentTransaction.findUnique({ where: { id: paymentId }, select: { status: true, checkoutId: true } });
  if (payment?.status !== "approved" || !payment.checkoutId) return;

  const fulfill = await enqueueJob(db, "fulfill_checkout", payment.checkoutId);
  await runLifecycleJob(db, fulfill.id, options);
  const checkout = await db.checkoutSession.findUnique({ where: { id: payment.checkoutId }, select: { orderId: true, activeOrderId: true } });
  const orderId = checkout?.activeOrderId ?? checkout?.orderId;
  if (orderId) await advanceOrder(orderId, db, options);
  });
}

export async function processPaymentCallback(paymentId: string, db: PrismaClient = prisma, options: ProcessingOptions = {}) {
  return processPaymentWorkflow(paymentId, db, { ...options, trigger: options.trigger ?? "dpo_push" });
}

export async function runLifecycleTick(db: PrismaClient = prisma) {
  const deadline = Date.now() + 240_000;
  await reconcileAdminOperations(db);
  await seedLifecycleWork(db);
  const stages: Record<string, { checked: number; completed: number; unresolved: number; failed: number }> = {};
  for (const kind of kinds) {
    const stage = stages[kind] = { checked: 0, completed: 0, unresolved: 0, failed: 0 };
    const now = new Date();
    const due = await db.lifecycleJob.findMany({ where: { kind, nextAttemptAt: { lte: now }, OR: [{ status: "pending" }, { status: "leased", leaseUntil: { lte: now } }] }, orderBy: { nextAttemptAt: "asc" }, take: 5 });
    for (const job of due) {
      if (Date.now() + 90_000 > deadline) break;
      const outcome = await withProcessingContext({ trigger: "recovery", correlationId: randomUUID(), deadline: Math.min(deadline, Date.now() + 120_000) }, () => runLifecycleJob(db, job.id));
      stage.checked++;
      if (outcome.result === "done") stage.completed++; else if (outcome.result !== "busy") stage.unresolved++;
      if (outcome.result === "failed") stage.failed++;
    }
  }
  const receipts = process.env.RECEIPT_OUTBOX_ENABLED === "true" ? await withProcessingContext({ trigger: "recovery", correlationId: randomUUID(), deadline }, () => deliverReceipts(db, 5, deadline)) : { checked: 0, accepted: 0, pending: 0, review: 0, failed: 0, enabled: false };
  const totals = Object.values(stages);
  await db.rateBucket.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 48 * 3_600_000) } } });
  return { ok: !totals.some(stage => stage.failed) && receipts.failed === 0, checked: totals.reduce((n, stage) => n + stage.checked, 0),
    recovered: totals.reduce((n, stage) => n + stage.completed, 0), unresolved: totals.reduce((n, stage) => n + stage.unresolved, 0), stages, receipts };
}
