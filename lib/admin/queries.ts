import type { Prisma } from "@prisma/client";

export const PAGE_SIZE = 25;
export function activeDeliveryOrderWhere(): Prisma.EsimOrderWhereInput {
  return { OR: [{ checkout: { is: { activeOrderId: null, fulfillmentHold: null } } }, { activeForCheckout: { is: { fulfillmentHold: null } } }, { checkout: { is: null }, saleCheckout: { is: null } }] };
}
export function paymentAttentionWhere(now = new Date()): Prisma.PaymentTransactionWhereInput {
  return { provider: "dpo", status: { in: ["creating", "creation_unknown", "pending", "authorized", "partially_paid", "verification_error", "verification_mismatch"] }, createdAt: { lte: new Date(now.getTime() - 15 * 60_000) } };
}
export function receiptAttentionWhere(now = new Date()): Prisma.ReceiptDeliveryWhereInput {
  return { order: activeDeliveryOrderWhere(), OR: [{ status: "review" }, receiptOverdueWhere(now)] };
}
export function receiptOverdueWhere(now = new Date()): Prisma.ReceiptDeliveryWhereInput {
  return { status: { in: ["pending", "leased"] }, createdAt: { lte: new Date(now.getTime() - 10 * 60_000) }, order: { AND: [activeDeliveryOrderWhere(), { status: "completed", installation: { isNot: null } }] } };
}
export function supplierAttentionWhere(now = new Date()): Prisma.EsimOrderWhereInput {
  return { OR: [
    { status: { in: ["airalo_failed", "airalo_rejected", "airalo_outcome_unknown"] }, createdAt: { lte: new Date(now.getTime() - 5 * 60_000) } },
    { status: "airalo_submitting", createdAt: { lte: new Date(now.getTime() - 10 * 60_000) } },
    { status: "pending", recoveryAttempts: { some: { result: "unresolved" } }, createdAt: { lte: new Date(now.getTime() - 45 * 60_000) } },
  ] };
}
export function affiliateCommissionAttentionWhere(now = new Date()): Prisma.CheckoutSessionWhereInput {
  return { affiliateId: { not: null }, affiliateCommission: null, order: { is: { fulfilledAt: { lte: new Date(now.getTime() - 30 * 60_000) } } }, payments: { some: { status: "approved" } } };
}
export function affiliateNotificationAttentionWhere(now = new Date()): Prisma.AffiliateNotificationWhereInput {
  return { sentAt: null, createdAt: { lte: new Date(now.getTime() - 60 * 60_000) } };
}
export function paymentSearch(q: string): Prisma.PaymentTransactionWhereInput {
  const contains = { contains: q, mode: "insensitive" as const };
  return q ? { OR: [{ id: contains }, { providerReference: contains }, { checkoutId: contains }, { checkout: { customerEmail: contains } }, { orders: { some: orderSearch(q) } }] } : {};
}
export function orderSearch(q: string): Prisma.EsimOrderWhereInput {
  const contains = { contains: q, mode: "insensitive" as const };
  return q ? { OR: [{ package: { OR: [{ airaloPackageId: contains }, { title: contains }] } }, { id: contains }, { customerEmail: contains }, { orderNumber: contains }, { requestId: contains }, { profiles: { some: { iccid: contains } } }, { payment: { OR: [{ id: contains }, { providerReference: contains }, { checkoutId: contains }] } }] } : {};
}
export function listParams(params: Record<string, string | string[] | undefined>) {
  const value = (name: string) => typeof params[name] === "string" ? params[name] as string : "";
  return { q: value("q").trim().slice(0, 100), filter: value("filter"), page: Math.min(10000, Math.max(1, Number.parseInt(value("page"), 10) || 1)) };
}
export const orderDetailInclude = {
  package: { include: { operator: { include: { country: true } } } },
  payment: { include: { refunds: true } }, checkout: true, saleCheckout: true,
  user: { select: { email: true, emailProofAt: true, recoveryRequired: true } },
  profiles: { select: { id: true, iccid: true, status: true, activationCode: true } },
  installation: { select: { id: true, payload: true } },
  recoveryAttempts: { orderBy: { createdAt: "desc" as const }, take: 15 },
  receiptDeliveries: { orderBy: { createdAt: "desc" as const }, take: 30, select: { id: true, orderId: true, status: true, attempts: true, lastError: true, nextAttemptAt: true, leaseUntil: true, acceptanceUnknown: true, providerMessageId: true, acceptedAt: true, updatedAt: true, createdAt: true } },
  replacements: { select: { id: true, status: true, createdAt: true } },
} satisfies Prisma.EsimOrderInclude;

export function incidentDestination(category: string, entityId: string | null) {
  if (category === "financial_operation_review") return "/admin/audit?filter=unresolved";
  if (category === "payment_reconciliation_delayed") return "/admin/payments?filter=attention";
  if (category === "receipt_delivery_delayed") return "/admin/receipts?filter=attention";
  if (category === "supplier_manual_review" && entityId) return `/admin/orders/${encodeURIComponent(entityId)}`;
  if (category === "paid_checkout_undelivered" && entityId) return `/admin/payments?q=${encodeURIComponent(entityId)}`;
  if (category.startsWith("affiliate_")) return `/admin/affiliates/attention?filter=${category.includes("commission") ? "commissions" : "notifications"}`;
  return "/admin/health";
}

export function formatOpsTime(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Windhoek" }).format(value) + " CAT" : "Not recorded";
}
