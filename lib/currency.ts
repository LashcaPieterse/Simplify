export const CURRENCIES = ["USD", "NAD", "ZAR", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];
export type RetailPrices = Partial<Record<Currency, number>>;
export const CURRENCY_COOKIE = "sim-africa-currency";
export const CURRENCY_COOKIE_SECONDS = 365 * 24 * 60 * 60;

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

export function displayRetailPrice(prices: RetailPrices, currency: Currency) {
  const actualCurrency = prices[currency] ? currency : "NAD";
  const cents = prices[actualCurrency];
  return typeof cents === "number" && cents > 0
    ? { cents, amount: cents / 100, currency: actualCurrency }
    : null;
}
