import type { AiraloClient } from "../airalo/client";
import { Prisma, type PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { recoverAiraloOrders } from "../orders/recovery";
import { createOrder, resolveAiraloClient } from "../orders/service";
import { ensureOrderInstallation, parseInstallationPayloadJson } from "../orders/installation";
import { orderDisposition } from "../orders/fulfillment-disposition";
import { runLifecycleTick, runLifecycleJob } from "../jobs/lifecycle";
import { enqueueJob } from "../jobs/store";
import { deliverReceipt, reviewReceipt } from "../notifications/receipt-outbox";
import { reconcileAffiliateCommissions } from "../affiliates/accounting";
import { deliverAffiliateNotifications } from "../affiliates/notifications";
import { isCatalogPriceFresh } from "../catalog/retail-prices";
import { getTopUpPackages } from "../orders/topups";
import { claimReservedOrderForSubmission, persistOrderRecords } from "../orders/persistence";
import { buildAiraloTopUpOrderPayload } from "../orders/airalo-ordering";
import { resolveReceiptDeliveryDetails } from "../notifications/receipts";
import { enforceRates } from "../security/rate-limit";
import { ACTIVE_OPERATIONS, requestFingerprint, finishOperation, operationResult, rejectRefund, confirmRefund, inspectPayment, requireFeature, runPaymentOperation, type OperationInput } from "./financial";
import { OperationError } from "./operations-types";

const paymentKinds = ["verify_payment", "capture", "cancel_payment", "refund", "record_refund"];
const receiptKinds = ["retry_receipt", "confirm_receipt", "resend_receipt"];
const orderKinds = ["recover_order", "refresh_installation", "retry_fulfillment", "replace_order", "supplier_refund", "resolve_ownership"];

export async function executeOperation(db: PrismaClient, input: OperationInput, actorEmail: string, dependencies: { airalo?: AiraloClient } = {}) {
  requireFeature(input.kind);
  if (paymentKinds.includes(input.kind)) return runPaymentOperation(db, input, actorEmail);
  const { operation, fresh } = await db.$transaction(async tx => {
    const duplicate = await tx.adminOperation.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (duplicate) {
      if (duplicate.targetId !== input.targetId || duplicate.kind !== input.kind || duplicate.actorEmail !== actorEmail || (duplicate.payload as { requestHash?: string } | null)?.requestHash !== requestFingerprint(input)) throw new OperationError("Operation key belongs to another request.");
      return { operation: duplicate, fresh: false };
    }
    let version: string;
    let saleId: string | null = null;
    if (receiptKinds.includes(input.kind)) version = (await tx.receiptDelivery.findUniqueOrThrow({ where: { id: input.targetId } })).updatedAt.toISOString();
    else if (orderKinds.includes(input.kind)) {
      const { order, sale } = await orderDisposition(tx, input.targetId);
      if (!order) throw new OperationError("Order not found.");
      version = order.updatedAt.toISOString(); saleId = sale?.id ?? null;
      if (saleId) {
        await tx.$queryRaw`SELECT id FROM "CheckoutSession" WHERE id=${saleId} FOR UPDATE`;
        if (input.kind === "replace_order") {
          const current = await tx.checkoutSession.findUniqueOrThrow({ where: { id: saleId } });
          if (current.fulfillmentHold || (current.activeOrderId && current.activeOrderId !== order.id)) throw new OperationError("The sale is held or this order was already superseded.");
          if (await tx.adminOperation.count({ where: { status: { in: ACTIVE_OPERATIONS }, kind: { in: ["refund", "capture", "replace_order"] }, payload: { path: ["saleId"], equals: saleId } } })) throw new OperationError("Another financial operation for this sale is unresolved.");
        }
      }
    } else if (["resolve_refund", "resolve_supplier_refund", "resolve_operation"].includes(input.kind)) {
      const original = await tx.adminOperation.findUniqueOrThrow({ where: { id: input.targetId } });
      version = original.updatedAt.toISOString();
      if (version !== input.expectedVersion) throw new OperationError("The record changed. Refresh before acting.");
      // Claim the reviewed version so competing operators cannot both accept a
      // different disposition of the same provider request.
      await tx.adminOperation.update({ where: { id: original.id }, data: { updatedAt: new Date() } });
    }
    else version = (await tx.operationsSettings.findUniqueOrThrow({ where: { id: "operations" } })).updatedAt.toISOString();
    if (version !== input.expectedVersion) throw new OperationError("The record changed. Refresh before acting.");
    const operation = await tx.adminOperation.create({ data: { kind: input.kind, targetId: input.targetId, actorEmail, reason: input.reason,
      expectedVersion: input.expectedVersion, idempotencyKey: input.idempotencyKey, leaseUntil: new Date(Date.now() + 300_000), payload: { saleId, requestHash: requestFingerprint(input) } } });
    await tx.auditLog.create({ data: { action: `operations.${input.kind}.started`, entityType: "AdminOperation", entityId: input.targetId, details: JSON.stringify({ actor: actorEmail, operationId: operation.id, reason: input.reason }) } });
    return { operation, fresh: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  if (!fresh) return operationResult(operation);
  // Unknown is conservative for any interrupted action; only safe reads/leased jobs may be explicitly retried.
  let irreversible = false;
  try {
    let resultCode = "completed";
    let status = "succeeded";
    let reference: string | undefined;
    switch (input.kind) {
      case "recover_order": {
        const result = await recoverAiraloOrders({ prisma: db, orderId: input.targetId, limit: 1, airalo: dependencies.airalo });
        resultCode = result.recovered ? "purchase_recovered" : "supplier_still_unresolved";
        status = result.recovered ? "succeeded" : "pending";
        break;
      }
      case "refresh_installation": {
        const disposition = await orderDisposition(db, input.targetId);
        if (disposition.blocked) throw new OperationError("This delivery is held or superseded.");
        const refreshed = await ensureOrderInstallation(input.targetId, { prisma: db });
        const ready = refreshed?.profiles.length && resolveReceiptDeliveryDetails(parseInstallationPayloadJson(refreshed.installation?.payload), refreshed.profiles[0]?.activationCode).ready;
        status = ready ? "succeeded" : "pending"; resultCode = ready ? "installation_ready" : "installation_not_ready"; break;
      }
      case "retry_fulfillment": {
        if (process.env.PURCHASE_LIFECYCLE_ENABLED !== "true") throw new OperationError("Purchase lifecycle workers are disabled.");
        const { order, sale, blocked } = await orderDisposition(db, input.targetId);
        if (!sale || !order || blocked || !["pending", "airalo_rejected"].includes(order.status) || order.requestId || order.orderNumber) throw new OperationError("Only a definitively unsubmitted active purchase can be retried.");
        if (order.saleCheckoutId) throw new OperationError("Reconcile this replacement first. A new replacement must have its own explicit authorization.");
        const job = await enqueueJob(db, "fulfill_checkout", sale.id);
        if (job.status !== "leased") await db.lifecycleJob.updateMany({ where: { id: job.id, status: job.status, updatedAt: job.updatedAt }, data: { status: "pending", nextAttemptAt: new Date(), lastError: null } });
        const outcome = await runLifecycleJob(db, job.id); resultCode = outcome.result; status = outcome.result === "done" ? "succeeded" : outcome.result === "failed" ? "rejected" : "pending"; break;
      }
      case "retry_receipt": {
        if (process.env.RECEIPT_OUTBOX_ENABLED !== "true") throw new OperationError("Receipt delivery is disabled.");
        const job = await db.receiptDelivery.findUniqueOrThrow({ where: { id: input.targetId } });
        if (job.status !== "pending") throw new OperationError("Only pending receipts can be retried. Review uncertain deliveries before resending.");
        await db.receiptDelivery.updateMany({ where: { id: job.id, status: "pending", updatedAt: job.updatedAt }, data: { nextAttemptAt: new Date() } });
        resultCode = await deliverReceipt(db, job.id); status = resultCode === "accepted" ? "succeeded" : resultCode === "review" ? "unknown" : "pending"; break;
      }
      case "confirm_receipt": case "resend_receipt": {
        const job = await db.receiptDelivery.findUniqueOrThrow({ where: { id: input.targetId } });
        if ((await orderDisposition(db, job.orderId)).blocked) throw new OperationError("This delivery is held or superseded.");
        await reviewReceipt(db, { id: job.id, action: input.kind === "confirm_receipt" ? "confirm" : "resend", actor: actorEmail, reason: input.reason, providerMessageId: input.reference }); break;
      }
      case "resolve_ownership": {
        await db.$transaction(async tx => {
          const order = await tx.esimOrder.findUniqueOrThrow({ where: { id: input.targetId }, include: { user: true, checkout: true } });
          if (!order.user?.emailProofAt || order.user.recoveryRequired || !order.ownershipReviewRequired) throw new OperationError("Fresh account proof and independent ownership evidence are required.");
          await tx.esimOrder.update({ where: { id: order.id }, data: { ownershipReviewRequired: false } });
          if (order.checkout?.userId === order.userId) await tx.checkoutSession.update({ where: { id: order.checkout.id }, data: { ownershipReviewRequired: false } });
          await tx.paymentTransaction.updateMany({ where: { id: order.paymentTransactionId ?? "", userId: order.userId }, data: { ownershipReviewRequired: false } });
        }); break;
      }
      case "replace_order": {
        const { order, sale } = await orderDisposition(db, input.targetId);
        if (!order || !sale || !order.paymentTransactionId) throw new OperationError("A replacement requires an existing paid sale.");
        const payment = await db.paymentTransaction.findUniqueOrThrow({ where: { id: order.paymentTransactionId } });
        if (payment.status !== "approved" || order.ownershipReviewRequired || sale.ownershipReviewRequired) throw new OperationError("Confirmed payment and resolved ownership are required.");
        if (!input.duplicateCostAccepted) throw new OperationError("Explicitly accept the supplier cost and possible duplicate purchase.");
        const pkg = await db.package.findUniqueOrThrow({ where: { id: input.packageId ?? order.packageId }, include: { state: true } });
        if (pkg.netPrice === null || !Number.isFinite(Number(pkg.netPrice)) || Number(pkg.netPrice) < 0) throw new OperationError("A verified supplier cost is required. Sync the catalogue and preview again.");
        const previewVersion = createHash("sha256").update(`${pkg.id}:${pkg.updatedAt.toISOString()}:${pkg.netPrice ?? pkg.price}`).digest("hex");
        if (input.previewVersion !== previewVersion) throw new OperationError("Preview the replacement package and current supplier cost before confirming the purchase.");
        if (!pkg.state?.isActive || !isCatalogPriceFresh(pkg.state.lastSyncedAt) || pkg.type !== (sale.intent === "top-up" ? "topup" : "sim")) throw new OperationError("Choose a fresh, active package of the same purchase type.");
        if (sale.intent === "top-up") {
          if (!sale.topUpForIccid || !sale.topUpForOrderId) throw new OperationError("Original top-up identity is missing.");
          const profile = await db.esimProfile.findUnique({ where: { iccid: sale.topUpForIccid } });
          if (profile?.orderId !== sale.topUpForOrderId) throw new OperationError("Original SIM identity conflicts.");
          const eligible = await getTopUpPackages(sale.topUpForIccid, { prisma: db, airaloClient: dependencies.airalo, forceRefresh: true });
          if (!eligible.some(p => p.id === pkg.airaloPackageId || p.localPackageId === pkg.id)) throw new OperationError("This package is not eligible for the original SIM.");
        }
        const replacement = await db.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM "CheckoutSession" WHERE id=${sale.id} FOR UPDATE`;
          const current = await tx.checkoutSession.findUniqueOrThrow({ where: { id: sale.id } });
          if (current.fulfillmentHold || (current.activeOrderId && current.activeOrderId !== order.id)) throw new OperationError("The active delivery changed.");
          if (await tx.receiptDelivery.count({ where: { orderId: order.id, status: "leased", leaseUntil: { gt: new Date() } } })) throw new OperationError("A delivery is in progress. Wait for its lease to finish.");
          const replacement = await tx.esimOrder.create({ data: { packageId: pkg.id, userId: order.userId, customerEmail: order.customerEmail, currency: payment.currency, totalCents: 0, status: "pending", paymentTransactionId: payment.id, replacementForId: order.id, saleCheckoutId: sale.id } });
          await tx.checkoutSession.update({ where: { id: sale.id }, data: { activeOrderId: replacement.id } });
          await tx.receiptDelivery.updateMany({ where: { orderId: order.id, status: { in: ["pending", "review", "leased"] } }, data: { status: "superseded", leaseToken: null, leaseUntil: null } });
          await tx.adminOperation.update({ where: { id: operation.id }, data: { reference: replacement.id, payload: { ...(operation.payload as Prisma.JsonObject), replacementPackageId: pkg.id, originalPackageId: order.packageId, supplierCost: pkg.netPrice!.toString(), supplierCurrency: "USD", supplierOrigin: new URL(process.env.AIRALO_BASE_URL ?? "https://partners-api.airalo.com/v2").origin, packageVersion: pkg.updatedAt.toISOString() } } });
          return replacement;
        });
        const reserved = { orderId: replacement.id, packageId: pkg.id, airaloPackageId: pkg.airaloPackageId, packageTitle: pkg.title, quantity: 1, totalCents: 0, currency: payment.currency, customerEmail: replacement.customerEmail };
        irreversible = true;
        if (sale.intent === "top-up") {
          await claimReservedOrderForSubmission(db, reserved);
          const response = await (dependencies.airalo ?? resolveAiraloClient()).createTopUpOrderResponse(buildAiraloTopUpOrderPayload({ pkg: { id: pkg.id, airaloPackageId: pkg.airaloPackageId, title: pkg.title }, iccid: sale.topUpForIccid!, localOrderId: replacement.id }));
          await persistOrderRecords(db, { userId: replacement.userId, reservedOrder: reserved, pkg: { id: pkg.id, airaloPackageId: pkg.airaloPackageId, title: pkg.title }, customerEmail: replacement.customerEmail, quantity: 1, totalCents: 0, currency: payment.currency, airaloAsyncResponse: null, airaloOrderResponse: response, airaloAck: null, airaloOrder: response.data, persistSimProfile: false, persistInstallation: false, statusFallback: "completed" });
        } else await createOrder({ packageId: pkg.id, quantity: 1, customerEmail: replacement.customerEmail ?? undefined }, { prisma: db, userId: replacement.userId ?? undefined, reservedOrder: reserved, airaloClient: dependencies.airalo, submissionMode: "async" });
        reference = replacement.id; status = "provider_pending"; resultCode = "replacement_submitted"; break;
      }
      case "supplier_refund": {
        const order = await db.esimOrder.findUniqueOrThrow({ where: { id: input.targetId }, include: { profiles: true } });
        if (!order.profiles.length) throw new OperationError("Supplier refund requires an identified eSIM. Escalate missing or uncertain purchases using the supplier reference.");
        if (!input.reference) throw new OperationError("Enter the documented Airalo refund reason code.");
        await enforceRates([{ scope: "supplier-refund", identifier: "merchant", limit: 5, windowSeconds: 60 }], db);
        irreversible = true;
        reference = await (dependencies.airalo ?? resolveAiraloClient()).requestRefund({ iccids: order.profiles.map(p => p.iccid), reason: input.reference, notes: input.reason, email: actorEmail });
        status = "provider_pending"; resultCode = "supplier_refund_requested"; break;
      }
      case "resolve_operation": {
        if (!input.reference || !input.outcome) throw new OperationError("Record the independently verified provider outcome and reference.");
        reference = input.reference;
        const original = await db.adminOperation.findUniqueOrThrow({ where: { id: input.targetId } });
        if (!["capture", "cancel_payment", "replace_order"].includes(original.kind) || !["unknown", "provider_pending"].includes(original.status)) throw new OperationError("This operation does not require provider reconciliation.");
        if (original.kind === "replace_order") {
          const replacement = original.reference ? await db.esimOrder.findUniqueOrThrow({ where: { id: original.reference }, include: { profiles: true, saleCheckout: true } }) : null;
          if (input.outcome === "confirmed" && (!replacement || replacement.status !== "completed" || !replacement.orderNumber || replacement.saleCheckout?.intent !== "top-up" && !replacement.profiles.length)) throw new OperationError("Recover the existing replacement and verify completed supplier fulfilment first.");
          if (input.outcome === "rejected" && replacement && (replacement.orderNumber || replacement.requestId || !["pending", "airalo_rejected"].includes(replacement.status))) throw new OperationError("The replacement may have been submitted. Recover it or obtain a definitive supplier rejection before another purchase.");
        } else {
          await inspectPayment(db, original.targetId);
          const reconciled = await db.adminOperation.findUniqueOrThrow({ where: { id: original.id } });
          if (!["unknown", "provider_pending"].includes(reconciled.status)) break;
          if (input.outcome === "confirmed") throw new OperationError("Final provider verification has not confirmed this outcome. The operation remains unresolved.");
        }
        await finishOperation(db, original, input.outcome === "confirmed" ? "succeeded" : "rejected", "operator_provider_evidence"); break;
      }
      case "resolve_refund": case "resolve_supplier_refund": {
        if (!input.reference || !input.outcome) throw new OperationError("Record the provider outcome and its evidence reference.");
        reference = input.reference;
        const original = await db.adminOperation.findUniqueOrThrow({ where: { id: input.targetId }, include: { refund: true } });
        if (!ACTIVE_OPERATIONS.includes(original.status) || original.status === "running" && original.leaseUntil > new Date()) throw new OperationError("This operation is completed or is still executing.");
        if (input.kind === "resolve_refund") {
          if (!original.refund) throw new OperationError("This is not a customer refund.");
          if (input.outcome === "confirmed") await confirmRefund(db, original.refund.id, actorEmail, `${input.reference}: ${input.reason}`);
          else await rejectRefund(db, original.refund.id);
        } else if (original.kind !== "supplier_refund") throw new OperationError("This is not a supplier refund request.");
        await finishOperation(db, original, input.outcome === "confirmed" ? "succeeded" : "rejected", "operator_provider_evidence"); break;
      }
      case "run_recovery": {
        if (process.env.PURCHASE_LIFECYCLE_ENABLED !== "true") throw new OperationError("Purchase lifecycle workers are disabled.");
        const result = await runLifecycleTick(db); resultCode = result.ok ? "bounded_recovery_completed" : "recovery_needs_review"; status = result.ok ? "succeeded" : "rejected"; break;
      }
      case "reconcile_affiliates": {
        await reconcileAffiliateCommissions(db); await deliverAffiliateNotifications(db); break;
      }
      case "checkout_pause": {
        await db.operationsSettings.update({ where: { id: "operations" }, data: { checkoutPaused: input.enabled === true, reason: input.reason } }); break;
      }
      case "scheduler": {
        if (!["airalo-order-recovery", "production-alert-monitor"].includes(input.targetId)) throw new OperationError("Unsupported scheduler.");
        const jobs = await db.$queryRaw<Array<{ jobid: bigint; command: string }>>`SELECT jobid, command FROM cron.job WHERE jobname=${input.targetId}`;
        if (jobs.length !== 1) throw new OperationError("The scheduler is missing or ambiguous. Apply the platform bootstrap before activation.");
        if (input.enabled) {
          const expected = input.targetId === "airalo-order-recovery" ? "select recovery_ops.run_airalo_recovery();" : "select recovery_ops.run_production_monitor();";
          if (jobs[0].command.trim().toLowerCase() !== expected) throw new OperationError("The timer command differs from the supported platform definition. Ask the deployment administrator to inspect it.");
          const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "https://invalid.example").origin;
          if (origin !== "https://sim.africa") throw new OperationError("These platform timers target production. Activation is restricted to the production application origin.");
          const readiness = await db.$queryRaw<Array<{ scheduler: boolean; mail: boolean }>>`SELECT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='airalo_recovery_cron_token' AND length(btrim(decrypted_secret))>0) AS scheduler, EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='operations_alert_resend_key' AND length(btrim(decrypted_secret))>0) AS mail`;
          if (!readiness[0]?.scheduler || input.targetId === "production-alert-monitor" && !readiness[0]?.mail) throw new OperationError("Required Vault configuration is missing. Complete secure provisioning before activation.");
        }
        // Existing commands and destinations are retained; arbitrary SQL and URLs are never accepted.
        await db.$queryRaw`SELECT cron.alter_job(${Number(jobs[0].jobid)}::bigint, active := ${input.enabled === true})::text`; break;
      }
      default: throw new OperationError("Unsupported action.");
    }
    return operationResult(await finishOperation(db, operation, status, resultCode, reference));
  } catch (error) {
    await finishOperation(db, operation, irreversible ? "unknown" : "rejected", irreversible ? "provider_or_persistence_unknown" : "action_incomplete");
    if (error instanceof OperationError) throw error;
    return { operationId: operation.id, outcome: irreversible ? "unknown" : "rejected", message: irreversible ? "The outcome is uncertain. Reconcile the saved operation before another purchase or refund." : "The action could not complete. Review this record and system health before retrying." };
  }
}

export function newOperationKey() { return randomUUID(); }
