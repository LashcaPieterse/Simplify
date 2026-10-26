import { getServerSession } from "next-auth";
import type { PrismaClient } from "@prisma/client";
import prisma from "../db/client";
import { authOptions } from "../auth/options";
import { canAccessOwnerScopedRecord, hasScopedAccessFromCookieHeader, setScopedAccessCookie } from "../orders/access";
import { resolveReceiptDeliveryDetails } from "../notifications/receipts";
import { NextResponse } from "next/server";

export async function authorizedCheckout(request: Request, id: string, db: PrismaClient = prisma) {
  const checkout = await db.checkoutSession.findUnique({ where: { id }, include: {
    payments: { orderBy: { createdAt: "desc" }, take: 1 }, activeOrder: { include: { installation: true, profiles: true } }, order: { include: { installation: true, profiles: true } },
  } });
  if (!checkout) return null;
  const session = await getServerSession(authOptions);
  const scoped = hasScopedAccessFromCookieHeader(request.headers.get("cookie"), "checkout", id, checkout.accessVersion);
  return canAccessOwnerScopedRecord(checkout, session, scoped) ? checkout : null;
}

export async function checkoutStatusResponse(checkout: NonNullable<Awaited<ReturnType<typeof authorizedCheckout>>>, db: PrismaClient = prisma) {
  const order = checkout.activeOrder ?? checkout.order;
  const payment = checkout.payments[0];
  let payload = null;
  try { payload = order?.installation ? JSON.parse(order.installation.payload) : null; } catch { /* Missing readiness is not completion. */ }
  const ready = checkout.intent === "top-up" || Boolean(order?.profiles.length && resolveReceiptDeliveryDetails(payload, order.profiles[0]?.activationCode).ready);
  const isComplete = !checkout.fulfillmentHold && payment?.status === "approved" && order?.status === "completed" && Boolean(order.orderNumber) && ready;
  const redirectOrderId = isComplete ? (checkout.intent === "top-up" ? checkout.topUpForOrderId : order?.id) : null;
  const job = payment ? await db.lifecycleJob.findUnique({ where: { businessKey: `verify_payment:${payment.id}` } }) : null;
  const response = NextResponse.json({ checkoutId: checkout.id, status: checkout.status,
    paymentStatus: payment?.status ?? "creating", paymentUrl: payment?.redirectUrl,
    orderId: order?.id ?? null, redirectOrderId, isComplete,
    fulfillmentStatus: checkout.fulfillmentHold ?? (isComplete ? "completed" : order?.status ?? "awaiting_payment"),
    nextCheckAt: job && ["pending", "leased"].includes(job.status) ? job.nextAttemptAt.toISOString() : null,
    message: checkout.fulfillmentHold === "refunded" ? "This payment has been refunded. No new payment is required." : checkout.fulfillmentHold === "refund_pending" ? "A refund is being reconciled. Delivery is paused." : payment?.status === "authorized" ? "Payment authorized. We are checking completion; please do not pay again." : undefined,
  }, { headers: { "Cache-Control": "private, no-store" } });
  if (isComplete && redirectOrderId) {
    const target = redirectOrderId === order?.id ? order : await db.esimOrder.findUnique({ where: { id: redirectOrderId } });
    if (target) setScopedAccessCookie(response.cookies, "order", target.id, target.accessVersion);
  }
  return response;
}
