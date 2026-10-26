import { orderDisposition } from "../orders/fulfillment-disposition";
import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prepareOrderReceipt } from "./receipts";
import { sendEmail, EmailSendError, type SendEmailOptions } from "./email";
import { retryAt } from "../jobs/store";

type Db = PrismaClient | Prisma.TransactionClient;
export async function queueOrderReceipt(db: Db, orderId: string) {
  const order = await db.esimOrder.findUnique({ where: { id: orderId }, select: { receiptSentAt: true, saleCheckout: { select: { intent: true } }, checkout: { select: { intent: true } } } });
  if (!order || (order.saleCheckout ?? order.checkout)?.intent === "top-up") return null;
  return db.receiptDelivery.upsert({ where: { businessKey: `receipt:${orderId}:v1` }, update: {}, create: {
    businessKey: `receipt:${orderId}:v1`, orderId,
    ...(order.receiptSentAt ? { status: "review", lastError: "legacy_acceptance_unconfirmed" } : {}),
  } });
}

export async function deliverReceipt(db: PrismaClient, id: string, options: { now?: Date; send?: typeof sendEmail; baseUrl?: string } = {}) {
  const now = options.now ?? new Date();
  const leaseToken = randomUUID();
  const claimed = await db.$transaction(async tx => {
    const delivery = await tx.receiptDelivery.findUnique({ where: { id }, select: { orderId: true } });
    if (!delivery) return { count: 0 };
    const context = await orderDisposition(tx, delivery.orderId);
    if (context.sale) await tx.$queryRaw`SELECT id FROM "CheckoutSession" WHERE id=${context.sale.id} FOR UPDATE`;
    const current = await orderDisposition(tx, delivery.orderId);
    if (current.blocked || current.order?.ownershipReviewRequired) return { count: 0 };
    return tx.receiptDelivery.updateMany({ where: { id, nextAttemptAt: { lte: now },
      OR: [{ status: "pending" }, { status: "leased", leaseUntil: { lte: now } }] }, data: {
        status: "leased", leaseToken, leaseUntil: new Date(now.getTime() + 120_000), attempts: { increment: 1 },
      } });
  });
  if (!claimed.count) return "busy";
  const job = await db.receiptDelivery.findUniqueOrThrow({ where: { id } });
  const where = { id, leaseToken, status: "leased" };
  const release = async (status: string, code: string, acceptanceUnknown = job.acceptanceUnknown) => {
    await db.receiptDelivery.updateMany({ where, data: { status, leaseToken: null, leaseUntil: null,
      nextAttemptAt: retryAt(job.attempts, now), lastError: code, acceptanceUnknown } });
    return status;
  };
  const disposition = await orderDisposition(db, job.orderId);
  if (disposition.blocked) return release(disposition.permanent ? "superseded" : "pending", "delivery_held_or_superseded");
  let acceptanceUnknown = job.acceptanceUnknown;
  if (job.acceptanceUnknown && job.firstAttemptAt && now.getTime() - job.firstAttemptAt.getTime() >= 23 * 3_600_000) {
    return release("review", "idempotency_window_exceeded");
  }
  try {
    let payload = job.payload as unknown as SendEmailOptions | null;
    if (!payload) {
      const prepared = await prepareOrderReceipt(job.orderId, { prisma: db, baseUrl: options.baseUrl });
      if (!("payload" in prepared)) return release(prepared.reason === "already_sent" ? "review" : "pending", prepared.reason ?? "not_ready", job.acceptanceUnknown);
      payload = prepared.payload;
      const saved = await db.receiptDelivery.updateMany({ where, data: { payload: payload as unknown as Prisma.InputJsonValue } });
      if (!saved.count) return "busy";
    }
    // Persist the uncertainty BEFORE the network call, including a crash after acceptance.
    const ready = await db.receiptDelivery.updateMany({ where, data: { firstAttemptAt: job.acceptanceUnknown ? job.firstAttemptAt : now, acceptanceUnknown: true } });
    if (!ready.count) return "busy";
    acceptanceUnknown = true;
    const result = await (options.send ?? sendEmail)({ ...payload, idempotencyKey: job.businessKey, timeoutMs: 8000 });
    if (result.skipped) return release("pending", "email_unavailable", job.acceptanceUnknown);
    if (!result.id) return release("pending", "acceptance_unknown", true);
    await db.$transaction(async tx => {
      const saved = await tx.receiptDelivery.updateMany({ where, data: { status: "accepted", acceptedAt: now,
        providerMessageId: result.id, acceptanceUnknown: false, leaseToken: null, leaseUntil: null, lastError: null } });
      if (!saved.count) throw new Error("Receipt lease changed.");
      await tx.esimOrder.update({ where: { id: job.orderId }, data: { receiptSentAt: now, receiptEmail: Array.isArray(payload.to) ? payload.to[0] : payload.to } });
    });
    return "accepted";
  } catch (error) {
    const definite = error instanceof EmailSendError && error.definitelyRejected;
    // A rejection now cannot disprove acceptance of an earlier lost response.
    return release(error instanceof EmailSendError && error.requiresReview ? "review" : "pending", definite ? "email_rejected" : "send_or_persistence_unknown", job.acceptanceUnknown || (!definite && acceptanceUnknown));
  }
}

export async function deliverReceipts(db: PrismaClient, limit = 5, deadline = Date.now() + 240_000) {
  const now = new Date();
  const due = await db.receiptDelivery.findMany({ where: { nextAttemptAt: { lte: now }, OR: [{ status: "pending" }, { status: "leased", leaseUntil: { lte: now } }] }, orderBy: { nextAttemptAt: "asc" }, take: limit });
  const summary = { checked: 0, accepted: 0, pending: 0, review: 0, failed: 0 };
  for (const job of due) {
    if (Date.now() + 10_000 > deadline) break;
    const result = await deliverReceipt(db, job.id);
    summary.checked++;
    if (result === "accepted") summary.accepted++; else if (result === "review") summary.review++; else summary.pending++;
    if (result === "pending") {
      const current = await db.receiptDelivery.findUnique({ where: { id: job.id }, select: { lastError: true } });
      if (["email_unavailable", "email_rejected", "send_or_persistence_unknown"].includes(current?.lastError ?? "")) summary.failed++;
    }
  }
  return summary;
}

export async function reviewReceipt(db: PrismaClient, input: { id: string; action: "confirm" | "resend"; actor: string; reason: string; providerMessageId?: string }) {
  if (!input.reason.trim() || (input.action === "confirm" && !input.providerMessageId?.trim())) throw new Error("A reason and acceptance evidence are required.");
  return db.$transaction(async tx => {
    const job = await tx.receiptDelivery.findUniqueOrThrow({ where: { id: input.id } });
    if ((await orderDisposition(tx, job.orderId)).blocked) throw new Error("Delivery is held or superseded.");
    if (job.status !== "review") throw new Error("Only a receipt awaiting review can be resolved.");
    // Serialize repeated operator actions. A resend must create exactly one new key.
    const claimed = await tx.receiptDelivery.updateMany({ where: { id: job.id, status: "review" }, data: { status: input.action === "confirm" ? "accepted" : "superseded", providerMessageId: input.providerMessageId, acceptedAt: input.action === "confirm" ? new Date() : null } });
    if (!claimed.count) throw new Error("Receipt review changed; refresh.");
    if (input.action === "resend") {
      await tx.receiptDelivery.create({ data: { businessKey: `receipt:${job.orderId}:operator:${randomUUID()}`, orderId: job.orderId } });
      await tx.esimOrder.update({ where: { id: job.orderId }, data: { receiptSentAt: null } });
    } else await tx.esimOrder.update({ where: { id: job.orderId }, data: { receiptSentAt: new Date() } });
    await tx.auditLog.create({ data: { action: `receipt.${input.action}`, entityType: "ReceiptDelivery", entityId: job.id,
      details: JSON.stringify({ actor: input.actor, reason: input.reason.trim().slice(0, 500), providerMessageId: input.providerMessageId }) } });
  });
}
