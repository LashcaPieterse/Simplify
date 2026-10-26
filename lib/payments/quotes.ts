import { createHash, randomUUID } from "node:crypto";
import type { AiraloClient } from "../airalo/client";
import type { CheckoutQuote, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { CURRENCIES, displayRetailPrice, type Currency } from "../currency";
import prisma from "../db/client";
import { findActivePackageByIdentifier, type PackageWithPrice } from "../catalog/package-resolver";
import { isCatalogPriceFresh, resolveRetailPrices } from "../catalog/retail-prices";
import { getTopUpPackages } from "../orders/topups";
import { logOrderError } from "../observability/logging";
import { CheckoutRequestError } from "./checkout-request";

export const QUOTE_SESSION_COOKIE = "sim-africa-quote-session";
export const QUOTE_TTL_MS = 15 * 60 * 1000;
export const quoteInputSchema = z.object({
  packageId: z.string().min(1),
  quantity: z.literal(1).default(1),
  currency: z.enum(CURRENCIES).default("USD"),
  intent: z.enum(["purchase", "top-up"]).default("purchase"),
  topUpForOrderId: z.string().min(1).optional(),
});
export type QuoteInput = z.input<typeof quoteInputSchema>;
export type QuoteOwner = { userId?: string; guestSessionId?: string };
export type QuoteSummary = {
  id: string; displayCents: number; displayCurrency: string;
  totalCents: number; currency: string; expiresAt: string;
};

export function assertNewCheckoutEnabled() {
  if (process.env.CHECKOUT_CREATION_ENABLED === "false") throw new CheckoutRequestError("New payments are temporarily unavailable. Existing orders are still being processed.", 503);
}

export function newQuoteSessionId() { return randomUUID(); }
function sessionHash(value: string) { return createHash("sha256").update(value).digest("hex"); }

export function assertQuoteOwner(quote: Pick<CheckoutQuote, "userId" | "guestSessionHash">, owner: QuoteOwner) {
  const matches = quote.userId
    ? quote.userId === owner.userId
    : Boolean(owner.guestSessionId && quote.guestSessionHash === sessionHash(owner.guestSessionId));
  if (!matches) throw new CheckoutRequestError("This quote is not available in this session.", 403);
}

export function quotePriceSnapshot(pkg: Pick<PackageWithPrice, "id" | "pricesRecommendedRetailPrice">) {
  const prices = resolveRetailPrices(pkg.pricesRecommendedRetailPrice);
  return createHash("sha256").update(JSON.stringify({ id: pkg.id, prices })).digest("hex");
}

export function assertQuotePrice(quote: CheckoutQuote, pkg: PackageWithPrice, now = new Date()) {
  if (quote.expiresAt <= now || !isCatalogPriceFresh(pkg.state?.lastSyncedAt, now) ||
    quote.catalogSnapshot !== quotePriceSnapshot(pkg)) {
    throw new CheckoutRequestError("The price quote has expired or changed. Review the refreshed price before paying.", 409, "quoteId");
  }
  const prices = resolveRetailPrices(pkg.pricesRecommendedRetailPrice);
  const display = prices && displayRetailPrice(prices, quote.displayCurrency as Currency);
  if (!prices || !display || quote.currency !== "NAD" || quote.sourceZarCents !== prices.NAD ||
    quote.totalCents !== prices.NAD || quote.displayCents !== display.cents || quote.displayCurrency !== display.currency || quote.quantity !== 1) {
    throw new CheckoutRequestError("This package has no valid NAD price. Please choose another plan.", 409, "quoteId");
  }
}

export async function validateTopUpContext(input: { packageId: string; topUpForOrderId?: string; topUpForIccid?: string | null }, owner: QuoteOwner, db: PrismaClient, airaloClient?: AiraloClient) {
  if (!owner.userId || !input.topUpForOrderId) throw new CheckoutRequestError("Sign in to the original order to purchase a top-up.", 403);
  const order = await db.esimOrder.findFirst({ where: { id: input.topUpForOrderId, userId: owner.userId, ownershipReviewRequired: false }, include: { profiles: true } });
  const iccid = order?.profiles[0]?.iccid;
  if (!iccid || (input.topUpForIccid && input.topUpForIccid !== iccid)) throw new CheckoutRequestError("This eSIM is not available for top-up.", 403);
  const packages = await getTopUpPackages(iccid, { prisma: db, airaloClient });
  if (!packages.some(pkg => pkg.localPackageId === input.packageId || pkg.id === input.packageId)) throw new CheckoutRequestError("This top-up is not eligible for the selected eSIM.", 422);
  return iccid;
}

export async function createCheckoutQuote(rawInput: QuoteInput, owner: QuoteOwner, db: PrismaClient = prisma, options: { airaloClient?: AiraloClient } = {}): Promise<QuoteSummary> {
  assertNewCheckoutEnabled();
  if ((await db.operationsSettings.findUnique({ where: { id: "operations" } }))?.checkoutPaused) throw new CheckoutRequestError("New payments are temporarily unavailable. Existing orders are still being processed.", 503);
  const input = quoteInputSchema.parse(rawInput);
  if (!owner.userId && !owner.guestSessionId) throw new CheckoutRequestError("A checkout session is required.", 403);
  const pkg = await findActivePackageByIdentifier(db, input.packageId, input.intent === "top-up" ? { packageType: "topup", activeOnly: true, publicCatalogOnly: false } : undefined);
  const prices = pkg && resolveRetailPrices(pkg.pricesRecommendedRetailPrice);
  const display = prices && displayRetailPrice(prices, input.currency);
  if (!pkg || !prices?.NAD || !display || !isCatalogPriceFresh(pkg.state?.lastSyncedAt)) {
    logOrderError("payments.quote.price_unavailable", { packageId: input.packageId, missingZar: !prices?.NAD, staleCatalog: pkg ? !isCatalogPriceFresh(pkg.state?.lastSyncedAt) : false });
    throw new CheckoutRequestError("This package has no current NAD retail price. Please choose another plan.", 422);
  }
  const iccid = input.intent === "top-up" ? await validateTopUpContext({ ...input, packageId: pkg.id }, owner, db, options.airaloClient) : null;
  const quote = await db.checkoutQuote.create({ data: {
    userId: owner.userId ?? null,
    guestSessionHash: owner.userId ? null : sessionHash(owner.guestSessionId!),
    packageId: pkg.id, quantity: 1, intent: input.intent,
    topUpForOrderId: input.intent === "top-up" ? input.topUpForOrderId : null, topUpForIccid: iccid,
    displayCents: display.cents, displayCurrency: display.currency,
    sourceZarCents: prices.NAD, totalCents: prices.NAD, currency: "NAD",
    catalogSnapshot: quotePriceSnapshot(pkg), expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
  } });
  return { id: quote.id, displayCents: quote.displayCents, displayCurrency: quote.displayCurrency, totalCents: quote.totalCents, currency: quote.currency, expiresAt: quote.expiresAt.toISOString() };
}
