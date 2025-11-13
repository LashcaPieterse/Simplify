import type { PrismaClient, UsageSnapshot } from "@prisma/client";

import type { AiraloClient, Usage as AiraloUsage } from "../airalo/client";
import prismaClient from "../db/client";
import { resolveAiraloClient } from "./service";

export const DEFAULT_USAGE_CACHE_DURATION_MS = 5 * 60 * 1000;

export interface UsagePollingOptions {
  prisma?: PrismaClient;
  airaloClient?: AiraloClient;
  forceRefresh?: boolean;
  cacheDurationMs?: number;
}

export interface UsagePollingResult {
  snapshot: UsageSnapshot | null;
  usage: AiraloUsage | null;
  source: "cache" | "airalo";
}

export async function getLatestUsageSnapshot(
  profileId: string,
  prisma: PrismaClient = prismaClient,
): Promise<UsageSnapshot | null> {
  return prisma.usageSnapshot.findFirst({
    where: { profileId },
    orderBy: { recordedAt: "desc" },
  });
}

interface UsageProfileLike {
  id: string;
  iccid: string | null;
}

export async function pollUsageForProfile(
  orderId: string,
  profile: UsageProfileLike,
  options: UsagePollingOptions = {},
): Promise<UsagePollingResult> {
  const db = options.prisma ?? prismaClient;
  const cacheDuration = options.cacheDurationMs ?? DEFAULT_USAGE_CACHE_DURATION_MS;
  const latestSnapshot = await getLatestUsageSnapshot(profile.id, db);

  const shouldRefresh =
    options.forceRefresh ||
    !latestSnapshot ||
    Date.now() - latestSnapshot.recordedAt.getTime() > cacheDuration;

  if (!profile.iccid) {
    return {
      snapshot: latestSnapshot,
      usage: null,
      source: "cache",
    };
  }

  if (!shouldRefresh) {
    return {
      snapshot: latestSnapshot,
      usage: null,
      source: "cache",
    };
  }

  const airalo = options.airaloClient ?? resolveAiraloClient();
  const usage = await airalo.getSimUsage(profile.iccid);
  const dataMetrics = usage.data;

  const snapshot = await db.usageSnapshot.create({
    data: {
      orderId,
      profileId: profile.id,
      usedMb: typeof dataMetrics?.used === "number" ? dataMetrics.used : null,
      remainingMb:
        typeof dataMetrics?.remaining === "number" ? dataMetrics.remaining : null,
    },
  });

  return {
    snapshot,
    usage,
    source: "airalo",
  };
}
