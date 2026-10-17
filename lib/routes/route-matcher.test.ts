import assert from "node:assert/strict";
import test from "node:test";

import type { StorefrontCountry, StorefrontPlan } from "@/lib/catalog/storefront";
import { findSmallestRouteCombination } from "./route-matcher";

function country(title: string, code: string): StorefrontCountry {
  const slug = title.toLowerCase().replace(/\s+/g, "-");
  return {
    id: slug,
    title,
    slug,
    countryCode: code,
    image: null,
    planCount: 1,
    minimumPrice: { amount: 10, currency: "USD" },
  };
}

function plan(
  id: string,
  destination: StorefrontCountry,
  coverage: StorefrontCountry[],
  regional = false,
): StorefrontPlan {
  return {
    id,
    externalId: id,
    title: id,
    destination,
    isRegional: regional,
    dataLabel: "10 GB",
    dataAmountMb: 10240,
    isUnlimited: false,
    validityDays: 30,
    price: { amount: 10, cents: 1000, currency: "USD" },
    operatorName: null,
    networks: [],
    networkTypes: [],
    hotspot: null,
    callsAndSms: null,
    callsMinutes: null,
    texts: null,
    includesPhoneNumber: null,
    topUpAvailable: null,
    activationPolicy: null,
    installWindowDays: null,
    apn: null,
    coverage: coverage.map((item) => ({
      name: item.title,
      code: item.countryCode,
      slug: item.slug,
    })),
    coverageVerified: true,
    fairUsagePolicy: null,
    shortInfo: null,
    otherInfo: null,
    lastSyncedAt: null,
  };
}

test("route matcher uses a partial regional plan when it reduces package count", () => {
  const kenya = country("Kenya", "KE");
  const uganda = country("Uganda", "UG");
  const tanzania = country("Tanzania", "TZ");
  const region = country("East Africa", "EA");
  const localPlans = [kenya, uganda, tanzania].map((item) =>
    plan(`local-${item.slug}`, item, [item]),
  );

  const result = findSmallestRouteCombination({
    destinations: [kenya, uganda, tanzania],
    regionalPlans: [plan("kenya-uganda", region, [kenya, uganda], true)],
    localPlans,
    days: 14,
    requiredDataMb: 5000,
  });

  assert.equal(result?.matches.length, 2);
  assert.deepEqual(
    result?.matches.map((match) => match.plan.id).sort(),
    ["kenya-uganda", "local-tanzania"],
  );
});

test("route matcher excludes unverified regional coverage", () => {
  const kenya = country("Kenya", "KE");
  const uganda = country("Uganda", "UG");
  const region = country("East Africa", "EA");
  const unverified = {
    ...plan("unverified", region, [kenya, uganda], true),
    coverageVerified: false,
  };

  const result = findSmallestRouteCombination({
    destinations: [kenya, uganda],
    regionalPlans: [unverified],
    localPlans: [
      plan("local-kenya", kenya, [kenya]),
      plan("local-uganda", uganda, [uganda]),
    ],
    days: 7,
    requiredDataMb: 1000,
  });

  assert.equal(result?.matches.length, 2);
  assert.equal(result?.matches.some((match) => match.plan.id === "unverified"), false);
});

test("route matcher returns no result when one destination has no verified plan", () => {
  const kenya = country("Kenya", "KE");
  const uganda = country("Uganda", "UG");
  const result = findSmallestRouteCombination({
    destinations: [kenya, uganda],
    regionalPlans: [],
    localPlans: [plan("local-kenya", kenya, [kenya])],
    days: 7,
    requiredDataMb: 1000,
  });
  assert.equal(result, null);
});
