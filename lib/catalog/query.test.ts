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
      status: "active" as const,
      package: {
        _id: "sanity-missing-1",
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
  assert.equal(summaries[0]?.package?.isActive, false);
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
      status: "active" as const,
      package: {
        _id: "sanity-missing-2",
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
  assert.equal(summaries[0]?.package?.isActive, false);
});

test("getCatalogProductSummaries marks active packages without selling price as unavailable", async () => {
  const sanityProducts = [
    {
      _id: "product-3",
      displayName: "Kenya 3GB",
      slug: "kenya-3gb",
      priceUSD: 12,
      shortDescription: "Kenya test product",
      status: "active" as const,
      package: {
        _id: "sanity-pkg-1",
        externalId: "ke-3gb-7d",
        title: "Kenya 3GB",
      },
    },
  ];

  const dbPackages = [
    {
      id: "pkg-3",
      airaloPackageId: "ke-3gb-7d",
      title: "Kenya 3GB",
      amount: 3072,
      day: 7,
      isUnlimited: false,
      price: 12,
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
        basePriceCents: 1200,
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
  assert.equal(summaries[0]?.priceUSD, 0);
  assert.equal(summaries[0]?.package?.isActive, false);
});

test("getCatalogProductSummaries synthesizes active Airalo-backed packages without editorial products", async () => {
  const dbPackages = [
    {
      id: "pkg-4",
      airaloPackageId: "ke-1gb-7d",
      title: "1 GB - 7 days",
      amount: 1024,
      day: 7,
      isUnlimited: false,
      price: 8,
      netPrice: null,
      pricesNetPrice: null,
      pricesRecommendedRetailPrice: null,
      shortInfo: "Starter Kenya data",
      qrInstallation: null,
      manualInstallation: null,
      isFairUsagePolicy: null,
      fairUsagePolicy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      operator: {
        id: "operator-4",
        title: "Nakuru Mobile",
        airaloOperatorId: 44,
        country: {
          id: "country-kenya",
          title: "Kenya",
          slug: "kenya",
          countryCode: "KE",
          imageJson: null,
        },
      },
      state: {
        isActive: true,
        sellingPriceCents: 800,
        basePriceCents: 600,
        currencyCode: "USD",
        lastSyncedAt: null,
        updatedAt: new Date(),
      },
    } as TestPackage,
  ] as unknown as FetchPackagesResult;

  const summaries = await getCatalogProductSummaries({
    fetchProducts: async () => [],
    fetchPackages: async () => dbPackages,
  });

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.country?.title, "Kenya");
  assert.equal(summaries[0]?.package?.externalId, "ke-1gb-7d");
  assert.equal(summaries[0]?.price?.amount, 8);
});

test("getCatalogProductSummaries lets live Prisma state override stale Sanity package mirror fields", async () => {
  const sanityProducts = [
    {
      _id: "product-5",
      displayName: "Kenya stale mirror",
      slug: "kenya-stale",
      priceUSD: 99,
      shortDescription: "Kenya stale package data",
      status: "active" as const,
      package: {
        _id: "sanity-pkg-5",
        externalId: "ke-live-1gb",
        title: "Stale 10GB",
        dataAmountMb: 10240,
        validityDays: 30,
      },
      country: {
        _id: "country-kenya",
        title: "Kenya",
        slug: "kenya",
      },
    },
  ];

  const dbPackages = [
    {
      id: "pkg-5",
      airaloPackageId: "ke-live-1gb",
      title: "1 GB - 7 days",
      amount: 1024,
      day: 7,
      isUnlimited: false,
      price: 8,
      netPrice: null,
      pricesNetPrice: null,
      pricesRecommendedRetailPrice: null,
      shortInfo: "Live Kenya data",
      qrInstallation: null,
      manualInstallation: null,
      isFairUsagePolicy: null,
      fairUsagePolicy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      operator: {
        id: "operator-5",
        title: "Nakuru Mobile",
        airaloOperatorId: 45,
        country: {
          id: "country-kenya",
          title: "Kenya",
          slug: "kenya",
          countryCode: "KE",
          imageJson: null,
        },
      },
      state: {
        isActive: true,
        sellingPriceCents: 800,
        basePriceCents: 600,
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
  assert.equal(summaries[0]?.price?.amount, 8);
  assert.equal(summaries[0]?.package?.dataLimitMb, 1024);
  assert.equal(summaries[0]?.package?.validityDays, 7);
  assert.equal(summaries[0]?.package?.isActive, true);
});
