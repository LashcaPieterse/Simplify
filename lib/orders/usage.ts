import type { Prisma, PrismaClient, UsageSnapshot } from "@prisma/client";

import type { AiraloClient, Usage as AiraloUsage } from "../airalo/client";
import prismaClient from "../db/client";
import { resolveAiraloClient } from "./service";

export const DEFAULT_USAGE_CACHE_DURATION_MS = 20 * 60 * 1000;

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

function parseAiraloDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toInteger(value: number): number {
  return Math.trunc(value);
}

function shouldDisplayFiniteDataUsage(usage: AiraloUsage): boolean {
  return usage.is_unlimited !== true && usage.status.toUpperCase() !== "RECYCLED";
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
  let usage: AiraloUsage | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      usage = await airalo.getSimUsage(profile.iccid);
      break;
    } catch (error) {
      lastError = error;
      const status = (error as { details?: { status?: number } })?.details?.status;
      if (status !== 429 && status !== undefined && status < 500) {
        throw error;
      }
      const delayMs = 300 * 2 ** attempt + Math.floor(Math.random() * 100);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  if (!usage) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Unable to fetch Airalo SIM usage.");
  }

  const showFiniteDataUsage = shouldDisplayFiniteDataUsage(usage);
  const totalMb = showFiniteDataUsage ? usage.total : null;
  const remainingMb = showFiniteDataUsage ? usage.remaining : null;
  const usedMb =
    typeof totalMb === "number" && typeof remainingMb === "number"
      ? Math.max(totalMb - remainingMb, 0)
      : null;

  const snapshot = await db.usageSnapshot.create({
    data: {
      orderId,
      profileId: profile.id,
      usedMb,
      remainingMb,
      totalMb,
      status: usage.status,
      expiredAt: parseAiraloDate(usage.expired_at),
      isUnlimited: usage.is_unlimited,
      remainingVoiceMinutes: toInteger(usage.remaining_voice),
      totalVoiceMinutes: toInteger(usage.total_voice),
      remainingTextMessages: toInteger(usage.remaining_text),
      totalTextMessages: toInteger(usage.total_text),
      rawPayload: usage as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    snapshot,
    usage,
    source: "airalo",
  };
}
