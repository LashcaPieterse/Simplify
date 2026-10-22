import { Prisma } from "@prisma/client";
import { CURRENCIES, type RetailPrices } from "../currency";

export function retailAmountToCents(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") return null;
  try {
    const amount = new Prisma.Decimal(value);
    if (!amount.isFinite() || !amount.isPositive()) return null;
    const cents = amount.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
    return Number.isSafeInteger(cents) && cents > 0 && cents <= 2147483647 ? cents : null;
  } catch { return null; }
}

/** Values are integer cents. NAD deliberately takes the package's ZAR retail value. */
export function resolveRetailPrices(raw: unknown): RetailPrices | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const map = raw as Record<string, unknown>;
  const nad = retailAmountToCents(map.ZAR);
  if (nad === null) return null;
  const prices: RetailPrices = { NAD: nad, ZAR: nad };
  for (const currency of CURRENCIES) {
    if (currency === "NAD" || currency === "ZAR") continue;
    const cents = retailAmountToCents(map[currency]);
    if (cents !== null) prices[currency] = cents;
  }
  return prices;
}

export function isCatalogPriceFresh(lastSyncedAt: Date | null | undefined, now = new Date()): boolean {
  const configured = Number(process.env.CATALOG_MAX_AGE_HOURS ?? 48);
  const hours = Number.isFinite(configured) && configured > 0 ? Math.min(configured, 720) : 48;
  return Boolean(lastSyncedAt && lastSyncedAt.getTime() >= now.getTime() - hours * 3600000);
}
