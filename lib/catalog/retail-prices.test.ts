import assert from "node:assert/strict";
import test from "node:test";
import { CURRENCIES, displayRetailPrice } from "../currency";
import { isCatalogPriceFresh, resolveRetailPrices, retailAmountToCents } from "./retail-prices";

test("Airalo ZAR is the exact NAD retail amount for every display currency", () => {
  const prices = resolveRetailPrices({ USD: 15, EUR: 13.35, GBP: 11.25, ZAR: 246 })!;
  for (const currency of CURRENCIES) {
    assert.equal(prices.NAD, 24600);
    assert.ok(displayRetailPrice(prices, currency));
  }
  assert.deepEqual(displayRetailPrice(prices, "NAD"), { cents: 24600, amount: 246, currency: "NAD" });
  assert.equal(prices.ZAR, prices.NAD);
});

test("retail decimals round half-up without binary float errors", () => {
  assert.equal(retailAmountToCents("1.005"), 101);
  assert.equal(retailAmountToCents("246.125"), 24613);
  assert.equal(retailAmountToCents(1.005), 101);
  assert.equal(retailAmountToCents("0.004"), null);
  for (const value of [null, undefined, "", " ", "NaN", Infinity, -1, 0, {}, true, "21474836.48"]) assert.equal(retailAmountToCents(value), null);
});

test("missing ZAR cannot fall back to USD, NAD, wholesale or country minimums", () => {
  for (const raw of [{ USD: 15 }, { NAD: 246 }, { ZAR: 0 }, { ZAR: -1 }, { net_price: { ZAR: 100 } }, null]) assert.equal(resolveRetailPrices(raw), null);
  assert.deepEqual(displayRetailPrice(resolveRetailPrices({ ZAR: 246 })!, "GBP"), { cents: 24600, amount: 246, currency: "NAD" });
});

test("catalog freshness uses the configured limit and rejects absent sync timestamps", () => {
  const previous = process.env.CATALOG_MAX_AGE_HOURS;
  process.env.CATALOG_MAX_AGE_HOURS = "48";
  try {
    const now = new Date("2026-10-21T12:00:00Z");
    assert.equal(isCatalogPriceFresh(new Date("2026-10-19T12:00:00Z"), now), true);
    assert.equal(isCatalogPriceFresh(new Date("2026-10-19T11:59:59Z"), now), false);
    assert.equal(isCatalogPriceFresh(null, now), false);
  } finally { if (previous === undefined) delete process.env.CATALOG_MAX_AGE_HOURS; else process.env.CATALOG_MAX_AGE_HOURS = previous; }
});
