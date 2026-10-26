import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type AdminOperation } from "@prisma/client";
import { z } from "zod";
import { resolveDpoClient, type DpoClient } from "../payments/dpo";
import { commitPaymentTransition, paymentState } from "../payments/transitions";
import { retailAmountToCents } from "../catalog/retail-prices";
import { recordAffiliateSaleRefund } from "../affiliates/accounting";
import { OPERATION_KINDS, OperationError, operationMessage, type OperationResult } from "./operations-types";

export const operationInputSchema = z.object({
  kind: z.enum(OPERATION_KINDS), targetId: z.string().trim().min(1).max(200),
  expectedVersion: z.string().min(1).max(100), idempotencyKey: z.string().uuid(),
  reason: z.string().trim().min(5, "Record a reason of at least five characters.").max(500),
  amount: z.string().max(30).optional(), reference: z.string().trim().max(200).optional(),
  packageId: z.string().max(200).optional(), duplicateCostAccepted: z.boolean().optional(),
  previewVersion: z.string().max(64).optional(),
  confirmation: z.literal(true, { error: "Confirm the action and its effect." }),
  enabled: z.boolean().optional(), outcome: z.enum(["confirmed", "rejected"]).optional(),
});
export type OperationInput = z.infer<typeof operationInputSchema>;
export function requestFingerprint(input: OperationInput) {
  return createHash("sha256").update(JSON.stringify({ ...input, idempotencyKey: undefined })).digest("hex");
}
export const ACTIVE_OPERATIONS = ["running", "provider_pending", "unknown"];
export const RESERVING_REFUNDS = ["reserved", "unknown", "confirmed"];
export function parseOperationAmount(amount: string | undefined) {
  if (!amount || !/^\d{1,8}(\.\d{1,2})?$/.test(amount)) throw new OperationError("Enter a positive amount with at most two decimals.");
  const cents = retailAmountToCents(amount);
  if (!cents) throw new OperationError("Invalid amount.");
  return cents;
}
export function featureFor(kind: string) {
  return ({ capture: "ADMIN_CAPTURE_ENABLED", cancel_payment: "ADMIN_CAPTURE_ENABLED", refund: "ADMIN_REFUNDS_ENABLED", record_refund: "ADMIN_REFUNDS_ENABLED", replace_order: "ADMIN_REPLACEMENTS_ENABLED", supplier_refund: "ADMIN_SUPPLIER_REFUNDS_ENABLED" } as Record<string, string>)[kind];
}
export function requireFeature(kind: string) {
  const flag = featureFor(kind);
  if (flag && process.env[flag] !== "true") throw new OperationError(`${flag} is disabled. Complete provider validation before enabling this action.`);
}
export function operationResult(operation: Pick<AdminOperation, "id" | "status">): OperationResult {
  return { operationId: operation.id, outcome: operation.status, message: operationMessage(operation.status) };
}
export async function finishOperation(db: PrismaClient, operation: AdminOperation, status: string, resultCode: string, reference?: string) {
  return db.$transaction(async tx => {
    // A callback, worker or another reviewer may already have established a final
    // outcome. Late responses must not replace that evidence or reopen the action.
    const changed = await tx.adminOperation.updateMany({ where: { id: operation.id, status: { in: ACTIVE_OPERATIONS } }, data: { status, resultCode, ...(reference ? { reference } : {}) } });
    const result = await tx.adminOperation.findUniqueOrThrow({ where: { id: operation.id } });
    if (!changed.count) return result;
    await tx.auditLog.create({ data: { action: `operations.${operation.kind}.${status}`, entityType: "AdminOperation", entityId: operation.targetId,
      details: JSON.stringify({ actor: operation.actorEmail, operationId: operation.id, reason: operation.reason, resultCode, reference }) } });
    return result;
  });
}

// Monetary totals include historical external adjustments that predate the refund journal.
export async function refundBalance(tx: Prisma.TransactionClient, paymentId: string) {
  const payment = await tx.paymentTransaction.findUniqueOrThrow({ where: { id: paymentId }, include: { refunds: true, checkout: { include: { affiliateAdjustments: true } } } });
  const journalRefs = new Set(payment.refunds.map(r => r.reference));
  const legacy = payment.checkout?.affiliateAdjustments.filter(r => !journalRefs.has(r.reference)).reduce((n, r) => n + r.saleRefundCents, 0) ?? 0;
  const reserved = legacy + payment.refunds.filter(r => RESERVING_REFUNDS.includes(r.status)).reduce((n, r) => n + r.amountCents, 0);
  const confirmed = legacy + payment.refunds.filter(r => r.status === "confirmed").reduce((n, r) => n + r.amountCents, 0);
  return { payment, reserved, confirmed, remaining: Math.max(0, payment.amountCents - reserved) };
}

export async function startPaymentOperation(db: PrismaClient, input: OperationInput, actorEmail: string) {
  try {
    return await db.$transaction(async tx => {
      const duplicate = await tx.adminOperation.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (duplicate) {
        if (duplicate.kind !== input.kind || duplicate.targetId !== input.targetId || duplicate.actorEmail !== actorEmail || (duplicate.payload as { requestHash?: string } | null)?.requestHash !== requestFingerprint(input)) throw new OperationError("Operation key already belongs to another request.");
        return { operation: duplicate, fresh: false };
      }
      await tx.$queryRaw`SELECT id FROM "PaymentTransaction" WHERE id=${input.targetId} FOR UPDATE`;
      const balance = await refundBalance(tx, input.targetId);
      const { payment } = balance;
      if (payment.updatedAt.toISOString() !== input.expectedVersion) throw new OperationError("This payment changed. Refresh before acting.");
      if (input.kind !== "verify_payment" && await tx.adminOperation.count({ where: { targetId: payment.id, status: { in: ACTIVE_OPERATIONS }, kind: { in: ["capture", "cancel_payment", "refund"] } } })) throw new OperationError("Another financial operation requires reconciliation.");
      if (payment.provider !== "dpo" || !payment.dpoMode) throw new OperationError("A saved DPO environment is required.");
      if (payment.checkoutId) {
        await tx.$queryRaw`SELECT id FROM "CheckoutSession" WHERE id=${payment.checkoutId} FOR UPDATE`;
        if (["refund", "record_refund"].includes(input.kind) && await tx.receiptDelivery.count({ where: { status: "leased", leaseUntil: { gt: new Date() }, order: { OR: [{ checkout: { is: { id: payment.checkoutId } } }, { saleCheckoutId: payment.checkoutId }] } } })) throw new OperationError("A receipt is being delivered. Wait for its lease before changing the financial disposition.");
        const busy = await tx.adminOperation.count({ where: { status: { in: ACTIVE_OPERATIONS }, kind: { in: ["capture", "cancel_payment", "refund", "replace_order"] }, payload: { path: ["saleId"], equals: payment.checkoutId } } });
        if (busy && input.kind !== "verify_payment") throw new OperationError("Another financial operation for this sale needs reconciliation first.");
      }
      if (["refund", "record_refund"].includes(input.kind) && payment.status !== "approved") throw new OperationError("Only an independently approved payment can be refunded.");
      if (input.kind === "capture" && payment.status !== "authorized") throw new OperationError("Only an authorized payment can be captured.");
      if (input.kind === "cancel_payment" && !["pending", "authorized", "verification_error"].includes(payment.status)) throw new OperationError("Only an unpaid transaction can be cancelled.");
      const amountCents = ["refund", "record_refund"].includes(input.kind) ? parseOperationAmount(input.amount) : undefined;
      if (amountCents && amountCents > balance.remaining) throw new OperationError("The refund exceeds the remaining captured balance, including pending and external refunds.");
      const reference = input.kind === "record_refund" ? input.reference?.trim() : `ops-${randomUUID()}`;
      if (input.kind === "record_refund" && !reference) throw new OperationError("Provide the verified external refund reference.");
      const operation = await tx.adminOperation.create({ data: { idempotencyKey: input.idempotencyKey, kind: input.kind, targetId: input.targetId, actorEmail,
        reason: input.reason, expectedVersion: input.expectedVersion, leaseUntil: new Date(Date.now() + 120_000),
        payload: { requestHash: requestFingerprint(input), saleId: payment.checkoutId, amountCents: amountCents ?? null, environment: payment.dpoMode }, reference } });
      if (amountCents) {
        await tx.paymentRefund.create({ data: { paymentId: payment.id, operationId: operation.id, amountCents, currency: payment.currency, reference: reference!, status: "reserved" } });
        // Prevent any new supplier claim while the financial disposition is unresolved.
        if (payment.checkoutId) await tx.checkoutSession.update({ where: { id: payment.checkoutId }, data: { fulfillmentHold: "refund_pending" } });
      }
      await tx.auditLog.create({ data: { action: `operations.${input.kind}.started`, entityType: "PaymentTransaction", entityId: payment.id, details: JSON.stringify({ actor: actorEmail, operationId: operation.id, reason: input.reason, amountCents, reference, environment: payment.dpoMode }) } });
      return { operation, fresh: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) throw new OperationError("This sale changed or another action is in progress. Refresh before acting.");
    throw error;
  }
}

export type FinanceDependencies = { dpo?: Pick<DpoClient, "verifyTransaction" | "mutateTransaction"> };
export async function inspectPayment(db: PrismaClient, paymentId: string, dependencies: FinanceDependencies = {}) {
  const payment = await db.paymentTransaction.findUniqueOrThrow({ where: { id: paymentId } });
  const client = dependencies.dpo ?? resolveDpoClient(payment.dpoMode);
  const evidence = await client.verifyTransaction(payment.transactionToken ?? "", payment.checkoutId ?? undefined);
  const code = evidence.resultCode ?? evidence.status;
  if (["000", "001"].includes(code) && (retailAmountToCents(evidence.amount) !== payment.amountCents || evidence.currency?.toUpperCase() !== payment.currency.toUpperCase())) throw new OperationError("Provider amount or currency does not match the original payment.");
  const committed = await commitPaymentTransition(db, { paymentId, status: paymentState(code), providerCode: code, source: "admin-verify", payload: JSON.stringify({ code, amount: evidence.amount, currency: evidence.currency }) });
  if (["approved", "declined", "expired", "cancelled"].includes(committed.status)) {
    const pending = await db.adminOperation.findMany({ where: { targetId: paymentId, kind: { in: ["capture", "cancel_payment"] }, status: { in: ["provider_pending", "unknown"] } } });
    for (const op of pending) {
      const succeeded = op.kind === "capture" ? committed.status === "approved" : committed.status === "cancelled";
      await finishOperation(db, op, succeeded ? "succeeded" : "rejected", code);
    }
  }
  return { payment, code, client };
}

export async function confirmRefund(db: PrismaClient, refundId: string, actorEmail: string, evidence: string) {
  const refund = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT p.id FROM "PaymentTransaction" p JOIN "PaymentRefund" r ON r."paymentId"=p.id WHERE r.id=${refundId} FOR UPDATE OF p`;
    const current = await tx.paymentRefund.findUniqueOrThrow({ where: { id: refundId }, include: { payment: true } });
    if (current.status === "rejected") throw new OperationError("A rejected refund cannot be confirmed.");
    const updated = await tx.paymentRefund.update({ where: { id: current.id }, data: { status: "confirmed", confirmedAt: current.confirmedAt ?? new Date(), evidence: current.evidence ?? evidence.slice(0, 500) } });
    const balance = await refundBalance(tx, current.paymentId);
    if (current.payment.checkoutId) await tx.checkoutSession.update({ where: { id: current.payment.checkoutId }, data: { fulfillmentHold: balance.confirmed >= current.payment.amountCents ? "refunded" : balance.reserved > balance.confirmed ? "refund_pending" : null } });
    return { ...updated, checkoutId: current.payment.checkoutId };
  });
  // Independent, idempotent accounting reconciliation. A ledger outage cannot erase a successful refund.
  const sale = refund.checkoutId ? await db.checkoutSession.findUnique({ where: { id: refund.checkoutId } }) : null;
  if (sale?.affiliateId && sale.affiliateRateBps) await recordAffiliateSaleRefund({ checkoutId: sale.id, saleRefundCents: refund.amountCents, reference: refund.reference, reason: evidence, actorEmail }, db);
  await db.paymentRefund.update({ where: { id: refund.id }, data: { accountingAppliedAt: new Date() } });
}

export async function runPaymentOperation(db: PrismaClient, input: OperationInput, actorEmail: string, dependencies: FinanceDependencies = {}) {
  requireFeature(input.kind);
  const { operation, fresh } = await startPaymentOperation(db, input, actorEmail);
  if (!fresh) return operationResult(operation);
  let mutationStarted = false;
  try {
    if (input.kind === "record_refund") {
      const refund = await db.paymentRefund.findUniqueOrThrow({ where: { operationId: operation.id } });
      await confirmRefund(db, refund.id, actorEmail, `External provider evidence: ${input.reference}; ${input.reason}`);
      return operationResult(await finishOperation(db, operation, "succeeded", "external_refund_recorded"));
    }
    const { payment, code, client } = await inspectPayment(db, input.targetId, dependencies);
    if (input.kind === "verify_payment") return { ...operationResult(await finishOperation(db, operation, "succeeded", code)), message: `Verification completed. Provider status: ${paymentState(code)} (${code}).` };
    if (input.kind === "capture" && code !== "001") throw new OperationError("Fresh provider verification no longer shows an authorization. No capture was submitted.");
    if (input.kind === "refund" && code !== "000") throw new OperationError("Fresh provider verification did not confirm the captured payment. Reconcile before refunding.");
    if (input.kind === "cancel_payment" && !["001", "003", "005", "900"].includes(code)) throw new OperationError("Fresh provider verification does not show an eligible unpaid transaction.");
    mutationStarted = true;
    const refund = input.kind === "refund" ? await db.paymentRefund.findUniqueOrThrow({ where: { operationId: operation.id } }) : null;
    const result = await client.mutateTransaction(input.kind === "cancel_payment" ? "cancel" : input.kind as "capture" | "refund", payment.transactionToken ?? "", { amountCents: refund?.amountCents, reference: operation.reference ?? undefined, reason: input.reason });
    if (!result.accepted && !result.alreadyCharged) {
      if (refund) await rejectRefund(db, refund.id);
      return operationResult(await finishOperation(db, operation, "rejected", result.code));
    }
    if (refund) {
      await confirmRefund(db, refund.id, actorEmail, `DPO refund response ${result.code}; ${operation.reference}`);
      return operationResult(await finishOperation(db, operation, "succeeded", result.code));
    }
    // A successful capture is queued, never independently paid by this response.
    return operationResult(await finishOperation(db, operation, "provider_pending", result.code));
  } catch (error) {
    const refund = await db.paymentRefund.findUnique({ where: { operationId: operation.id } });
    if (refund && refund.status !== "confirmed") {
      if (mutationStarted) await db.paymentRefund.update({ where: { id: refund.id }, data: { status: "unknown" } });
      else await rejectRefund(db, refund.id);
    }
    const updated = await finishOperation(db, operation, mutationStarted || refund?.status === "confirmed" ? "unknown" : "rejected", mutationStarted ? "provider_or_persistence_unknown" : "preflight_failed");
    if (!mutationStarted && error instanceof OperationError) throw error;
    return operationResult(updated);
  }
}

export async function rejectRefund(db: PrismaClient, id: string) {
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT p.id FROM "PaymentTransaction" p JOIN "PaymentRefund" r ON r."paymentId"=p.id WHERE r.id=${id} FOR UPDATE OF p`;
    const refund = await tx.paymentRefund.findUniqueOrThrow({ where: { id }, include: { payment: true } });
    if (refund.status === "confirmed") throw new OperationError("A confirmed refund cannot be rejected.");
    await tx.paymentRefund.update({ where: { id }, data: { status: "rejected" } });
    const balance = await refundBalance(tx, refund.paymentId);
    if (refund.payment.checkoutId) await tx.checkoutSession.update({ where: { id: refund.payment.checkoutId }, data: { fulfillmentHold: balance.confirmed >= balance.payment.amountCents ? "refunded" : balance.reserved > balance.confirmed ? "refund_pending" : null } });
  });
}

export async function reconcileAdminOperations(db: PrismaClient) {
  await db.adminOperation.updateMany({ where: { status: "running", leaseUntil: { lt: new Date() } }, data: { status: "unknown", resultCode: "execution_lease_expired" } });
  await db.paymentCallbackDiagnostic.deleteMany({ where: { receivedAt: { lt: new Date(Date.now() - 30 * 86400000) } } });
  const replacements = await db.adminOperation.findMany({ where: { kind: "replace_order", status: { in: ["provider_pending", "unknown"] }, reference: { not: null } }, orderBy: { updatedAt: "asc" }, take: 5 });
  for (const operation of replacements) {
    const order = await db.esimOrder.findUnique({ where: { id: operation.reference! }, include: { saleCheckout: true, profiles: true } });
    if (order?.status === "completed" && order.orderNumber && (order.saleCheckout?.intent === "top-up" || order.profiles.length)) await finishOperation(db, operation, "succeeded", "replacement_confirmed");
    else if (order?.status === "airalo_rejected") await finishOperation(db, operation, "rejected", "replacement_rejected");
  }
  const operations = await db.adminOperation.findMany({ where: { kind: { in: ["capture", "cancel_payment"] }, status: { in: ["provider_pending", "unknown"] } }, take: 5, orderBy: { updatedAt: "asc" } });
  for (const operation of operations) {
    try {
      const { code } = await inspectPayment(db, operation.targetId);
      const done = operation.kind === "capture" ? code === "000" : code === "904";
      if (done) await finishOperation(db, operation, "succeeded", code);
    } catch { /* Read-only reconciliation remains eligible on the next tick. */ }
  }
  const refunds = await db.paymentRefund.findMany({ where: { status: "confirmed", OR: [{ accountingAppliedAt: null }, { operation: { status: { in: ["unknown", "running"] } } }] }, include: { operation: true }, take: 5, orderBy: { createdAt: "asc" } });
  for (const refund of refunds) {
    try { await confirmRefund(db, refund.id, refund.operation.actorEmail, refund.evidence ?? "Confirmed provider refund"); if (refund.operation.status !== "succeeded") await finishOperation(db, refund.operation, "succeeded", "refund_and_accounting_confirmed"); }
    catch { /* Keep confirmed provider evidence; accounting is retried independently. */ }
  }
}
