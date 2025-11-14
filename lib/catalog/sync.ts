import { createHash } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import { AiraloClient, type GetPackagesOptions } from "../airalo/client";
import type { Package } from "../airalo/schemas";
import prismaClient from "../db/client";

interface SyncLogger {
  info?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
}

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

type MultiCurrencyPriceDetails =
  Package["net_prices"] extends Record<string, infer T> ? T : never;

interface ResolvedPriceDetails {
  priceCents: number;
  currency: string;
}

function coerceNumericValue(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return numeric;
}

function extractPriceFromDetails(
  details: MultiCurrencyPriceDetails | undefined,
): ResolvedPriceDetails | null {
  if (!details || typeof details !== "object") {
    return null;
  }

  const record = details as Record<string, unknown>;

  const amount =
    coerceNumericValue(record.amount) ??
    coerceNumericValue(record.value) ??
    coerceNumericValue(record.price);

  if (amount === null) {
    return null;
  }

  const currency = record.currency;

  if (currency && typeof currency === "string") {
    return {
      priceCents: Math.round(amount * 100),
      currency: currency.toUpperCase(),
    };
  }

  return {
    priceCents: Math.round(amount * 100),
    currency: "",
  };
}

function resolvePriceFromMap(
  prices: Package["net_prices"],
): ResolvedPriceDetails | null {
  if (!prices) {
    return null;
  }

  const normalizedEntries = Object.entries(prices).filter(
    (entry): entry is [string, MultiCurrencyPriceDetails] =>
      entry[1] !== undefined && entry[1] !== null,
  );

  if (normalizedEntries.length === 0) {
    return null;
  }

  const usdEntry = normalizedEntries.find(
    ([key]) => key.toUpperCase() === "USD",
  );

  const preferredEntry = usdEntry ?? normalizedEntries[0];

  const resolved = extractPriceFromDetails(preferredEntry[1]);
  if (!resolved) {
    return null;
  }

  if (!resolved.currency) {
    resolved.currency = preferredEntry[0].toUpperCase();
  }

  return resolved;
}

function resolvePackagePrice(pkg: Package): ResolvedPriceDetails {
  if (pkg.price !== undefined && pkg.price !== null && pkg.currency) {
    return {
      priceCents: Math.round(pkg.price * 100),
      currency: pkg.currency.toUpperCase(),
    };
  }

  const multiCurrency =
    resolvePriceFromMap(pkg.net_prices) ??
    resolvePriceFromMap(pkg.recommended_retail_prices);

  if (multiCurrency && multiCurrency.currency) {
    return multiCurrency;
  }

  if (multiCurrency && !multiCurrency.currency) {
    return {
      priceCents: multiCurrency.priceCents,
      currency: "USD",
    };
  }

  throw new Error(`Unable to resolve price information for Airalo package ${pkg.id}`);
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
}

const DATA_AMOUNT_REGEX = /([\d.,]+)\s*(KB|MB|GB|TB)/i;

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
  const { priceCents, currency } = resolvePackagePrice(pkg);

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

function resolveAiraloClient(): AiraloClient {
  const clientId = process.env.AIRALO_CLIENT_ID;
  const clientSecret = process.env.AIRALO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("AIRALO_CLIENT_ID and AIRALO_CLIENT_SECRET must be set");
  }

  return new AiraloClient({
    clientId,
    clientSecret,
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

  const packages = await client.getPackages(packageRequestOptions);
  logger.info(`Fetched ${packages.length} packages from Airalo`);

  const normalizedPackages: NormalizedAiraloPackage[] = [];

  for (const pkg of packages) {
    try {
      normalizedPackages.push(normalizePackage(pkg));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error while normalizing Airalo package";
      logger.warn(`Skipping Airalo package ${pkg.id}: ${message}`);
    }
  }
  const existingPackages = await db.airaloPackage.findMany({
    select: {
      externalId: true,
      sourceHash: true,
    },
  });

  const existingByExternalId = new Map(
    existingPackages.map((pkg) => [pkg.externalId, pkg]),
  );

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const pkg of normalizedPackages) {
    const metadataJson = getMetadataJson(pkg.metadata);
    const sourceHash = getSourceHash(pkg);
    const existing = existingByExternalId.get(pkg.externalId);

    if (!existing) {
      await db.airaloPackage.create({
        data: {
          externalId: pkg.externalId,
          name: pkg.name,
          description: pkg.description,
          region: pkg.region,
          dataLimitMb: pkg.dataLimitMb,
          validityDays: pkg.validityDays,
          priceCents: pkg.priceCents,
          currency: pkg.currency,
          metadata: metadataJson,
          sourceHash,
          lastSyncedAt: now,
        },
      });
      created += 1;
      continue;
    }

    if (existing.sourceHash === sourceHash) {
      await db.airaloPackage.update({
        where: { externalId: pkg.externalId },
        data: {
          lastSyncedAt: now,
        },
      });
      unchanged += 1;
      continue;
    }

    await db.airaloPackage.update({
      where: { externalId: pkg.externalId },
      data: {
        name: pkg.name,
        description: pkg.description,
        region: pkg.region,
        dataLimitMb: pkg.dataLimitMb,
        validityDays: pkg.validityDays,
        priceCents: pkg.priceCents,
        currency: pkg.currency,
        metadata: metadataJson,
        sourceHash,
        lastSyncedAt: now,
      },
    });
    updated += 1;
  }

  return {
    total: normalizedPackages.length,
    created,
    updated,
    unchanged,
  };
}
