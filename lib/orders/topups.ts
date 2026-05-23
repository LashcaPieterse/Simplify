import type { PrismaClient } from "@prisma/client";

import type { AiraloClient } from "../airalo/client";
import type { AiraloTopUpPackage } from "../airalo/schemas";
import prismaClient from "../db/client";
import { resolveAiraloClient } from "./service";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export type TopUpPackage = AiraloTopUpPackage & {
  localPackageId: string;
  price: number;
  currency: string;
};

type CacheRecord = {
  options: TopUpPackage[];
  expiresAt: number;
};

type AiraloErrorDetails = {
  status?: number;
  category?: string;
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
  let packages: AiraloTopUpPackage[] = [];
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      packages = await airalo.getSimTopUpPackages(iccid);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const details = getAiraloErrorDetails(error);
      if (isUnavailableTopUpListError(details)) {
        packages = [];
        lastError = null;
        break;
      }

      const status = details?.status;
      if (status !== 429 && status !== undefined && status < 500) {
        throw error;
      }
      const delayMs = 300 * 2 ** attempt + Math.floor(Math.random() * 100);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  if (packages.length === 0 && lastError) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Unable to fetch Airalo top-up packages.");
  }

  const db = options.prisma ?? prismaClient;

  const localPackages = await db.package.findMany({
    where: {
      airaloPackageId: {
        in: packages.map((pkg) => pkg.id),
      },
      state: {
        is: { isActive: true },
      },
    },
    select: {
      id: true,
      airaloPackageId: true,
      state: {
        select: {
          basePriceCents: true,
          sellingPriceCents: true,
          currencyCode: true,
        },
      },
    },
  });

  const localIdByExternalId = new Map(
    localPackages.map((pkg) => [pkg.airaloPackageId, pkg] as const),
  );

  const availablePackages = packages
    .map((pkg) => {
      const localPackage = localIdByExternalId.get(pkg.id);

      if (!localPackage) {
        return null;
      }

      const priceCents =
        localPackage.state?.sellingPriceCents ??
        localPackage.state?.basePriceCents ??
        Math.round(pkg.price * 100);
      const currency = localPackage.state?.currencyCode ?? "USD";

      return {
        ...pkg,
        price: priceCents / 100,
        currency,
        localPackageId: localPackage.id,
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

function getAiraloErrorDetails(error: unknown): AiraloErrorDetails | undefined {
  return (error as { details?: AiraloErrorDetails })?.details;
}

function isUnavailableTopUpListError(
  details: AiraloErrorDetails | undefined,
): boolean {
  return details?.category === "iccid_recycled" || details?.status === 404;
}
