import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "@prisma/client";
import type {
  AiraloClient,
  AiraloPackagesTreeRawPage,
  GetPackagesOptions,
} from "../airalo/client";
import type { Package } from "../airalo/schemas";
import { paginateAiraloPackages, syncAiraloCatalog } from "./sync";

const NOOP_LOGGER = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

function createPackage(id: string): Package {
  return {
    id,
    name: `package-${id}`,
    destination: "US",
    net_prices: {},
    recommended_retail_prices: {},
  };
}

class MockAiraloClient {
  private readonly pages: Package[][];
  readonly calls: GetPackagesOptions[] = [];

  constructor(pages: Package[][]) {
    this.pages = pages;
  }

  async getPackages(options: GetPackagesOptions = {}): Promise<Package[]> {
    this.calls.push({ ...options });
    const pageIndex = Math.max(0, (options.page ?? 1) - 1);
    return this.pages[pageIndex] ?? [];
  }
}

class MockPackageTreeClient {
  readonly calls: GetPackagesOptions[] = [];

  constructor(private readonly pages: Record<number, AiraloPackagesTreeRawPage>) {}

  async getPackagesTreePageRaw(options: GetPackagesOptions = {}): Promise<AiraloPackagesTreeRawPage> {
    this.calls.push({ ...options });
    const page = options.page ?? 1;
    const result = this.pages[page];
    if (!result) {
      throw new Error(`Unexpected packages page ${page}`);
    }
    return result;
  }
}

type CountryRecord = {
  id: string;
  countryCode: string;
  slug: string;
  title: string;
  imageJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type OperatorRecord = {
  id: string;
  countryId: string;
  airaloOperatorId: number | null;
  title: string;
  type: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
};

type PackageStateRecord = {
  packageId: string;
  isActive: boolean;
  deactivatedAt: Date | null;
  basePriceCents: number;
  sellingPriceCents: number | null;
  currencyCode: string;
  sourcePriceDecimal: number | null;
  sellPriceDecimal: number | null;
  lastSyncedAt: Date | null;
  sourceHash: string | null;
};

type PackageRecord = {
  id: string;
  operatorId: string;
  airaloPackageId: string;
  type: string;
  title: string;
  amount: number;
  data: string;
  day: number;
  isUnlimited: boolean;
  manualInstallation: string;
  qrInstallation: string;
  isFairUsagePolicy: boolean | null;
  fairUsagePolicy: string | null;
  netPrice: number | null;
  price: number;
  pricesNetPrice: unknown;
  pricesRecommendedRetailPrice: unknown;
  shortInfo: string | null;
  text: number | null;
  voice: number | null;
  createdAt: Date;
  updatedAt: Date;
  state: PackageStateRecord | null;
};

class InMemoryCatalogPrisma {
  readonly countries = new Map<string, CountryRecord>();
  readonly operators = new Map<string, OperatorRecord>();
  readonly packages = new Map<string, PackageRecord>();
  readonly packagePages: Array<Record<string, unknown>> = [];

  private countrySequence = 0;
  private operatorSequence = 0;
  private packageSequence = 0;

  constructor() {
    const now = new Date("2024-01-01T00:00:00.000Z");
    const stalePackage: PackageRecord = {
      id: "package-stale",
      operatorId: "operator-stale",
      airaloPackageId: "stale-package",
      type: "sim",
      title: "Stale Package",
      amount: 1024,
      data: "1 GB",
      day: 7,
      isUnlimited: false,
      manualInstallation: "",
      qrInstallation: "",
      isFairUsagePolicy: null,
      fairUsagePolicy: null,
      netPrice: 4,
      price: 6,
      pricesNetPrice: { USD: 4 },
      pricesRecommendedRetailPrice: { USD: 6 },
      shortInfo: null,
      text: null,
      voice: null,
      createdAt: now,
      updatedAt: now,
      state: {
        packageId: "package-stale",
        isActive: true,
        deactivatedAt: null,
        basePriceCents: 400,
        sellingPriceCents: 600,
        currencyCode: "USD",
        sourcePriceDecimal: 4,
        sellPriceDecimal: 6,
        lastSyncedAt: now,
        sourceHash: "stale",
      },
    };
    this.packages.set(stalePackage.airaloPackageId, stalePackage);
  }

  readonly packageSyncPage = {
    upsert: async (args: {
      where: { runId_page: { runId: string; page: number } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      const existingIndex = this.packagePages.findIndex(
        (entry) =>
          entry.runId === args.where.runId_page.runId &&
          entry.page === args.where.runId_page.page,
      );
      const record =
        existingIndex >= 0
          ? { ...this.packagePages[existingIndex], ...args.update }
          : { id: `page-${this.packagePages.length + 1}`, ...args.create };
      if (existingIndex >= 0) {
        this.packagePages[existingIndex] = record;
      } else {
        this.packagePages.push(record);
      }
      return record;
    },
  };

  readonly country = {
    findUnique: async (args: { where: { countryCode?: string; slug?: string } }) => {
      for (const country of Array.from(this.countries.values())) {
        if (args.where.countryCode && country.countryCode === args.where.countryCode) {
          return country;
        }
        if (args.where.slug && country.slug === args.where.slug) {
          return country;
        }
      }
      return null;
    },
    create: async (args: { data: Omit<CountryRecord, "id" | "createdAt" | "updatedAt"> }) => {
      const now = new Date();
      const record: CountryRecord = {
        id: `country-${++this.countrySequence}`,
        ...args.data,
        createdAt: now,
        updatedAt: now,
      };
      this.countries.set(record.id, record);
      return record;
    },
    update: async (args: { where: { id: string }; data: Partial<CountryRecord> }) => {
      const existing = this.countries.get(args.where.id);
      assert(existing, `Expected country ${args.where.id} to exist`);
      const updated = { ...existing, ...args.data } as CountryRecord;
      this.countries.set(updated.id, updated);
      return updated;
    },
  };

  readonly operator = {
    findFirst: async (args: { where: { countryId: string; airaloOperatorId?: number | null; title?: string } }) => {
      for (const operator of Array.from(this.operators.values())) {
        if (operator.countryId !== args.where.countryId) {
          continue;
        }
        if ("airaloOperatorId" in args.where) {
          if (operator.airaloOperatorId === args.where.airaloOperatorId) {
            return operator;
          }
          continue;
        }
        if (args.where.title && operator.title === args.where.title) {
          return operator;
        }
      }
      return null;
    },
    create: async (args: { data: Omit<OperatorRecord, "id" | "createdAt" | "updatedAt"> }) => {
      const now = new Date();
      const data = args.data as Record<string, unknown>;
      const record: OperatorRecord = {
        id: `operator-${++this.operatorSequence}`,
        countryId: String(data.countryId),
        airaloOperatorId:
          typeof data.airaloOperatorId === "number" ? data.airaloOperatorId : null,
        title: typeof data.title === "string" ? data.title : "Unknown",
        type: typeof data.type === "string" ? data.type : null,
        ...args.data,
        createdAt: now,
        updatedAt: now,
      };
      this.operators.set(record.id, record);
      return record;
    },
    update: async (args: { where: { id: string }; data: Partial<OperatorRecord> }) => {
      const existing = this.operators.get(args.where.id);
      assert(existing, `Expected operator ${args.where.id} to exist`);
      const updated = { ...existing, ...args.data } as OperatorRecord;
      this.operators.set(updated.id, updated);
      return updated;
    },
  };

  readonly package = {
    findUnique: async (args: { where: { airaloPackageId: string } }) => {
      return this.packages.get(args.where.airaloPackageId) ?? null;
    },
    create: async (args: { data: Omit<PackageRecord, "id" | "createdAt" | "updatedAt" | "state"> & { state?: { create: PackageStateRecord } } }) => {
      const now = new Date();
      const { state, ...packageData } = args.data;
      const record: PackageRecord = {
        id: `package-${++this.packageSequence}`,
        ...packageData,
        createdAt: now,
        updatedAt: now,
        state: state?.create
          ? {
              ...state.create,
              packageId: `package-${this.packageSequence}`,
            }
          : null,
      };
      this.packages.set(record.airaloPackageId, record);
      return record;
    },
    update: async (args: {
      where: { id: string };
      data: Partial<PackageRecord> & {
        state?: { upsert: { create: PackageStateRecord; update: PackageStateRecord } };
      };
    }) => {
      const existing = Array.from(this.packages.values()).find((pkg) => pkg.id === args.where.id);
      assert(existing, `Expected package ${args.where.id} to exist`);
      const { state, ...packageData } = args.data;
      const updated: PackageRecord = {
        ...existing,
        ...packageData,
        state: state?.upsert
          ? {
              ...state.upsert.update,
              packageId: existing.id,
            }
          : existing.state,
      };
      this.packages.set(updated.airaloPackageId, updated);
      return updated;
    },
  };

  readonly packageState = {
    findMany: async () => {
      return Array.from(this.packages.values())
        .filter((pkg) => pkg.state?.isActive)
        .map((pkg) => ({
          packageId: pkg.id,
          package: { airaloPackageId: pkg.airaloPackageId },
        }));
    },
    updateMany: async (args: {
      where: { packageId: { in: string[] }; isActive: boolean };
      data: Partial<PackageStateRecord>;
    }) => {
      let count = 0;
      for (const pkg of Array.from(this.packages.values())) {
        if (!pkg.state || !args.where.packageId.in.includes(pkg.id)) {
          continue;
        }
        if (pkg.state.isActive !== args.where.isActive) {
          continue;
        }
        pkg.state = { ...pkg.state, ...args.data };
        count += 1;
      }
      return { count };
    },
  };
}

test("paginateAiraloPackages iterates over every page without skipping packages", async () => {
  const limit = 2;
  const pages = [
    [createPackage("1"), createPackage("2")],
    [createPackage("3"), createPackage("4")],
    [createPackage("5")],
  ];
  const client = new MockAiraloClient(pages);
  const receivedPackages: string[] = [];

  const total = await paginateAiraloPackages({
    client,
    logger: NOOP_LOGGER,
    packagesOptions: { limit },
    delayMs: 0,
    async onPage(packages) {
      for (const pkg of packages) {
        receivedPackages.push(pkg.id);
      }
    },
  });

  assert.equal(total, 5);
  assert.deepEqual(receivedPackages, ["1", "2", "3", "4", "5"]);
  assert.deepEqual(
    client.calls.map((call) => call.page ?? 1),
    [1, 2, 3],
    "should request each page exactly once",
  );
  assert.deepEqual(
    client.calls.map((call) => call.limit),
    [limit, limit, limit],
    "should enforce the provided limit on every request",
  );
});

test("syncAiraloCatalog follows Airalo pagination metadata and stores documented package fields", async () => {
  const now = new Date("2026-05-08T12:00:00.000Z");
  const pageOneCountry = {
    country_code: "US",
    slug: "united-states",
    title: "United States",
    image: { width: 132, height: 99, url: "https://example.com/us.png" },
    operators: [
      {
        id: 1181,
        type: "local",
        title: "Change",
        plan_type: "data",
        apn_type: "manual",
        apn_value: "wbdata",
        coverages: [{ name: "United States", code: "US", networks: [{ name: "T-Mobile", types: ["5G"] }] }],
        packages: [
          {
            id: "change-us-1gb",
            type: "sim",
            price: 6,
            amount: 1024,
            day: 7,
            is_unlimited: false,
            title: "US 1GB",
            short_info: "1 GB",
            qr_installation: "<p>QR</p>",
            manual_installation: "<p>Manual</p>",
            is_fair_usage_policy: false,
            fair_usage_policy: null,
            data: "1 GB",
            voice: null,
            text: null,
            net_price: 4,
            prices: {
              net_price: { USD: 4, EUR: 3.7 },
              recommended_retail_price: { USD: 6, EUR: 5.5 },
            },
          },
        ],
      },
    ],
  };
  const globalCountry = {
    country_code: "",
    slug: "world",
    title: "World",
    image: { width: 132, height: 99, url: "https://example.com/world.png" },
    operators: [
      {
        id: 2200,
        type: "global",
        title: "WorldLink",
        plan_type: "data-voice-text",
        countries: [{ country_code: "US", title: "United States" }],
        packages: [
          {
            id: "world-unlimited-vt",
            type: "sim",
            price: 20,
            amount: 0,
            day: 10,
            is_unlimited: true,
            title: "World Unlimited",
            short_info: null,
            qr_installation: "<p>QR</p>",
            manual_installation: "<p>Manual</p>",
            is_fair_usage_policy: true,
            fair_usage_policy: "1GB/day",
            data: "Unlimited",
            voice: 100,
            text: 50,
            net_price: 10,
            prices: {
              net_price: { USD: 10, ZAR: 180 },
              recommended_retail_price: { USD: 20, ZAR: 360 },
            },
          },
        ],
      },
    ],
  };
  const kenyaCountry = {
    country_code: "KE",
    slug: "kenya",
    title: "Kenya",
    image: { width: 132, height: 99, url: "https://example.com/ke.png" },
    operators: [
      {
        id: 3300,
        type: "local",
        title: "KenyaTel",
        plan_type: "voice-text",
        packages: [
          {
            id: "ke-voice-text",
            type: "sim",
            price: 8,
            amount: 0,
            day: 30,
            is_unlimited: false,
            title: "Kenya Voice + Text",
            short_info: "Voice and text",
            qr_installation: "<p>QR</p>",
            manual_installation: "<p>Manual</p>",
            is_fair_usage_policy: false,
            fair_usage_policy: null,
            data: "0 MB",
            voice: 60,
            text: 100,
            net_price: 5,
            prices: {
              net_price: { USD: 5, EUR: 4.6 },
              recommended_retail_price: { USD: 8, EUR: 7.4 },
            },
          },
        ],
      },
    ],
  };

  const pageOneRaw = {
    data: [pageOneCountry, globalCountry],
    links: {
      first: "https://partners-api.airalo.com/v2/packages?page=1",
      last: "https://partners-api.airalo.com/v2/packages?page=2",
      prev: null,
      next: "https://partners-api.airalo.com/v2/packages?page=2&limit=100",
    },
    meta: {
      current_page: 1,
      last_page: 2,
      path: "https://partners-api.airalo.com/v2/packages",
      per_page: 100,
      total: 3,
    },
    pricing: { model: "default", discount_percentage: 0 },
  };
  const pageTwoRaw = {
    data: {
      "2": kenyaCountry,
    },
    links: {
      first: "https://partners-api.airalo.com/v2/packages?page=1",
      last: "https://partners-api.airalo.com/v2/packages?page=2",
      prev: "https://partners-api.airalo.com/v2/packages?page=1&limit=100",
      next: null,
    },
    meta: {
      current_page: 2,
      last_page: 2,
      path: "https://partners-api.airalo.com/v2/packages",
      per_page: 100,
      total: 3,
    },
    pricing: { model: "default", discount_percentage: 0 },
  };

  const client = new MockPackageTreeClient({
    1: { rawResponse: pageOneRaw, countries: [pageOneCountry, globalCountry] },
    2: { rawResponse: pageTwoRaw, countries: [kenyaCountry] },
  });
  const prisma = new InMemoryCatalogPrisma();

  const result = await syncAiraloCatalog({
    prisma: prisma as unknown as PrismaClient,
    client: client as unknown as AiraloClient,
    logger: NOOP_LOGGER,
    packagesOptions: { includeTopUp: true, limit: 100 },
    syncRunId: "sync-run-1",
    now,
  });

  assert.deepEqual(
    client.calls.map((call) => call.page),
    [1, 2],
    "sync should follow links/meta pagination instead of stopping on country count",
  );
  assert.deepEqual(
    client.calls.map((call) => call.includeTopUp),
    [true, true],
  );
  assert.equal(result.packagesCreated, 3);
  assert.equal(result.packagesDeactivated, 1);

  assert.deepEqual(
    prisma.packagePages.map((page) => page.page),
    [1, 2],
  );
  assert.deepEqual(prisma.packagePages[0]?.rawPayloadJson, pageOneRaw);
  assert.deepEqual(prisma.packagePages[1]?.rawPayloadJson, pageTwoRaw);

  const worldCountry = Array.from(prisma.countries.values()).find((country) => country.slug === "world");
  assert.equal(worldCountry?.countryCode, "AIRALO-WORLD");

  const worldOperator = Array.from(prisma.operators.values()).find((operator) => operator.title === "WorldLink");
  assert.equal(worldOperator?.type, "global");
  assert.deepEqual(worldOperator?.countriesJson, [{ country_code: "US", title: "United States" }]);

  const worldPackage = prisma.packages.get("world-unlimited-vt");
  assert(worldPackage, "global voice/text package should be created");
  assert.equal(worldPackage.isUnlimited, true);
  assert.equal(worldPackage.isFairUsagePolicy, true);
  assert.equal(worldPackage.fairUsagePolicy, "1GB/day");
  assert.equal(worldPackage.voice, 100);
  assert.equal(worldPackage.text, 50);
  assert.equal(worldPackage.netPrice, 10);
  assert.equal(worldPackage.price, 20);
  assert.deepEqual(worldPackage.pricesNetPrice, { USD: 10, ZAR: 180 });
  assert.deepEqual(worldPackage.pricesRecommendedRetailPrice, { USD: 20, ZAR: 360 });
  assert.equal(worldPackage.state?.basePriceCents, 1000);
  assert.equal(worldPackage.state?.sellingPriceCents, 2000);
  assert.equal(worldPackage.state?.currencyCode, "USD");
  assert.equal(worldPackage.state?.lastSyncedAt, now);

  const kenyaPackage = prisma.packages.get("ke-voice-text");
  assert(kenyaPackage, "page 2 indexed country package should be created");
  assert.equal(kenyaPackage.voice, 60);
  assert.equal(kenyaPackage.text, 100);

  const stalePackage = prisma.packages.get("stale-package");
  assert.equal(stalePackage?.state?.isActive, false);
  assert.equal(stalePackage?.state?.deactivatedAt, now);
});
