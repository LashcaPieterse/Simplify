"use server";
import type { Route } from "next";
import { headers } from "next/headers";
import { enforceRates, trustedClientIp } from "@/lib/security/rate-limit";
import { redirect } from "next/navigation";
import { requireAdminSession, revokeAdminSessions, clearAdminSession, validateAdminCredentials } from "@/lib/auth";
import prisma from "@/lib/db/client";
import { reviewReceipt } from "@/lib/notifications/receipt-outbox";

export async function revokeAllAdminSessions(form: FormData) {
  const session = await requireAdminSession();
  await enforceRates([{ scope: "admin-security-password", identifier: trustedClientIp(await headers()), limit: 5, windowSeconds: 900 }]);
  if (form.get("confirmation") !== "on" || !validateAdminCredentials(session.email, String(form.get("password") ?? ""))) throw new Error("Confirm the administrator password and session revocation.");
  await revokeAdminSessions(session.email);
  await clearAdminSession();
  redirect("/admin/login");
}

export async function resolveReceipt(form: FormData) {
  const session = await requireAdminSession();
  const action = form.get("action");
  if (action !== "confirm" && action !== "resend") throw new Error("Invalid action.");
  await reviewReceipt(prisma, { id: String(form.get("id") ?? ""), action, actor: session.email,
    reason: String(form.get("reason") ?? "").slice(0, 500), providerMessageId: String(form.get("providerMessageId") ?? "").slice(0, 200) || undefined });
  redirect("/admin/security" as Route);
}

export async function resolveOwnership(form: FormData) {
  const session = await requireAdminSession();
  const orderId = String(form.get("orderId") ?? "");
  const reason = String(form.get("reason") ?? "").trim().slice(0, 500);
  if (!reason || form.get("evidenceConfirmed") !== "on") throw new Error("Confirm independent ownership evidence and record a reason.");
  await prisma.$transaction(async tx => {
    const order = await tx.esimOrder.findUniqueOrThrow({ where: { id: orderId }, include: { user: true, checkout: true } });
    if (!order.user?.emailProofAt || order.user.recoveryRequired || !order.ownershipReviewRequired) throw new Error("Fresh account proof and an ownership review are required.");
    await tx.esimOrder.update({ where: { id: order.id }, data: { ownershipReviewRequired: false } });
    if (order.checkout?.userId === order.userId) await tx.checkoutSession.update({ where: { id: order.checkout.id }, data: { ownershipReviewRequired: false } });
    if (order.paymentTransactionId) await tx.paymentTransaction.updateMany({ where: { id: order.paymentTransactionId, userId: order.userId }, data: { ownershipReviewRequired: false } });
    await tx.auditLog.create({ data: { action: "identity.ownership-reviewed", entityType: "EsimOrder", entityId: order.id, details: JSON.stringify({ actor: session.email, reason }) } });
  });
  redirect("/admin/security" as Route);
}
