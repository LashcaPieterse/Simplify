export const REFERRAL_DAYS = 30;
export const HOLD_DAYS = 30;
export const TERMS_VERSION = "2026-10-18-v2";
export const DAY_MS = 86_400_000;

export function commissionAmount(saleCents: number, rateBps: number): number {
  if (!Number.isSafeInteger(saleCents) || saleCents < 0 || !Number.isInteger(rateBps) || rateBps < 1 || rateBps > 10000) {
    throw new Error("Invalid commission amount or rate.");
  }
  return Number((BigInt(saleCents) * BigInt(rateBps) + BigInt(5000)) / BigInt(10000));
}

export function refundCommission(originalSaleCents: number, rateBps: number, refundedCents: number): number {
  if (!Number.isSafeInteger(refundedCents) || refundedCents < 0 || refundedCents > originalSaleCents) {
    throw new Error("Refund exceeds the original sale.");
  }
  return commissionAmount(originalSaleCents, rateBps) - commissionAmount(originalSaleCents - refundedCents, rateBps);
}

export function percentageToBps(value: string, optional = false): number | null {
  if (optional && !value.trim()) return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(value.trim())) throw new Error("Enter a percentage with at most two decimal places.");
  const rate = Math.round(Number(value) * 100);
  if (rate < 1 || rate > 10000) throw new Error("Commission must be between 0.01% and 100%.");
  return rate;
}

export function normalizeAffiliateCode(value: string): string {
  return value.trim().toUpperCase();
}

export function safeReferralDestination(value?: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\%\u0000-\u0020]/.test(value)) return "/destinations";
  const url = new URL(value, "https://sim.africa");
  if (url.origin !== "https://sim.africa") return "/destinations";
  if (!/^\/(?:$|destinations\/?$|regional-esims\/?$|route-builder\/?$|(?:country|bundle|plan)\/[a-z0-9-]+\/?$)/.test(url.pathname)) return "/destinations";
  // Public destinations do not need arbitrary query parameters or fragments.
  return url.pathname;
}

export function isSelfReferral(guide: { userId: string; userEmail: string }, buyer: { userId?: string | null; email?: string | null }): boolean {
  return guide.userId === buyer.userId || Boolean(buyer.email && guide.userEmail.trim().toLowerCase() === buyer.email.trim().toLowerCase());
}

export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
