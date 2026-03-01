import assert from "node:assert/strict";
import test from "node:test";

import { getCatalogProductSummaries } from "./query";

test("getCatalogProductSummaries returns unavailable when no DB match exists", async () => {
  const sanityProducts = [
    {
      _id: "product-1",
      displayName: "Test Product",
      slug: "test-product",
      priceUSD: 25,
      shortDescription: "A reliable travel eSIM",
      status: "active",
      package: {
        externalId: "missing-1",
      },
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
  assert.equal(summaries[0]?.price, null);
  assert.equal(summaries[0]?.priceUSD, 0);
});

test("getCatalogProductSummaries does not fall back to country matches", async () => {
  const sanityProducts = [
    {
      _id: "product-2",
      displayName: "Malaysia 1GB",
      slug: "malaysia",
      priceUSD: 45,
      shortDescription: "Malaysia test product",
      status: "active",
      package: {
        externalId: "sambungkan-7days-1gb",
      },
      country: {
        _id: "country-1",
        title: "Malaysia",
        slug: "malaysia",
      },
    },
  ];

  const summaries = await getCatalogProductSummaries({
    fetchProducts: async () => sanityProducts,
    fetchPackages: async () => [
      {
        id: "pkg-1",
        externalId: "some-other-package",
        name: "Expensive package",
        status: "active",
        simType: null,
        isRechargeable: null,
        networkTypes: [],
        voiceMinutes: null,
        sms: null,
        apn: null,
        iccid: null,
        smdpAddress: null,
        qrCodeData: null,
        qrCodeUrl: null,
        activationCode: null,
        topupParentId: null,
        dataAmountMb: null,
        validityDays: null,
        isUnlimited: false,
        priceCents: 7250,
        sellingPriceCents: null,
        currencyCode: "USD",
        netPriceJson: null,
        rrpPriceJson: null,
        shortInfo: null,
        qrInstallation: null,
        manualInstallation: null,
        isFairUsagePolicy: null,
        fairUsagePolicy: null,
        imageUrl: null,
        metadata: null,
        isActive: true,
        deactivatedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        operator: null,
        country: { id: "country-1", name: "Malaysia", slug: "malaysia" },
      } as any,
    ],
  });

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.price, null);
  assert.equal(summaries[0]?.package, null);
});
