import type { PrismaClient } from "@prisma/client";
import { enqueueJob } from "../jobs/store";

export function paymentState(code: string): string {
  switch (code) {
    case "000": return "approved";
    case "001": return "authorized";
    case "003": case "005": case "900": return "pending";
    case "007": return "partially_paid";
    case "901": return "declined";
    case "903": return "expired";
    case "904": return "cancelled";
    case "002": case "902": return "verification_mismatch";
    default: return "verification_error";
  }
}

/** Approval dominates older provider observations. Every accepted state has an atomic event. */
export async function commitPaymentTransition(db: PrismaClient, input: {
  paymentId: string; status: string; providerCode: string; explanation?: string; source: string; payload: string;
}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = await db.$transaction(async tx => {
      const payment = await tx.paymentTransaction.findUniqueOrThrow({ where: { id: input.paymentId } });
      if (payment.status === "approved" && input.status !== "approved") return payment;
      if (payment.status === input.status && payment.providerCode === input.providerCode) return payment;
      const version = payment.version + 1;
      const at = new Date();
      // Transitional compatibility for existing readers; reconstructed under the same CAS.
      let history: unknown[] = [];
      try { const parsed: unknown = JSON.parse(payment.statusHistory ?? "[]"); if (Array.isArray(parsed)) history = parsed; } catch { /* Events are authoritative. */ }
      history.push({ status: input.status, at: at.toISOString(), source: input.source });
      const changed = await tx.paymentTransaction.updateMany({ where: { id: payment.id, version: payment.version }, data: {
        status: input.status, providerCode: input.providerCode, providerExplanation: input.explanation?.slice(0, 500) ?? null,
        version, approvedAt: input.status === "approved" ? payment.approvedAt ?? at : payment.approvedAt,
        statusHistory: JSON.stringify(history),
      } });
      if (!changed.count) return null;
      await tx.paymentTransactionEvent.create({ data: { transactionId: payment.id, eventType: `${input.source}-transition`,
        fromStatus: payment.status, toStatus: input.status, transitionVersion: version, payload: input.payload } });
      if (input.status === "approved" && payment.checkoutId) {
        await tx.checkoutSession.update({ where: { id: payment.checkoutId }, data: { status: "paid" } });
        await enqueueJob(tx, "fulfill_checkout", payment.checkoutId);
      } else if (payment.checkoutId && ["declined", "expired", "cancelled"].includes(input.status)) {
        await tx.checkoutSession.update({ where: { id: payment.checkoutId }, data: { status: "failed" } });
      }
      return { ...payment, status: input.status, providerCode: input.providerCode, version };
    });
    if (result) return result;
  }
  throw new Error("Payment changed concurrently; retry verification.");
}
