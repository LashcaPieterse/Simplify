import type { PrismaClient } from "@prisma/client";
import prisma from "../db/client";
import { claimJob, enqueueJob, finishJob, type JobKind } from "./store";
import { finaliseOrderFromCheckout, verifyPaymentTransaction } from "../payments/checkouts";
import type { CreateOrderOptions } from "../orders/service";
import { recoverAiraloOrders } from "../orders/recovery";
import { ensureOrderInstallation } from "../orders/installation";
import { resolveDpoClient, type DpoClient } from "../payments/dpo";
import { queueOrderReceipt, deliverReceipts } from "../notifications/receipt-outbox";
import { resolveReceiptDeliveryDetails } from "../notifications/receipts";

const kinds: JobKind[] = ["verify_payment", "fulfill_checkout", "reconcile_supplier", "complete_installation", "ack_payment"];

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

export async function runLifecycleJob(db: PrismaClient, id: string, options: {
  dpoClient?: Pick<DpoClient, "verifyTransaction">; airaloOptions?: CreateOrderOptions;
} = {}) {
  const job = await claimJob(db, id);
  if (!job) return { result: "busy" as const };
  try {
    let done = false;
    switch (job.kind as JobKind) {
      case "verify_payment": {
        const payment = await db.paymentTransaction.findUniqueOrThrow({ where: { id: job.targetId } });
        if (["creating", "creation_rejected"].includes(payment.status)) {
          if (payment.status === "creation_rejected") done = true;
        } else {
          const result = await verifyPaymentTransaction(job.targetId, { prisma: db, source: "reconcile", deferFulfillment: true, dpoClient: options.dpoClient });
          if (result.retryable && result.message === "Verification failed.") throw new Error("Provider unavailable.");
          done = ["approved", "declined", "expired", "cancelled"].includes(result.paymentStatus);
          if (result.paymentStatus === "verification_mismatch") {
            await finishJob(db, job, "review", "payment_discrepancy");
            return { result: "review" as const };
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
            return { result: "review" as const };
          }
        }
        const result = await finaliseOrderFromCheckout(job.targetId, { prisma: db, airaloOptions: options.airaloOptions });
        await enqueueJob(db, "reconcile_supplier", result.orderId);
        await enqueueJob(db, "complete_installation", result.orderId);
        done = true;
        break;
      }
      case "reconcile_supplier": {
        const order = await db.esimOrder.findUniqueOrThrow({ where: { id: job.targetId }, include: { profiles: true, checkout: true } });
        done = order.status === "completed" && Boolean(order.orderNumber) && (order.checkout?.intent === "top-up" || order.profiles.length > 0);
        if (!done) {
          const result = await recoverAiraloOrders({ prisma: db, orderId: order.id, limit: 1 });
          done = result.recovered > 0;
        }
        break;
      }
      case "complete_installation": {
        const order = await db.esimOrder.findUniqueOrThrow({ where: { id: job.targetId }, include: { installation: true, profiles: true, checkout: true } });
        if (order.checkout?.intent === "top-up") { done = order.status === "completed"; break; }
        if (order.orderNumber && order.profiles.length) {
          await ensureOrderInstallation(order.id, { prisma: db });
          const current = await db.esimOrder.findUniqueOrThrow({ where: { id: order.id }, include: { installation: true, profiles: true } });
          let payload = null;
          try { payload = current.installation ? JSON.parse(current.installation.payload) : null; } catch { /* Retry missing installation. */ }
          done = current.status === "completed" && resolveReceiptDeliveryDetails(payload, current.profiles[0]?.activationCode).ready;
          if (done) await queueOrderReceipt(db, order.id);
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
    return { result: done ? "done" as const : "retry" as const };
  } catch {
    await finishJob(db, job, "retry", "stage_unavailable");
    return { result: "failed" as const };
  }
}

export async function reconcilePayment(paymentId: string, db: PrismaClient = prisma) {
  const job = await enqueueJob(db, "verify_payment", paymentId);
  // A later callback may report payment after an earlier terminal observation.
  // Reopen verification only; supplier claims and review jobs stay untouched.
  if (job.status === "done" || job.status === "review") {
    await db.lifecycleJob.updateMany({
      where: { id: job.id, kind: "verify_payment", status: job.status, updatedAt: job.updatedAt },
      data: { status: "pending", lastError: null,
        nextAttemptAt: new Date(Math.max(Date.now(), job.updatedAt.getTime() + 15_000)) },
    });
  }
  if (process.env.PURCHASE_LIFECYCLE_ENABLED !== "true") return { result: "busy" as const };
  return runLifecycleJob(db, job.id);
}

export async function runLifecycleTick(db: PrismaClient = prisma) {
  const deadline = Date.now() + 240_000;
  await seedLifecycleWork(db);
  const stages: Record<string, { checked: number; completed: number; unresolved: number; failed: number }> = {};
  for (const kind of kinds) {
    const stage = stages[kind] = { checked: 0, completed: 0, unresolved: 0, failed: 0 };
    const now = new Date();
    const due = await db.lifecycleJob.findMany({ where: { kind, nextAttemptAt: { lte: now }, OR: [{ status: "pending" }, { status: "leased", leaseUntil: { lte: now } }] }, orderBy: { nextAttemptAt: "asc" }, take: 5 });
    for (const job of due) {
      if (Date.now() + 90_000 > deadline) break;
      const outcome = await runLifecycleJob(db, job.id);
      stage.checked++;
      if (outcome.result === "done") stage.completed++; else if (outcome.result !== "busy") stage.unresolved++;
      if (outcome.result === "failed") stage.failed++;
    }
  }
  const receipts = process.env.RECEIPT_OUTBOX_ENABLED === "true" ? await deliverReceipts(db, 5, deadline) : { checked: 0, accepted: 0, pending: 0, review: 0, failed: 0, enabled: false };
  const totals = Object.values(stages);
  await db.rateBucket.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 48 * 3_600_000) } } });
  return { ok: !totals.some(stage => stage.failed) && receipts.failed === 0, checked: totals.reduce((n, stage) => n + stage.checked, 0),
    recovered: totals.reduce((n, stage) => n + stage.completed, 0), unresolved: totals.reduce((n, stage) => n + stage.unresolved, 0), stages, receipts };
}
