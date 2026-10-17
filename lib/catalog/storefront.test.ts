import assert from "node:assert/strict";
import test from "node:test";

import type { StorefrontCountry, StorefrontPlan } from "./storefront";
import {
  extractCoverageDestinations,
  extractNetworkNames,
  extractNetworkTypes,
  planCoversDestination,
  planCoversEveryDestination,
} from "./storefront";

function country(title: string, slug: string, countryCode: string): StorefrontCountry {
  return {
    id: slug,
    title,
    slug,
    countryCode,
    image: null,
    planCount: 1,
    minimumPrice: { amount: 10, currency: "USD" },
  };
}

const regionalPlan = {
  coverageVerified: true,
  coverage: [
    { name: "Kenya", slug: "kenya", code: "KE" },
    { name: "Uganda", slug: "uganda", code: "UG" },
  ],
} as StorefrontPlan;

test("coverage validation only accepts destinations explicitly listed by the supplier", () => {
  assert.equal(planCoversDestination(regionalPlan, country("Uganda", "uganda", "UG")), true);
  assert.equal(planCoversDestination(regionalPlan, country("Canary Islands", "canary-islands", "ES-XCI")), false);
});

test("route coverage requires every selected country and verified regional coverage", () => {
  const selected = [
    country("Kenya", "kenya", "KE"),
    country("Uganda", "uganda", "UG"),
  ];

  assert.equal(planCoversEveryDestination(regionalPlan, selected), true);
  assert.equal(
    planCoversEveryDestination(
      { ...regionalPlan, coverageVerified: false },
      selected,
    ),
    false,
  );
  assert.equal(
    planCoversEveryDestination(regionalPlan, [
      ...selected,
      country("Tanzania", "tanzania", "TZ"),
    ]),
    false,
  );
});

test("documented Airalo coverage entries are parsed without treating carriers as countries", () => {
  const payload = [
    {
      name: "Kenya",
      code: "KE",
      networks: [{ name: "Safaricom", types: ["4G", "5G"] }],
    },
    {
      name: "Uganda",
      code: "UG",
      networks: [{ name: "Airtel Uganda", types: ["LTE"] }],
    },
  ];

  assert.deepEqual(extractCoverageDestinations(payload), [
    { name: "Kenya", code: "KE", slug: "kenya" },
    { name: "Uganda", code: "UG", slug: "uganda" },
  ]);
  assert.deepEqual(extractNetworkNames(payload), ["Airtel Uganda", "Safaricom"]);
  assert.deepEqual(extractNetworkTypes(payload), ["5G", "4G", "LTE"]);
});

test("network generations are not inferred from free-form negative claims", () => {
  assert.deepEqual(
    extractNetworkTypes({
      note: "5G is not supported; this package may use 4G depending on coverage.",
      networks: [{ name: "Example carrier", types: ["LTE"] }],
    }),
    ["LTE"],
  );
});
