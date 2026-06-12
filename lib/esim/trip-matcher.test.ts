import assert from "node:assert/strict";
import test from "node:test";

import type { EsimProductSummary } from "../sanity.queries";
import { matchTripPlans } from "./trip-matcher";

function product({
  id,
  name,
  country,
  price,
  dataMb,
  validityDays,
  active = true,
  keywords = [],
}: {
  id: string;
  name: string;
  country: string;
  price: number;
  dataMb: number;
  validityDays: number;
  active?: boolean;
  keywords?: string[];
}): EsimProductSummary {
  return {
    _id: id,
    displayName: name,
    slug: id,
    priceUSD: price,
    shortDescription: `${country} travel eSIM`,
    status: active ? "active" : "archived",
    keywords,
    country: {
      _id: `country-${country.toLowerCase()}`,
      title: country,
      slug: country.toLowerCase().replace(/\s+/g, "-"),
    },
    price: {
      amount: price,
      currency: "USD",
      source: "airalo",
    },
    package: active
      ? {
          id: `pkg-${id}`,
          externalId: `airalo-${id}`,
          title: name,
          currency: "USD",
          priceCents: price * 100,
          isActive: true,
          dataLimitMb: dataMb,
          validityDays,
          region: null,
          lastSyncedAt: null,
          metadata: null,
          operator: {
            _id: `operator-${id}`,
            title: `${country} Mobile`,
            slug: `${country.toLowerCase()}-mobile`,
          },
        }
      : {
          id: `pkg-${id}`,
          externalId: `airalo-${id}`,
          title: name,
          currency: "USD",
          priceCents: price * 100,
          isActive: false,
          dataLimitMb: dataMb,
          validityDays,
          region: null,
          lastSyncedAt: null,
          metadata: null,
        },
  };
}

test("exact country match wins over unrelated cheaper products", () => {
  const result = matchTripPlans({
    destination: "Kenya",
    durationDays: 7,
    usageProfileId: "light",
    products: [
      product({ id: "uganda-cheap", name: "Uganda 1GB", country: "Uganda", price: 2, dataMb: 1024, validityDays: 7 }),
      product({ id: "kenya", name: "Kenya 2GB", country: "Kenya", price: 12, dataMb: 2048, validityDays: 7 }),
    ],
  });

  assert.equal(result.primary?.product._id, "kenya");
});

test("featured products rank first when no destination is entered", () => {
  const result = matchTripPlans({
    destination: "",
    durationDays: 7,
    usageProfileId: "light",
    highlightedProductIds: ["featured"],
    products: [
      product({ id: "cheap", name: "Ghana 1GB", country: "Ghana", price: 1, dataMb: 1024, validityDays: 7 }),
      product({ id: "featured", name: "Uganda 2GB", country: "Uganda", price: 10, dataMb: 2048, validityDays: 7 }),
    ],
  });

  assert.equal(result.primary?.product._id, "featured");
});

test("cheapest and more-data alternatives are distinct when possible", () => {
  const result = matchTripPlans({
    destination: "Uganda",
    durationDays: 7,
    usageProfileId: "social",
    products: [
      product({ id: "balanced", name: "Uganda 5GB", country: "Uganda", price: 12, dataMb: 5120, validityDays: 7 }),
      product({ id: "cheap", name: "Uganda 1GB", country: "Uganda", price: 3, dataMb: 1024, validityDays: 7 }),
      product({ id: "more-data", name: "Uganda 10GB", country: "Uganda", price: 24, dataMb: 10240, validityDays: 15 }),
    ],
  });

  assert.ok(result.primary);
  assert.ok(result.alternatives.cheapest);
  assert.ok(result.alternatives.moreData);
  assert.notEqual(result.alternatives.cheapest?.product._id, result.primary?.product._id);
  assert.notEqual(result.alternatives.moreData?.product._id, result.primary?.product._id);
  assert.notEqual(result.alternatives.cheapest?.product._id, result.alternatives.moreData?.product._id);
});

test("inactive or missing-package products are excluded", () => {
  const missingPackage = product({
    id: "missing-package",
    name: "Rwanda 1GB",
    country: "Rwanda",
    price: 1,
    dataMb: 1024,
    validityDays: 7,
  });
  missingPackage.package = null;

  const result = matchTripPlans({
    destination: "Rwanda",
    durationDays: 7,
    usageProfileId: "light",
    products: [
      product({ id: "inactive", name: "Rwanda inactive", country: "Rwanda", price: 1, dataMb: 2048, validityDays: 7, active: false }),
      missingPackage,
      product({ id: "active", name: "Rwanda 3GB", country: "Rwanda", price: 10, dataMb: 3072, validityDays: 7 }),
    ],
  });

  assert.equal(result.primary?.product._id, "active");
});

test("longer trips prefer plans with sufficient validity", () => {
  const result = matchTripPlans({
    destination: "Ghana",
    durationDays: 30,
    usageProfileId: "light",
    products: [
      product({ id: "short", name: "Ghana 10GB 7 days", country: "Ghana", price: 8, dataMb: 10240, validityDays: 7 }),
      product({ id: "long", name: "Ghana 10GB 30 days", country: "Ghana", price: 20, dataMb: 10240, validityDays: 30 }),
    ],
  });

  assert.equal(result.primary?.product._id, "long");
});

test("no-match state returns no primary recommendation", () => {
  const result = matchTripPlans({
    destination: "Brazil",
    durationDays: 7,
    usageProfileId: "light",
    products: [
      product({ id: "kenya", name: "Kenya 2GB", country: "Kenya", price: 8, dataMb: 2048, validityDays: 7 }),
    ],
  });

  assert.equal(result.primary, null);
});
