import type { PrismaClient } from "@prisma/client";

import type { AiraloClient } from "../airalo/client";
import type { Package } from "../airalo/schemas";
import { resolvePackagePrice } from "../airalo/pricing";
import prismaClient from "../db/client";
import { resolveAiraloClient } from "./service";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export type TopUpPackage = Package & {
  localPackageId: string;
  price: number;
  currency: string;
};

type CacheRecord = {
  options: TopUpPackage[];
  expiresAt: number;
};

const topUpCache = new Map<string, CacheRecord>();

export interface GetTopUpOptions {
  airaloClient?: AiraloClient;
  forceRefresh?: boolean;
  prisma?: PrismaClient;
}

export async function getTopUpPackages(
  iccid: string,
  options: GetTopUpOptions = {},
): Promise<TopUpPackage[]> {
  if (!iccid) {
    return [];
  }

  const now = Date.now();
  const cached = topUpCache.get(iccid);

  if (!options.forceRefresh && cached && cached.expiresAt > now) {
    return cached.options;
  }

  const airalo = options.airaloClient ?? resolveAiraloClient();
  let packages: Package[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      packages = await airalo.getSimPackages(iccid);
      break;
    } catch (error) {
      const status = (error as { details?: { status?: number } })?.details?.status;
      if (status !== 429 && status !== undefined && status < 500) {
        throw error;
      }
      const delayMs = 300 * 2 ** attempt + Math.floor(Math.random() * 100);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  const db = options.prisma ?? prismaClient;

  const localPackages = await db.airaloPackage.findMany({
    where: {
      externalId: {
        in: packages.map((pkg) => pkg.id),
      },
      isActive: true,
    },
    select: {
      id: true,
      externalId: true,
    },
  });

  const localIdByExternalId = new Map(
    localPackages.map((pkg) => [pkg.externalId, pkg.id] as const),
  );

  const availablePackages = packages
    .map((pkg) => {
      const localId = localIdByExternalId.get(pkg.id);

      if (!localId) {
        return null;
      }

      const priceDetails = resolvePackagePrice(pkg);

      if (!priceDetails) {
        return null;
      }

      return {
        ...pkg,
        price: priceDetails.priceCents / 100,
        currency: priceDetails.currency,
        localPackageId: localId,
      } satisfies TopUpPackage;
    })
    .filter((pkg): pkg is TopUpPackage => pkg !== null);

  topUpCache.set(iccid, {
    options: availablePackages,
    expiresAt: now + FIFTEEN_MINUTES_MS,
  });

  return availablePackages;
}

export function clearTopUpCache(iccid?: string): void {
  if (typeof iccid === "string") {
    topUpCache.delete(iccid);
    return;
  }

  topUpCache.clear();
}
