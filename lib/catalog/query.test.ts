import assert from "node:assert/strict";
import test from "node:test";

import { getCatalogProductSummaries } from "./query";

test("getCatalogProductSummaries excludes inactive Airalo packages", async () => {
  const sanityProducts = [
    {
      _id: "product-1",
      displayName: "Test Product",
      slug: "test-product",
      priceUSD: 25,
      shortDescription: "A reliable travel eSIM",
      status: "active",
      plan: {
        _id: "plan-1",
        title: "Plan 1",
        slug: "plan-1",
        priceUSD: 25,
        dataGB: 1,
        validityDays: 7,
        shortBlurb: "Short blurb",
      },
    },
  ];

  let fetchPackagesCalls = 0;

  const summaries = await getCatalogProductSummaries({
    fetchProducts: async () => sanityProducts,
    fetchPackages: async () => {
      fetchPackagesCalls += 1;
      return [];
    },
  });

  assert.equal(fetchPackagesCalls, 1);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.package, null);
  assert.equal(summaries[0]?.price?.source, "sanity");
  assert.equal(summaries[0]?.priceUSD, 25);
});
