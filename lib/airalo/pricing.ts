import type { Package } from "./schemas";

interface ExtractedPriceDetails {
  priceCents: number;
  currency: string | null;
}

type MultiCurrencyPriceDetails =
  Package["net_prices"] extends Record<string, infer T> ? T : never;

export interface ResolvedPriceDetails {
  priceCents: number;
  currency: string;
}

function coerceNumericValue(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric;
}

function extractPriceFromDetails(
  details: MultiCurrencyPriceDetails | undefined,
): ExtractedPriceDetails | null {
  if (!details || typeof details !== "object") {
    return null;
  }

  const record = details as Record<string, unknown>;

  const amount =
    coerceNumericValue(record.amount) ??
    coerceNumericValue(record.value) ??
    coerceNumericValue(record.price);

  if (amount === null) {
    return null;
  }

  const currency = record.currency;

  if (currency && typeof currency === "string") {
    return {
      priceCents: Math.round(amount * 100),
      currency: currency.toUpperCase(),
    } satisfies ExtractedPriceDetails;
  }

  return {
    priceCents: Math.round(amount * 100),
    currency: null,
  } satisfies ExtractedPriceDetails;
}

function resolvePriceFromMap(
  prices: Package["net_prices"],
): ResolvedPriceDetails | null {
  if (!prices) {
    return null;
  }

  const normalizedEntries = Object.entries(prices).filter(
    (entry): entry is [string, MultiCurrencyPriceDetails] =>
      entry[1] !== undefined && entry[1] !== null,
  );

  if (normalizedEntries.length === 0) {
    return null;
  }

  const usdEntry = normalizedEntries.find(
    ([key]) => key.toUpperCase() === "USD",
  );

  const preferredEntry = usdEntry ?? normalizedEntries[0];

  const extracted = extractPriceFromDetails(preferredEntry[1]);
  if (!extracted) {
    return null;
  }

  const currency = extracted.currency ?? preferredEntry[0];

  return {
    priceCents: extracted.priceCents,
    currency: currency.toUpperCase(),
  } satisfies ResolvedPriceDetails;
}

export function resolvePackagePrice(
  pkg: Package,
): ResolvedPriceDetails | null {
  if (pkg.price !== undefined && pkg.price !== null && pkg.currency) {
    return {
      priceCents: Math.round(pkg.price * 100),
      currency: pkg.currency.toUpperCase(),
    } satisfies ResolvedPriceDetails;
  }

  const multiCurrency =
    resolvePriceFromMap(pkg.net_prices) ??
    resolvePriceFromMap(pkg.recommended_retail_prices);

  if (!multiCurrency) {
    return null;
  }

  if (!multiCurrency.currency) {
    return {
      priceCents: multiCurrency.priceCents,
      currency: "USD",
    } satisfies ResolvedPriceDetails;
  }

  return multiCurrency;
}
