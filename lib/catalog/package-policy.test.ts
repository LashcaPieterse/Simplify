import assert from "node:assert/strict";
import test from "node:test";

import { configuredSellingPriceWhere, freshCatalogPriceWhere, isPublicSellablePackageRecord } from "./package-policy";

function makeRecord(sellingPriceCents: number | null, overrides: { type?: string; active?: boolean } = {}) {
  return {
    type: overrides.type ?? "sim",
    state: {
      isActive: overrides.active ?? true,
      sellingPriceCents,
    },
    operator: {
      country: {
        countryCode: "MG",
        slug: "madagascar",
      },
    },
  };
}

test("configuredSellingPriceWhere requires a positive storefront price", () => {
  assert.match(JSON.stringify(configuredSellingPriceWhere()), /"gt":0/);
});

test("freshCatalogPriceWhere requires a recent successful package sync timestamp", () => {
  const now = new Date("2026-08-22T12:00:00.000Z");
  const where = freshCatalogPriceWhere(now);
  assert.match(JSON.stringify(where), /lastSyncedAt/);
  assert.match(JSON.stringify(where), /2026-08-20T12:00:00.000Z/);
});

test("public package policy rejects zero and missing prices", () => {
  assert.equal(isPublicSellablePackageRecord(makeRecord(0)), false);
  assert.equal(isPublicSellablePackageRecord(makeRecord(-100)), false);
  assert.equal(isPublicSellablePackageRecord(makeRecord(null)), false);
  assert.equal(isPublicSellablePackageRecord(makeRecord(700)), true);
});

test("public package policy rejects inactive and top-up packages", () => {
  assert.equal(isPublicSellablePackageRecord(makeRecord(700, { active: false })), false);
  assert.equal(isPublicSellablePackageRecord(makeRecord(700, { type: "topup" })), false);
});
