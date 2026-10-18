import assert from "node:assert/strict";
import test from "node:test";

import type { StorefrontCountry, StorefrontPlan } from "./storefront";
import {
  extractCoverageDestinations,
  extractNetworkNames,
  extractNetworkTypes,
  mapStorefrontPlan,
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

test("code-only supplier coverage uses country names and keeps explicit supplier names", () => {
  assert.deepEqual(extractCoverageDestinations([
    { code: "ZA", name: "ZA", networks: [] },
    { code: "KE", name: "KE", networks: [{ name: "Safaricom" }] },
    { code: "TZ", networks: [] },
    { code: "UG", name: "Uganda", networks: [] },
    { country_code: "CI", title: "Côte d'Ivoire" },
  ]), [
    { name: "Côte d'Ivoire", code: "CI", slug: "cote-d-ivoire" },
    { name: "Kenya", code: "KE", slug: "kenya" },
    { name: "South Africa", code: "ZA", slug: "south-africa" },
    { name: "Tanzania", code: "TZ", slug: "tanzania" },
    { name: "Uganda", code: "UG", slug: "uganda" },
  ]);
});

test("Safari coverage merging preserves names and lists only actual covered countries", () => {
  const record = {
    id: "safari", airaloPackageId: "safarilink-in-30days-20gb", title: "20 GB - 30 Days",
    amount: 20480, data: "20 GB", day: 30, isUnlimited: false, updatedAt: new Date(),
    state: { sellingPriceCents: 4000, currencyCode: "USD", lastSyncedAt: new Date() },
    operator: {
      title: "Safarilink", planType: "data", activationPolicy: "first-usage", installWindowDays: 365,
      country: { id: "safari", title: "Africa Safari", slug: "africa-safari", countryCode: "AIRALO-AFRICA-SAFARI" },
      countriesJson: [
        { country_code: "KE", title: "Kenya" },
        { country_code: "TZ", title: "Tanzania" },
        { country_code: "UG", title: "Uganda" },
      ],
      coveragesJson: [
        { code: "KE", name: "KE", networks: [{ name: "Safaricom", types: ["4G"] }] },
        { code: "TZ", name: "TZ", networks: [{ name: "Airtel", types: ["4G"] }] },
        { code: "UG", name: "UG", networks: [{ name: "Airtel", types: ["4G"] }] },
      ],
    },
  } as unknown as Parameters<typeof mapStorefrontPlan>[0];
  const plan = mapStorefrontPlan(record);
  assert.deepEqual(plan.coverage.map(entry => entry.name), ["Kenya", "Tanzania", "Uganda"]);
  assert.equal(plan.coverageVerified, true);
  assert.equal(plan.hotspot, null);
  assert.equal(planCoversDestination(plan, country("Tanzania", "tanzania", "TZ")), true);

  const unverified = mapStorefrontPlan({ ...record, operator: { ...record.operator, countriesJson: null, coveragesJson: null } });
  assert.deepEqual(unverified.coverage, []);
  assert.equal(unverified.coverageVerified, false);
});
