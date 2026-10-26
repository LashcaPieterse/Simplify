import { Prisma, type PrismaClient } from "@prisma/client";
import prisma from "../db/client";
import { resolveReceiptDeliveryDetails } from "../notifications/receipts";
import { affiliateInfrastructureEnabled } from "./referral";
import { commissionAmount, DAY_MS, HOLD_DAYS, refundCommission } from "./rules";

export async function affiliateTransaction<T>(db: PrismaClient, run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (attempt >= 3 || (code !== "P2034" && code !== "P2002")) throw error;
    }
  }
}

export function auditAffiliate(tx: Prisma.TransactionClient, actorEmail: string, action: string, entityId: string, details: Record<string, unknown> = {}) {
  return tx.auditLog.create({ data: { action: `affiliate.${action}`, entityType: "affiliate", entityId, details: JSON.stringify({ ...details, actorEmail }) } });
}

function installationReady(payload: string | null | undefined, activationCode?: string | null): boolean {
  try {
    const parsed = payload ? JSON.parse(payload) : null;
    return resolveReceiptDeliveryDetails(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null, activationCode).ready;
  } catch { return false; }
}

/** Run inside the supplier persistence transaction, independently of email or ledger delivery. */
export async function stampAffiliateFulfilment(tx: Prisma.TransactionClient, orderId: string, now = new Date()) {
  if (!affiliateInfrastructureEnabled()) return;
  const record = await tx.esimOrder.findUnique({ where: { id: orderId }, include: { checkout: { include: { activeOrder: { include: { profiles: true, installation: true } } } }, saleCheckout: { include: { activeOrder: { include: { profiles: true, installation: true } } } }, profiles: true, installation: true } });
  const checkout = record?.saleCheckout ?? record?.checkout;
  if (!record || !checkout?.affiliateId || checkout.fulfillmentHold) return;
  const order = checkout.activeOrder ?? record;
  if (order.status !== "completed" || !order.orderNumber) return;
  if (checkout.intent === "top-up") {
    if (!checkout.topUpForOrderId || !checkout.topUpForIccid || checkout.affiliateSource !== "original-order") return;
    const original = await tx.esimOrder.findFirst({ where: { id: checkout.topUpForOrderId, profiles: { some: { iccid: checkout.topUpForIccid } } }, select: { checkout: { select: { intent: true, affiliateId: true } }, saleCheckout: { select: { intent: true, affiliateId: true } } } });
    const source = original?.saleCheckout ?? original?.checkout;
    if (source?.intent !== "purchase" || source.affiliateId !== checkout.affiliateId) return;
  } else if (checkout.intent !== "purchase" || !order.profiles.length || !installationReady(order.installation?.payload, order.profiles[0]?.activationCode)) return;
  // The original sale owns the commission; a replacement never earns a second one.
  await tx.esimOrder.updateMany({ where: { id: checkout.orderId ?? order.id, fulfilledAt: null }, data: { fulfilledAt: now } });

}

export async function accrueCommissionForOrder(orderId: string, db: PrismaClient = prisma, now = new Date()) {
  if (!affiliateInfrastructureEnabled()) return null;
  return affiliateTransaction(db, async tx => {
    await stampAffiliateFulfilment(tx, orderId, now);
    const record = await tx.esimOrder.findUnique({ where: { id: orderId }, include: { checkout: true, payment: true, saleCheckout: { include: { order: { include: { payment: true, checkout: true } } } } } });
    const order = record?.saleCheckout?.order ?? record;
    const checkout = order?.checkout;
    const payment = order?.payment;
    if (checkout?.fulfillmentHold || !order?.fulfilledAt || !checkout?.affiliateId || !checkout.affiliateRateBps || !["purchase", "top-up"].includes(checkout.intent) || !payment || payment.status !== "approved" || payment.checkoutId !== checkout.id || payment.amountCents !== checkout.totalCents || payment.currency !== checkout.currency) return null;
    const existing = await tx.affiliateCommission.findUnique({ where: { checkoutId: checkout.id } });
    if (existing) return existing;
    const amount = commissionAmount(checkout.totalCents, checkout.affiliateRateBps);
    const adjustments = await tx.affiliateSaleAdjustment.findMany({ where: { checkoutId: checkout.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    const refundedSaleCents = adjustments.reduce((sum, adjustment) => sum + adjustment.saleRefundCents, 0);
    refundCommission(checkout.totalCents, checkout.affiliateRateBps, refundedSaleCents);
    const availableAt = new Date(order.fulfilledAt.getTime() + HOLD_DAYS * DAY_MS);
    const commission = await tx.affiliateCommission.create({ data: {
      checkoutId: checkout.id, orderId: order.id, affiliateId: checkout.affiliateId,
      currency: checkout.currency, saleCents: checkout.totalCents, rateBps: checkout.affiliateRateBps,
      commissionCents: amount, fulfilledAt: order.fulfilledAt, availableAt,
      refundedSaleCents,
    } });
    await tx.affiliateLedgerEntry.create({ data: {
      affiliateId: commission.affiliateId, commissionId: commission.id, kind: "commission", amountCents: amount,
      currency: commission.currency, availableAt, idempotencyKey: `commission:${checkout.id}`,
    } });
    let refunded = 0;
    for (const adjustment of adjustments) {
      const before = refundCommission(commission.saleCents, commission.rateBps, refunded);
      refunded += adjustment.saleRefundCents;
      const deduction = refundCommission(commission.saleCents, commission.rateBps, refunded) - before;
      await tx.affiliateLedgerEntry.create({ data: {
        affiliateId: commission.affiliateId, commissionId: commission.id, adjustmentId: adjustment.id,
        kind: "refund", amountCents: -deduction, currency: commission.currency, availableAt,
        reason: adjustment.reason, reference: adjustment.reference, saleRefundCents: adjustment.saleRefundCents, idempotencyKey: adjustment.idempotencyKey,
      } });
    }
    return commission;
  });
}

export async function safelyAccrueCommission(orderId: string, db: PrismaClient = prisma) {
  try { await accrueCommissionForOrder(orderId, db); }
  catch { console.error("affiliate.commission.reconciliation_required", { orderId }); }
}

export async function reconcileAffiliateCommissions(db: PrismaClient = prisma, limit = 25) {
  if (!affiliateInfrastructureEnabled()) return { checked: 0, failed: 0 };
  const candidates = await db.checkoutSession.findMany({
    where: { affiliateId: { not: null }, affiliateCommission: null, intent: { in: ["purchase", "top-up"] }, OR: [{ order: { is: { OR: [{ fulfilledAt: { not: null } }, { status: "completed" }] } } }, { activeOrder: { is: { status: "completed" } } }] },
    select: { id: true, orderId: true }, orderBy: [{ affiliateCheckedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }], take: limit,
  });
  let failed = 0;
  for (const candidate of candidates) {
    try { if (candidate.orderId) await accrueCommissionForOrder(candidate.orderId, db); }
    catch { failed++; console.error("affiliate.commission.reconciliation_failed", { checkoutId: candidate.id }); }
    finally { await db.checkoutSession.update({ where: { id: candidate.id }, data: { affiliateCheckedAt: new Date() } }); }
  }
  return { checked: candidates.length, failed };
}

/** The amount is the newly refunded sale amount, not the cumulative total. */
export async function recordAffiliateRefund(input: { commissionId: string; saleRefundCents: number; reference: string; reason: string; actorEmail: string }, db: PrismaClient = prisma) {
  const commission = await db.affiliateCommission.findUniqueOrThrow({ where: { id: input.commissionId }, select: { checkoutId: true } });
  return recordAffiliateSaleRefund({ ...input, checkoutId: commission.checkoutId }, db);
}

export async function recordAffiliateSaleRefund(input: { checkoutId: string; saleRefundCents: number; reference: string; reason: string; actorEmail: string }, db: PrismaClient = prisma) {
  if (!Number.isSafeInteger(input.saleRefundCents) || input.saleRefundCents <= 0 || !input.reference.trim() || !input.reason.trim()) throw new Error("Enter a positive refund amount, external reference, and reason.");
  return affiliateTransaction(db, async tx => {
    const key = `refund:${input.checkoutId}:${input.reference.trim()}`;
    const duplicate = await tx.affiliateSaleAdjustment.findUnique({ where: { idempotencyKey: key } });
    if (duplicate) {
      if (duplicate.saleRefundCents !== input.saleRefundCents) throw new Error("That refund reference was already recorded with a different amount.");
      return duplicate;
    }
    await tx.$queryRaw`SELECT id FROM "CheckoutSession" WHERE id=${input.checkoutId} FOR UPDATE`;
    const checkout = await tx.checkoutSession.findUniqueOrThrow({ where: { id: input.checkoutId }, include: { affiliateCommission: true, affiliateAdjustments: true } });
    const journal = await tx.paymentRefund.findMany({ where: { payment: { checkoutId: checkout.id }, status: { in: ["reserved", "unknown", "confirmed"] } }, select: { reference: true, amountCents: true } });
    const recorded = new Set(checkout.affiliateAdjustments.map(adjustment => adjustment.reference));
    const unrecorded = journal.filter(refund => refund.reference !== input.reference.trim() && !recorded.has(refund.reference)).reduce((sum, refund) => sum + refund.amountCents, 0);
    if (checkout.affiliateAdjustments.reduce((sum, adjustment) => sum + adjustment.saleRefundCents, 0) + input.saleRefundCents + unrecorded > checkout.totalCents) throw new Error("Refund exceeds the sale balance including reserved refunds.");
    await tx.checkoutSession.update({ where: { id: checkout.id }, data: { updatedAt: new Date() } });
    if (!checkout.affiliateId || !checkout.affiliateRateBps) throw new Error("This checkout has no affiliate attribution.");
    const totalRefunded = checkout.affiliateAdjustments.reduce((sum, item) => sum + item.saleRefundCents, 0) + input.saleRefundCents;
    refundCommission(checkout.totalCents, checkout.affiliateRateBps, totalRefunded);
    const adjustment = await tx.affiliateSaleAdjustment.create({ data: { checkoutId: checkout.id, saleRefundCents: input.saleRefundCents, reference: input.reference.trim(), reason: input.reason.trim(), actorEmail: input.actorEmail, idempotencyKey: key } });
    const commission = checkout.affiliateCommission;
    if (!commission) {
      await auditAffiliate(tx, input.actorEmail, "refund_before_fulfilment", checkout.id, { reference: input.reference, saleRefundCents: input.saleRefundCents });
      return adjustment;
    }
    // Prepared exports may be stale after a refund. Release them before recording the adjustment.
    const prepared = await tx.affiliatePayout.findMany({ where: { affiliateId: commission.affiliateId, currency: commission.currency, status: "prepared" } });
    for (const payout of prepared) {
      await tx.affiliatePayout.update({ where: { id: payout.id }, data: { status: "cancelled", note: "Cancelled because a refund changed the available balance." } });
      await tx.affiliatePayoutAllocation.updateMany({ where: { payoutId: payout.id, releasedAt: null }, data: { releasedAt: new Date() } });
      await auditAffiliate(tx, input.actorEmail, "payout_cancelled_for_refund", payout.id);
    }
    const previousDeduction = refundCommission(commission.saleCents, commission.rateBps, commission.refundedSaleCents);
    const deduction = refundCommission(commission.saleCents, commission.rateBps, totalRefunded) - previousDeduction;
    await tx.affiliateCommission.update({ where: { id: commission.id }, data: { refundedSaleCents: totalRefunded } });
    const entry = await tx.affiliateLedgerEntry.create({ data: {
      affiliateId: commission.affiliateId, commissionId: commission.id, kind: "refund", amountCents: -deduction,
      currency: commission.currency, availableAt: commission.availableAt, reason: input.reason.trim(), reference: input.reference.trim(), adjustmentId: adjustment.id,
      saleRefundCents: input.saleRefundCents, idempotencyKey: key,
    } });
    await auditAffiliate(tx, input.actorEmail, "refund_recorded", commission.id, { reference: input.reference, saleRefundCents: input.saleRefundCents, deductionCents: deduction });
    return entry;
  });
}

export async function setCommissionHold(id: string, onHold: boolean, reason: string, actorEmail: string, db: PrismaClient = prisma) {
  if (!reason.trim()) throw new Error("A review reason is required.");
  return affiliateTransaction(db, async tx => {
    const allocated = await tx.affiliatePayoutAllocation.count({ where: { releasedAt: null, ledgerEntry: { commissionId: id }, payout: { status: { in: ["prepared", "processing"] } } } });
    if (allocated) throw new Error("Cancel the prepared payout or reconcile its processing transfer before changing this hold.");
    await tx.affiliateCommission.update({ where: { id }, data: { onHold, holdReason: reason.trim() } });
    await auditAffiliate(tx, actorEmail, onHold ? "commission_held" : "commission_released", id, { reason });
  });
}
