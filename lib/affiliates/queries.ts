import type { PrismaClient } from "@prisma/client";
import prisma from "../db/client";
import { affiliateBalances } from "./payouts";

/** The caller supplies the authenticated user ID; no user ID is accepted from a guide request. */
export async function getGuideDashboard(userId: string, db: PrismaClient = prisma) {
  const profile = await db.affiliateProfile.findUnique({ where: { userId } });
  if (!profile) return null;
  const [ledger, commissions, payouts, salesCount] = await Promise.all([
    db.affiliateLedgerEntry.findMany({ where: { affiliateId: profile.id }, select: { amountCents: true, currency: true, availableAt: true, commission: { select: { onHold: true } }, allocations: { select: { releasedAt: true, payout: { select: { status: true } } } } } }),
    db.affiliateCommission.findMany({ where: { affiliateId: profile.id }, orderBy: { createdAt: "desc" }, take: 50, select: {
      id: true, orderId: true, saleCents: true, rateBps: true, commissionCents: true, refundedSaleCents: true, currency: true, availableAt: true, fulfilledAt: true, onHold: true,
      checkout: { select: { intent: true, package: { select: { title: true } } } },
    } }),
    db.affiliatePayout.findMany({ where: { affiliateId: profile.id }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, amountCents: true, currency: true, period: true, status: true, paidAt: true, transferReference: true, note: true } }),
    db.checkoutSession.count({ where: { affiliateId: profile.id, payments: { some: { status: "approved" } } } }),
  ]);
  return { profile, balances: affiliateBalances(ledger), commissions, payouts, salesCount };
}

export function supplierCostCents(raw: unknown, currency: string): number | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entry = Object.entries(raw).find(([key]) => key.toUpperCase() === currency)?.[1];
  const value = typeof entry === "number" ? entry : entry && typeof entry === "object" ? (entry as Record<string, unknown>).amount ?? (entry as Record<string, unknown>).value ?? (entry as Record<string, unknown>).price : null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}
