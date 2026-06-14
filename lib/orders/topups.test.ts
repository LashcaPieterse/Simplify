import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "@prisma/client";

import type { AiraloClient } from "../airalo/client";
import type { AiraloTopUpPackage } from "../airalo/schemas";
import { clearTopUpCache, getTopUpPackages } from "./topups";

class FakeTopUpAiraloClient {
  calls = 0;

  constructor(
    readonly packages: AiraloTopUpPackage[],
    readonly error?: unknown,
  ) {}

  async getSimTopUpPackages(): Promise<AiraloTopUpPackage[]> {
    this.calls += 1;
    if (this.error) {
      throw this.error;
    }

    return this.packages;
  }
}

class FakeTopUpDb {
  readonly package = {
    findMany: async ({ where }: { where: unknown }) => {
      assert.match(JSON.stringify(where), /"type":"topup"/);
      return [
        {
          id: "local-package-1",
          airaloPackageId: "bonbon-mobile-30days-3gb-topup",
          state: {
            basePriceCents: 1200,
            sellingPriceCents: 1500,
            currencyCode: "USD",
          },
        },
      ];
    },
  };
}

function airalo(client: FakeTopUpAiraloClient): AiraloClient {
  return client as unknown as AiraloClient;
}

function prisma(db: FakeTopUpDb): PrismaClient {
  return db as unknown as PrismaClient;
}

test("getTopUpPackages maps documented Airalo top-ups to active local packages", async () => {
  clearTopUpCache();
  const client = new FakeTopUpAiraloClient([
    {
      id: "bonbon-mobile-30days-3gb-topup",
      type: "topup",
      price: 10,
      amount: 3072,
      day: 30,
      is_unlimited: false,
      title: "3 GB - 100 SMS - 100 Mins - 30 Days",
      data: "3 GB",
      short_info: "This eSIM doesn't come with a phone number.",
      voice: 100,
      text: 100,
      net_price: null,
    },
    {
      id: "unmatched-topup",
      type: "topup",
      price: 14,
      amount: 5120,
      day: 30,
      is_unlimited: false,
      title: "5 GB - 30 Days",
      data: "5 GB",
      short_info: "This eSIM doesn't come with a phone number.",
      voice: 0,
      text: 0,
      net_price: 11.2,
    },
  ]);

  const topups = await getTopUpPackages("8910300000005271146", {
    airaloClient: airalo(client),
    prisma: prisma(new FakeTopUpDb()),
    forceRefresh: true,
  });

  assert.equal(client.calls, 1);
  assert.equal(topups.length, 1);
  assert.equal(topups[0]?.id, "bonbon-mobile-30days-3gb-topup");
  assert.equal(topups[0]?.localPackageId, "local-package-1");
  assert.equal(topups[0]?.price, 15);
  assert.equal(topups[0]?.currency, "USD");
  assert.equal(topups[0]?.title, "3 GB - 100 SMS - 100 Mins - 30 Days");
  assert.equal(topups[0]?.data, "3 GB");
  assert.equal(topups[0]?.voice, 100);
  assert.equal(topups[0]?.text, 100);
});

test("getTopUpPackages treats recycled SIM responses as no available top-ups", async () => {
  clearTopUpCache();
  const client = new FakeTopUpAiraloClient([], {
    details: {
      status: 422,
      category: "iccid_recycled",
      code: 73,
      reason:
        "The eSIM with iccid 8910300000005271146 has been recycled. It can no longer be used or topped up.",
    },
  });

  const topups = await getTopUpPackages("8910300000005271146", {
    airaloClient: airalo(client),
    prisma: prisma(new FakeTopUpDb()),
    forceRefresh: true,
  });

  assert.equal(client.calls, 1);
  assert.deepEqual(topups, []);
});
