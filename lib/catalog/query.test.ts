import assert from "node:assert/strict";
import test from "node:test";

import { getCatalogProductSummaries } from "./query";

type FetchPackages = NonNullable<
  NonNullable<Parameters<typeof getCatalogProductSummaries>[0]>["fetchPackages"]
>;
type FetchPackagesResult = Awaited<ReturnType<FetchPackages>>;

type TestPackage = {
  id: string;
  airaloPackageId: string;
  title: string;
  amount: number;
  day: number;
  isUnlimited: boolean;
  price: number;
  netPrice: number | null;
  pricesNetPrice: unknown;
  pricesRecommendedRetailPrice: unknown;
  shortInfo: string | null;
  qrInstallation: string | null;
  manualInstallation: string | null;
  isFairUsagePolicy: boolean | null;
  fairUsagePolicy: string | null;
  createdAt: Date;
  updatedAt: Date;
  operator: null | { id: string; title: string; airaloOperatorId: number | null };
  state: {
    isActive: boolean;
    sellingPriceCents: number | null;
    basePriceCents: number;
    currencyCode: string;
    lastSyncedAt: Date | null;
    updatedAt: Date;
  } | null;
};

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

  const dbPackages = [
      {
        id: "pkg-1",
        airaloPackageId: "some-other-package",
        title: "Expensive package",
        amount: 1024,
        day: 7,
        isUnlimited: false,
        price: 72.5,
        netPrice: null,
        pricesNetPrice: null,
        pricesRecommendedRetailPrice: null,
        shortInfo: null,
        qrInstallation: null,
        manualInstallation: null,
        isFairUsagePolicy: null,
        fairUsagePolicy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        operator: null,
        state: {
          isActive: true,
          sellingPriceCents: null,
          basePriceCents: 7250,
          currencyCode: "USD",
          lastSyncedAt: null,
          updatedAt: new Date(),
        },
      } as TestPackage,
    ] as unknown as FetchPackagesResult;

  const summaries = await getCatalogProductSummaries({
    fetchProducts: async () => sanityProducts,
    fetchPackages: async () => dbPackages,
  });

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.price, null);
  assert.equal(summaries[0]?.package, null);
});
