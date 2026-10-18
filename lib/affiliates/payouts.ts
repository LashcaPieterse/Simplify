import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import prisma from "../db/client";
import { affiliateTransaction, auditAffiliate } from "./accounting";

export async function prepareAffiliatePayout(affiliateId: string, currency: string, actorEmail: string, db: PrismaClient = prisma, now = new Date()) {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Choose a valid earnings currency.");
  return affiliateTransaction(db, async tx => {
    await tx.affiliateProfile.findUniqueOrThrow({ where: { id: affiliateId } });
    const existing = await tx.affiliatePayout.findFirst({ where: { affiliateId, currency, status: { in: ["prepared", "processing"] } } });
    if (existing) throw new Error("Reconcile or cancel the existing payout for this guide and currency first.");
    // Negative entries count immediately; held or immature positive earnings cannot fund a payout.
    const entries = await tx.affiliateLedgerEntry.findMany({ where: {
      affiliateId, currency, availableAt: { lte: now }, allocations: { none: { releasedAt: null } },
      OR: [{ amountCents: { lte: 0 } }, { commission: { onHold: false } }],
    }, orderBy: { createdAt: "asc" } });
    const amountCents = entries.reduce((total, entry) => total + entry.amountCents, 0);
    if (amountCents <= 0) throw new Error("There is no positive available balance to pay. Deferred and negative balances carry forward.");
    if (!Number.isSafeInteger(amountCents) || amountCents > 2147483647) throw new Error("This balance exceeds the supported single-payout amount.");
    const payout = await tx.affiliatePayout.create({ data: {
      affiliateId, currency, amountCents, period: now.toISOString().slice(0, 7), preparedBy: actorEmail,
      allocations: { create: entries.map(entry => ({ ledgerEntryId: entry.id })) },
    } });
    await auditAffiliate(tx, actorEmail, "payout_prepared", payout.id, { affiliateId, currency, amountCents });
    return payout;
  });
}

export type PayoutTransition = {
  id: string;
  action: "processing" | "paid" | "cancelled";
  actorEmail: string;
  note?: string;
  transferReference?: string;
  paidAt?: string;
  transferAmount?: string;
  transferCurrency?: string;
  exchangeRate?: string;
  fees?: string;
  confirmedNotSent?: boolean;
};

export function validateSettlement(input: PayoutTransition) {
  if (!input.transferReference?.trim() || input.transferReference.length > 200) throw new Error("Enter the external transfer reference.");
  const paidAt = input.paidAt ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(input.paidAt) ? `${input.paidAt}T00:00:00+02:00` : input.paidAt) : null;
  if (!paidAt || !Number.isFinite(paidAt.getTime()) || paidAt.getTime() > Date.now() + 60_000) throw new Error("Enter a valid payment date that is not in the future.");
  if (!/^[A-Z]{3}$/.test(input.transferCurrency ?? "")) throw new Error("Enter the three-letter transfer currency.");
  const decimal = (value: string | undefined, name: string, positive: boolean, precision: number) => {
    if (!value || !new RegExp(`^\\d{1,10}(\\.\\d{1,${precision}})?$`).test(value)) throw new Error(`Enter a valid ${name}.`);
    const amount = new Prisma.Decimal(value);
    if (positive ? amount.lte(0) : amount.lt(0)) throw new Error(`Enter a valid ${name}.`);
    return amount;
  };
  return {
    transferReference: input.transferReference.trim(), paidAt,
    transferAmount: decimal(input.transferAmount, "transfer amount", true, 6),
    transferCurrency: input.transferCurrency!, exchangeRate: decimal(input.exchangeRate, "exchange rate", true, 10),
    fees: decimal(input.fees, "fee amount", false, 6),
  };
}

export async function transitionAffiliatePayout(input: PayoutTransition, db: PrismaClient = prisma) {
  return affiliateTransaction(db, async tx => {
    const payout = await tx.affiliatePayout.findUniqueOrThrow({ where: { id: input.id } });
    if (payout.status === input.action) {
      if (input.action === "paid" && payout.transferReference !== input.transferReference?.trim()) throw new Error("This payout was already recorded with a different transfer reference.");
      return payout;
    }
    let settlement: ReturnType<typeof validateSettlement> | undefined;
    if (input.action === "processing") {
      if (payout.status !== "prepared") throw new Error("Only a prepared payout can start processing.");
    } else if (input.action === "paid") {
      if (payout.status !== "processing") throw new Error("Mark this payout processing before recording its completed transfer.");
      settlement = validateSettlement(input);
      if (settlement.fees.gt(settlement.transferAmount)) throw new Error("Fees cannot exceed the transfer amount.");
      const expected = new Prisma.Decimal(payout.amountCents).div(100).mul(settlement.exchangeRate);
      if (payout.currency === settlement.transferCurrency && !settlement.exchangeRate.eq(1)) throw new Error("Same-currency transfers must use an exchange rate of 1.");
      if (expected.sub(settlement.transferAmount).abs().gt("0.01")) throw new Error("Transfer amount does not match the payout and exchange rate (before fees).");
    } else if (input.action === "cancelled") {
      if (!["prepared", "processing"].includes(payout.status) || !input.note?.trim()) throw new Error("Only an unpaid payout can be cancelled, with a reason. For processing transfers, confirm no money was sent.");
      if (payout.status === "processing" && !input.confirmedNotSent) throw new Error("Confirm no money was sent before releasing a processing payout.");
      await tx.affiliatePayoutAllocation.updateMany({ where: { payoutId: payout.id, releasedAt: null }, data: { releasedAt: new Date() } });
    } else throw new Error("Invalid payout action.");
    const updated = await tx.affiliatePayout.update({ where: { id: payout.id }, data: { status: input.action, note: input.note?.trim() || payout.note, ...settlement } });
    await auditAffiliate(tx, input.actorEmail, `payout_${input.action}`, payout.id, { reference: input.transferReference, note: input.note });
    return updated;
  });
}

export async function deferAffiliatePayout(affiliateId: string, reason: string, actorEmail: string, db: PrismaClient = prisma) {
  if (!reason.trim()) throw new Error("Enter a reason for deferring payment.");
  await affiliateTransaction(db, async tx => {
    await tx.affiliateProfile.findUniqueOrThrow({ where: { id: affiliateId } });
    await auditAffiliate(tx, actorEmail, "payout_deferred", affiliateId, { reason: reason.trim() });
  });
}

export type BalanceEntry = { amountCents: number; currency: string; availableAt: Date; commission: { onHold: boolean }; allocations: Array<{ releasedAt: Date | null; payout: { status: string } }> };
export function affiliateBalances(entries: BalanceEntry[], now = new Date()) {
  const result = new Map<string, { currency: string; pending: number; available: number; reserved: number; paid: number }>();
  for (const entry of entries) {
    const row = result.get(entry.currency) ?? { currency: entry.currency, pending: 0, available: 0, reserved: 0, paid: 0 };
    const allocation = entry.allocations.find(item => !item.releasedAt);
    if (allocation?.payout.status === "paid") row.paid += entry.amountCents;
    else if (allocation) row.reserved += entry.amountCents;
    else if (entry.availableAt > now || (entry.amountCents > 0 && entry.commission.onHold)) row.pending += entry.amountCents;
    else row.available += entry.amountCents;
    result.set(entry.currency, row);
  }
  return Array.from(result.values());
}
