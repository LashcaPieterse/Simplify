import assert from "node:assert/strict";
import test from "node:test";

import type { GetPackagesOptions } from "../airalo/client";
import type { Package } from "../airalo/schemas";
import { paginateAiraloPackages } from "./sync";

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
