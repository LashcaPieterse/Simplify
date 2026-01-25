import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "@prisma/client";
import type { AiraloClient, GetPackagesOptions } from "../airalo/client";
import type { Package } from "../airalo/schemas";
import { paginateAiraloPackages, syncAiraloPackages } from "./sync";

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

test.skip("syncAiraloPackages preserves multi-currency pricing details in metadata", async () => {
  const packages: Package[] = [
    {
      id: "pkg-1",
      name: "Sample",
      destination: "US",
      net_prices: {
        USD: { amount: 5, currency: "USD" },
        EUR: { amount: 4.6, currency: "EUR" },
      },
      recommended_retail_prices: {
        USD: { amount: 6, currency: "USD" },
        EUR: { amount: 5.5, currency: "EUR" },
      },
    },
  ];

  const createdRecords: { metadata: string | null }[] = [];

  const prisma = {
    airaloPackage: {
      async findMany() {
        return [];
      },
      async create(args: { data: { metadata: string | null } }) {
        createdRecords.push({ metadata: args.data.metadata });
        return args.data;
      },
      async update() {
        throw new Error("should not update in this test");
      },
      async updateMany() {
        return { count: 0 };
      },
    },
  } as unknown as PrismaClient;

  const client = {
    async getPackages() {
      return packages;
    },
  } as unknown as AiraloClient;

  await syncAiraloPackages({
    prisma,
    client,
    logger: NOOP_LOGGER,
    packagesOptions: { limit: 10 },
    now: new Date("2024-01-01T00:00:00.000Z"),
  });

  assert.equal(createdRecords.length, 1);
  const metadata = createdRecords[0].metadata
    ? (JSON.parse(createdRecords[0].metadata) as Record<string, unknown>)
    : null;

  assert(metadata, "metadata should be persisted");
  assert.deepEqual(metadata?.netPrices, packages[0].net_prices);
  assert.deepEqual(
    metadata?.recommendedRetailPrices,
    packages[0].recommended_retail_prices,
  );
});
