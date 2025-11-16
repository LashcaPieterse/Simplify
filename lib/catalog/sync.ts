import { createHash } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { AiraloClient, type GetPackagesOptions } from "../airalo/client";
import { resolveSharedTokenCache } from "../airalo/token-cache";
import type { Package } from "../airalo/schemas";
import { resolvePackagePrice } from "../airalo/pricing";
import prismaClient from "../db/client";

interface SyncLogger {
  info?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
}

const AIRALO_REQUESTS_PER_MINUTE_LIMIT = 40;
const AIRALO_RATE_LIMIT_DELAY_MS = Math.ceil(60000 / AIRALO_REQUESTS_PER_MINUTE_LIMIT);

const DEFAULT_LOGGER: Required<SyncLogger> = {
  info: () => {
    // no-op
  },
  warn: (message: string) => {
    console.warn(message);
  },
  error: (message: string) => {
    console.error(message);
  },
};

interface NormalizedAiraloPackage {
  externalId: string;
  name: string;
  description: string | null;
  region: string | null;
  dataLimitMb: number | null;
  validityDays: number | null;
  priceCents: number;
  currency: string;
  metadata: Record<string, unknown> | null;
}

export interface SyncAiraloPackagesOptions {
  prisma?: PrismaClient;
  client?: AiraloClient;
  logger?: SyncLogger;
  packagesOptions?: GetPackagesOptions;
  now?: Date;
}

export interface SyncAiraloPackagesResult {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  deactivated: number;
}

const DATA_AMOUNT_REGEX = /([\d.,]+)\s*(KB|MB|GB|TB)/i;

function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseDataAmountToMb(
  amount: string | null | undefined,
  isUnlimited: boolean | null | undefined,
): number | null {
  if (!amount || isUnlimited) {
    return null;
  }

  const match = amount.match(DATA_AMOUNT_REGEX);
  if (!match) {
    return null;
  }

  const numericPortion = match[1].replace(/,/g, "");
  const value = Number.parseFloat(numericPortion);
  if (!Number.isFinite(value)) {
    return null;
  }

  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = {
    KB: 1 / 1024,
    MB: 1,
    GB: 1024,
    TB: 1024 * 1024,
  };

  const multiplier = multipliers[unit];
  if (!multiplier) {
    return null;
  }

  const megabytes = value * multiplier;
  if (!Number.isFinite(megabytes)) {
    return null;
  }

  return Math.round(megabytes);
}

function normalizePackage(pkg: Package): NormalizedAiraloPackage {
  const priceDetails = resolvePackagePrice(pkg);

  if (!priceDetails) {
    throw new Error(`Unable to resolve price information for Airalo package ${pkg.id}`);
  }

  const { priceCents, currency } = priceDetails;

  const metadata = {
    sku: pkg.sku ?? null,
    destination: pkg.destination,
    destinationName: pkg.destination_name ?? null,
    allowance: pkg.data_amount ?? null,
    isUnlimited: Boolean(pkg.is_unlimited),
  } satisfies Record<string, unknown>;

  return {
    externalId: pkg.id,
    name: pkg.name.trim(),
    description: pkg.destination_name ?? null,
    region: pkg.region ?? null,
    dataLimitMb: parseDataAmountToMb(pkg.data_amount, pkg.is_unlimited ?? undefined),
    validityDays: pkg.validity ?? null,
    priceCents,
    currency,
    metadata,
  };
}

function getSourceHash(pkg: NormalizedAiraloPackage): string {
  const hashPayload = {
    externalId: pkg.externalId,
    name: pkg.name,
    description: pkg.description,
    region: pkg.region,
    dataLimitMb: pkg.dataLimitMb,
    validityDays: pkg.validityDays,
    priceCents: pkg.priceCents,
    currency: pkg.currency,
    metadata: pkg.metadata,
  };

  return createHash("sha256").update(JSON.stringify(hashPayload)).digest("hex");
}

function getMetadataJson(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) {
    return null;
  }

  return JSON.stringify(metadata);
}

interface PaginateAiraloPackagesOptions {
  client: Pick<AiraloClient, "getPackages">;
  logger: Required<SyncLogger>;
  packagesOptions: GetPackagesOptions;
  delayMs?: number;
  onPage: (packages: Package[], page: number) => Promise<void> | void;
}

export async function paginateAiraloPackages({
  client,
  logger,
  packagesOptions,
  onPage,
  delayMs = AIRALO_RATE_LIMIT_DELAY_MS,
}: PaginateAiraloPackagesOptions): Promise<number> {
  const baseOptions: GetPackagesOptions = {
    ...packagesOptions,
  };
  const limit = baseOptions.limit ?? 1000;
  let page = baseOptions.page ?? 1;
  let totalFetched = 0;

  while (true) {
    const requestOptions: GetPackagesOptions = {
      ...baseOptions,
      page,
      limit,
    };
    const packages = await client.getPackages(requestOptions);
    logger.info(`Fetched ${packages.length} packages from Airalo (page ${page})`);
    await onPage(packages, page);
    totalFetched += packages.length;

    if (packages.length < limit) {
      break;
    }

    page += 1;
    await delay(delayMs);
  }

  return totalFetched;
}

function resolveAiraloClient(): AiraloClient {
  const clientId = process.env.AIRALO_CLIENT_ID;
  const clientSecret = process.env.AIRALO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("AIRALO_CLIENT_ID and AIRALO_CLIENT_SECRET must be set");
  }

  return new AiraloClient({
    clientId,
    clientSecret,
    tokenCache: resolveSharedTokenCache(),
  });
}

export async function syncAiraloPackages(
  options: SyncAiraloPackagesOptions = {},
): Promise<SyncAiraloPackagesResult> {
  const logger: Required<SyncLogger> = {
    ...DEFAULT_LOGGER,
    ...options.logger,
  };
  const db = options.prisma ?? prismaClient;
  const client = options.client ?? resolveAiraloClient();
  const now = options.now ?? new Date();

  const packageRequestOptions: GetPackagesOptions = {
    ...options.packagesOptions,
  };

  if (packageRequestOptions.limit === undefined) {
    packageRequestOptions.limit = 1000;
  }

  const existingPackages = await db.airaloPackage.findMany({
    select: {
      externalId: true,
      sourceHash: true,
      isActive: true,
    },
  });

  const existingByExternalId = new Map(
    existingPackages.map((pkg) => [pkg.externalId, pkg]),
  );

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let deactivated = 0;
  let total = 0;
  const seenExternalIds = new Set<string>();

  await paginateAiraloPackages({
    client,
    logger,
    packagesOptions: packageRequestOptions,
    async onPage(packages) {
      for (const pkg of packages) {
        let normalized: NormalizedAiraloPackage;
        try {
          normalized = normalizePackage(pkg);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown error while normalizing Airalo package";
          logger.warn(`Skipping Airalo package ${pkg.id}: ${message}`);
          continue;
        }

        total += 1;
        seenExternalIds.add(normalized.externalId);
        const metadataJson = getMetadataJson(normalized.metadata);
        const sourceHash = getSourceHash(normalized);
        const existing = existingByExternalId.get(normalized.externalId);

        if (!existing) {
          await db.airaloPackage.create({
            data: {
              externalId: normalized.externalId,
              name: normalized.name,
              description: normalized.description,
              region: normalized.region,
              dataLimitMb: normalized.dataLimitMb,
              validityDays: normalized.validityDays,
              priceCents: normalized.priceCents,
              currency: normalized.currency,
              metadata: metadataJson,
              sourceHash,
              lastSyncedAt: now,
              isActive: true,
              deactivatedAt: null,
            },
          });
          existingByExternalId.set(normalized.externalId, {
            externalId: normalized.externalId,
            sourceHash,
            isActive: true,
          });
          created += 1;
          continue;
        }

        if (existing.sourceHash === sourceHash) {
          await db.airaloPackage.update({
            where: { externalId: normalized.externalId },
            data: {
              lastSyncedAt: now,
              isActive: true,
              deactivatedAt: null,
            },
          });
          existingByExternalId.set(normalized.externalId, {
            externalId: normalized.externalId,
            sourceHash,
            isActive: true,
          });
          unchanged += 1;
          continue;
        }

        await db.airaloPackage.update({
          where: { externalId: normalized.externalId },
          data: {
            name: normalized.name,
            description: normalized.description,
            region: normalized.region,
            dataLimitMb: normalized.dataLimitMb,
            validityDays: normalized.validityDays,
            priceCents: normalized.priceCents,
            currency: normalized.currency,
            metadata: metadataJson,
            sourceHash,
            lastSyncedAt: now,
            isActive: true,
            deactivatedAt: null,
          },
        });
        existingByExternalId.set(normalized.externalId, {
          externalId: normalized.externalId,
          sourceHash,
          isActive: true,
        });
        updated += 1;
      }
    },
  });

  const staleExternalIds = existingPackages
    .filter((pkg) => pkg.isActive && !seenExternalIds.has(pkg.externalId))
    .map((pkg) => pkg.externalId);

  if (staleExternalIds.length > 0) {
    const { count } = await db.airaloPackage.updateMany({
      where: { externalId: { in: staleExternalIds } },
      data: {
        isActive: false,
        deactivatedAt: now,
        lastSyncedAt: now,
      },
    });
    deactivated = count;
    logger.info(`Marked ${count} Airalo packages as inactive`);
  }

  return {
    total,
    created,
    updated,
    unchanged,
    deactivated,
  };
}
