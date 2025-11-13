import type { AiraloClient, Package } from "../airalo/client";
import { resolveAiraloClient } from "./service";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

type CacheRecord = {
  options: Package[];
  expiresAt: number;
};

const topUpCache = new Map<string, CacheRecord>();

export interface GetTopUpOptions {
  airaloClient?: AiraloClient;
  forceRefresh?: boolean;
}

export async function getTopUpPackages(
  iccid: string,
  options: GetTopUpOptions = {},
): Promise<Package[]> {
  if (!iccid) {
    return [];
  }

  const now = Date.now();
  const cached = topUpCache.get(iccid);

  if (!options.forceRefresh && cached && cached.expiresAt > now) {
    return cached.options;
  }

  const airalo = options.airaloClient ?? resolveAiraloClient();
  const packages = await airalo.getSimPackages(iccid);

  topUpCache.set(iccid, {
    options: packages,
    expiresAt: now + FIFTEEN_MINUTES_MS,
  });

  return packages;
}

export function clearTopUpCache(iccid?: string): void {
  if (typeof iccid === "string") {
    topUpCache.delete(iccid);
    return;
  }

  topUpCache.clear();
}
