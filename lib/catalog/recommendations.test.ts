import assert from "node:assert/strict";
import test from "node:test";

import type { StorefrontPlan } from "./storefront";
import {
  estimateTripDataMb,
  recommendPlanForUsage,
} from "./recommendations";

function plan(
  id: string,
  dataAmountMb: number,
  validityDays: number,
  priceCents: number,
  isUnlimited = false,
): StorefrontPlan {
  return {
    id,
    externalId: id,
    title: id,
    destination: {
      id: "kenya",
      title: "Kenya",
      slug: "kenya",
      countryCode: "KE",
      image: null,
      planCount: 1,
      minimumPrice: { amount: priceCents / 100, currency: "USD" },
    },
    isRegional: false,
    dataLabel: isUnlimited ? "Unlimited" : `${dataAmountMb} MB`,
    dataAmountMb,
    isUnlimited,
    validityDays,
    price: { amount: priceCents / 100, cents: priceCents, currency: "USD" },
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
    coverage: [{ name: "Kenya", code: "KE", slug: "kenya" }],
    coverageVerified: true,
    fairUsagePolicy: null,
    shortInfo: null,
    otherInfo: null,
    lastSyncedAt: null,
  };
}

test("usage estimates are explicit and bounded to supported trip lengths", () => {
  assert.equal(estimateTripDataMb(7, "regular"), 4200);
  assert.equal(estimateTripDataMb(999, "light"), 22500);
});

test("usage recommendation prefers the lowest-priced plan that meets data and validity", () => {
  const result = recommendPlanForUsage(
    [
      plan("too-short", 10240, 7, 300),
      plan("fits-expensive", 10240, 30, 1800),
      plan("fits-cheaper", 5120, 15, 1200),
    ],
    14,
    "regular",
  );

  assert.equal(result.plan?.id, "fits-expensive");
  assert.equal(result.meetsEstimate, true);
});

test("usage recommendation labels the closest option when no plan meets the estimate", () => {
  const result = recommendPlanForUsage(
    [plan("small", 1024, 7, 500), plan("closer", 4096, 15, 1200)],
    30,
    "heavy",
  );

  assert.equal(result.plan?.id, "closer");
  assert.equal(result.meetsEstimate, false);
});
