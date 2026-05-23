import assert from "node:assert/strict";
import test from "node:test";

import type { PrismaClient } from "@prisma/client";

import type { AiraloClient, Usage as AiraloUsage } from "../airalo/client";
import {
  DEFAULT_USAGE_CACHE_DURATION_MS,
  pollUsageForProfile,
} from "./usage";

class FakeUsageDb {
  readonly records: Array<Record<string, unknown>> = [];

  readonly usageSnapshot = {
    findFirst: async ({ where }: { where: { profileId: string } }) => {
      return (
        this.records
          .filter((record) => record.profileId === where.profileId)
          .sort(
            (a, b) =>
              (b.recordedAt as Date).getTime() -
              (a.recordedAt as Date).getTime(),
          )[0] ?? null
      );
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const record = {
        id: `usage-${this.records.length + 1}`,
        recordedAt: new Date(),
        ...data,
      };
      this.records.push(record);
      return record;
    },
  };
}

class FakeAiraloUsageClient {
  calls = 0;

  constructor(readonly usage: AiraloUsage) {}

  async getSimUsage(): Promise<AiraloUsage> {
    this.calls += 1;
    return this.usage;
  }
}

function prisma(db: FakeUsageDb): PrismaClient {
  return db as unknown as PrismaClient;
}

function airalo(client: FakeAiraloUsageClient): AiraloClient {
  return client as unknown as AiraloClient;
}

test("pollUsageForProfile stores finite Airalo usage snapshots", async () => {
  const db = new FakeUsageDb();
  const client = new FakeAiraloUsageClient({
    remaining: 767,
    total: 2048,
    expired_at: "2022-01-01 00:00:00",
    is_unlimited: false,
    status: "ACTIVE",
    remaining_voice: 12,
    remaining_text: 34,
    total_voice: 60,
    total_text: 100,
  });

  const result = await pollUsageForProfile(
    "order-1",
    { id: "profile-1", iccid: "8944465400000267221" },
    { prisma: prisma(db), airaloClient: airalo(client) },
  );

  assert.equal(result.source, "airalo");
  assert.equal(client.calls, 1);
  assert.equal(result.snapshot?.usedMb, 1281);
  assert.equal(result.snapshot?.remainingMb, 767);
  assert.equal(result.snapshot?.totalMb, 2048);
  assert.equal(result.snapshot?.status, "ACTIVE");
  assert.equal(result.snapshot?.expiredAt?.toISOString(), "2022-01-01T00:00:00.000Z");
  assert.equal(result.snapshot?.isUnlimited, false);
  assert.equal(result.snapshot?.remainingVoiceMinutes, 12);
  assert.equal(result.snapshot?.totalVoiceMinutes, 60);
  assert.equal(result.snapshot?.remainingTextMessages, 34);
  assert.equal(result.snapshot?.totalTextMessages, 100);
  assert.deepEqual(result.snapshot?.rawPayload, client.usage);
});

test("pollUsageForProfile stores unlimited usage without finite data counters", async () => {
  const db = new FakeUsageDb();
  const client = new FakeAiraloUsageClient({
    remaining: 0,
    total: 0,
    expired_at: "2022-01-01 00:00:00",
    is_unlimited: true,
    status: "ACTIVE",
    remaining_voice: 0,
    remaining_text: 0,
    total_voice: 0,
    total_text: 0,
  });

  const result = await pollUsageForProfile(
    "order-1",
    { id: "profile-1", iccid: "8944465400000267221" },
    { prisma: prisma(db), airaloClient: airalo(client) },
  );

  assert.equal(result.snapshot?.usedMb, null);
  assert.equal(result.snapshot?.remainingMb, null);
  assert.equal(result.snapshot?.totalMb, null);
  assert.equal(result.snapshot?.isUnlimited, true);
  assert.equal(result.snapshot?.status, "ACTIVE");
});

test("pollUsageForProfile stores recycled usage without finite data counters", async () => {
  const db = new FakeUsageDb();
  const client = new FakeAiraloUsageClient({
    remaining: 0,
    total: 0,
    expired_at: null,
    is_unlimited: null,
    status: "RECYCLED",
    remaining_voice: 0,
    remaining_text: 0,
    total_voice: 0,
    total_text: 0,
  });

  const result = await pollUsageForProfile(
    "order-1",
    { id: "profile-1", iccid: "8944465400000267221" },
    { prisma: prisma(db), airaloClient: airalo(client) },
  );

  assert.equal(result.snapshot?.usedMb, null);
  assert.equal(result.snapshot?.remainingMb, null);
  assert.equal(result.snapshot?.totalMb, null);
  assert.equal(result.snapshot?.expiredAt, null);
  assert.equal(result.snapshot?.isUnlimited, null);
  assert.equal(result.snapshot?.status, "RECYCLED");
});

test("pollUsageForProfile uses the documented 20 minute usage cache", async () => {
  const db = new FakeUsageDb();
  const existingSnapshot = {
    id: "usage-existing",
    orderId: "order-1",
    profileId: "profile-1",
    usedMb: 100,
    remainingMb: 924,
    recordedAt: new Date(Date.now() - DEFAULT_USAGE_CACHE_DURATION_MS + 1_000),
  };
  db.records.push(existingSnapshot);
  const client = new FakeAiraloUsageClient({
    remaining: 0,
    total: 0,
    expired_at: null,
    is_unlimited: null,
    status: "RECYCLED",
    remaining_voice: 0,
    remaining_text: 0,
    total_voice: 0,
    total_text: 0,
  });

  const result = await pollUsageForProfile(
    "order-1",
    { id: "profile-1", iccid: "8944465400000267221" },
    { prisma: prisma(db), airaloClient: airalo(client) },
  );

  assert.equal(DEFAULT_USAGE_CACHE_DURATION_MS, 20 * 60 * 1000);
  assert.equal(result.source, "cache");
  assert.equal(client.calls, 0);
  assert.equal(result.snapshot, existingSnapshot);
});
