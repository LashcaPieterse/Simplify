import { createHash } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import {
  AiraloClient,
  type AiraloCountryNode,
  type GetPackagesOptions,
} from "../airalo/client";
import { resolveSharedTokenCache } from "../airalo/token-cache";
import type { Package } from "../airalo/schemas";
import { resolvePackagePrice } from "../airalo/pricing";
import prismaClient from "../db/client";
import { recordPackageSyncSuccess } from "../observability/metrics";

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

export interface SyncAiraloCatalogResult {
  countriesCreated: number;
  countriesUpdated: number;
  operatorsCreated: number;
  operatorsUpdated: number;
  packagesCreated: number;
  packagesUpdated: number;
  packagesUnchanged: number;
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
    netPrices: pkg.net_prices ?? null,
    recommendedRetailPrices: pkg.recommended_retail_prices ?? null,
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
  if (!("country" in db) || !("operator" in db) || !("package" in db)) {
    throw new Error("Prisma client is missing models (country/operator/package). Run `npx prisma generate` to refresh the client.");
  }
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

  recordPackageSyncSuccess(now);

  return {
    total,
    created,
    updated,
    unchanged,
    deactivated,
  };
}

export async function syncAiraloCatalog(
  options: SyncAiraloPackagesOptions = {},
): Promise<SyncAiraloCatalogResult> {
  // Paginate the hierarchical packages endpoint and merge results by country/operator.
  async function fetchAllCountries(): Promise<AiraloCountryNode[]> {
    const baseOptions: GetPackagesOptions = {
      ...options.packagesOptions,
    };
    const limit = baseOptions.limit ?? 100;
    let page = baseOptions.page ?? 1;
    const merged = new Map<string, AiraloCountryNode>();

    const mergePage = (countries: AiraloCountryNode[]) => {
      for (const country of countries ?? []) {
        const countryCodeKey =
          (country?.country_code ?? country?.slug ?? country?.title ?? "").toLowerCase() ||
          `unknown-${merged.size + 1}`;

        const existingCountry = merged.get(countryCodeKey);
        if (!existingCountry) {
          merged.set(countryCodeKey, {
            ...country,
            operators: [...(country.operators ?? [])],
          });
          continue;
        }

        existingCountry.image ??= country?.image;
        existingCountry.title ??= country?.title;

        existingCountry.operators ??= [];
        for (const operator of country.operators ?? []) {
          const operatorKey =
            operator?.id ?? operator?.operator_code ?? operator?.title ?? operator?.name;

          const existingOperator = existingCountry.operators.find(
            (op) => (op?.id ?? op?.operator_code ?? op?.title ?? op?.name) === operatorKey,
          );

          if (!existingOperator) {
            existingCountry.operators.push({
              ...operator,
              packages: [...(operator.packages ?? [])],
            });
            continue;
          }

          existingOperator.packages ??= [];
          existingOperator.packages.push(...(operator.packages ?? []));
        }
      }
    };

    while (true) {
      const countriesPage = await client.getPackagesTree({
        ...baseOptions,
        page,
        limit,
      });
      logger.info(`Fetched ${countriesPage.length} countries from Airalo (page ${page})`);
      mergePage(countriesPage);

      if (countriesPage.length < limit) {
        break;
      }

      page += 1;
      await delay(AIRALO_RATE_LIMIT_DELAY_MS);
    }

    return Array.from(merged.values());
  }

  const logger: Required<SyncLogger> = {
    ...DEFAULT_LOGGER,
    ...options.logger,
  };
  const db = options.prisma ?? prismaClient;
  const client = options.client ?? resolveAiraloClient();
  const now = options.now ?? new Date();

  const countriesCreated = { count: 0 };
  const countriesUpdated = { count: 0 };
  const operatorsCreated = { count: 0 };
  const operatorsUpdated = { count: 0 };
  const packagesCreated = { count: 0 };
  const packagesUpdated = { count: 0 };
  const packagesUnchanged = { count: 0 };

  const countries = await fetchAllCountries();

  for (const country of countries ?? []) {
    const countryCode =
      country?.country_code ?? country?.slug ?? country?.title ?? "unknown";
    const slug = country?.slug ?? countryCode.toLowerCase();
    const countryName = country?.title ?? slug;
    const countryImageUrl = country?.image?.url ?? null;

    const existingCountry = await db.country.findUnique({
      where: { countryCode },
    });

    const countryRecord = await db.country.upsert({
      where: { countryCode },
      create: {
        countryCode,
        slug,
        name: countryName,
        imageUrl: countryImageUrl,
        metadata: country ?? {},
      },
      update: {
        slug,
        name: countryName,
        imageUrl: countryImageUrl,
        metadata: country ?? {},
        updatedAt: now,
      },
    });

    if (existingCountry) {
      countriesUpdated.count += 1;
    } else {
      countriesCreated.count += 1;
    }

    for (const operator of country.operators ?? []) {
      const apiOperatorId =
        typeof operator?.id === "number"
          ? operator.id
          : Number.parseInt(String(operator?.id ?? ""), 10) || undefined;
      const operatorName = operator?.title ?? operator?.name ?? "Unknown";

      const existingOperator = await db.operator.findFirst({
        where: {
          countryId: countryRecord.id,
          ...(apiOperatorId ? { apiOperatorId } : { name: operatorName }),
        },
      });

      let operatorRecord = existingOperator;
      if (!existingOperator) {
        operatorRecord = await db.operator.create({
          data: {
            countryId: countryRecord.id,
            name: operatorName,
            apiOperatorId,
            operatorCode: operator?.operator_code ?? null,
            metadata: operator ?? {},
          },
        });
        operatorsCreated.count += 1;
      } else {
        await db.operator.update({
          where: { id: existingOperator.id },
          data: {
            name: operatorName,
            apiOperatorId,
            operatorCode: operator?.operator_code ?? null,
            metadata: operator ?? {},
            updatedAt: now,
          },
        });
        operatorsUpdated.count += 1;
        operatorRecord = await db.operator.findUniqueOrThrow({
          where: { id: existingOperator.id },
        });
      }

      for (const pkg of operator.packages ?? []) {
        const externalId = String(pkg.id ?? pkg.slug ?? pkg.title ?? "");
        if (!externalId) continue;

        const dataAmountMb = parseDataAmountToMb(
          pkg.data,
          pkg.is_unlimited ?? pkg.isUnlimited,
        );
        const resolvePriceFromMap = (record: Record<string, unknown> | undefined) => {
          if (!record || typeof record !== "object") return null;

          const entries = Object.entries(record).filter(
            ([, value]) => typeof value === "number" && Number.isFinite(value),
          );
          if (entries.length === 0) return null;

          const usdEntry = entries.find(([currency]) => currency.toUpperCase() === "USD");
          const [currency, amount] = usdEntry ?? entries[0];
          return {
            cents: Math.round((amount as number) * 100),
            currency: currency.toUpperCase(),
          };
        };

        const netPrice = resolvePriceFromMap(pkg.prices?.net_price);
        const retailPrice =
          resolvePriceFromMap(pkg.prices?.recommended_retail_price) ??
          (typeof pkg.price === "number" && Number.isFinite(pkg.price)
            ? {
                cents: Math.round(pkg.price * 100),
                currency: (pkg.currency ?? "USD").toUpperCase(),
              }
            : null);

        const priceCents = netPrice?.cents ?? retailPrice?.cents ?? 0;
        const sellingPriceCents = retailPrice?.cents ?? null;
        const currencyCode =
          retailPrice?.currency ?? netPrice?.currency ?? (pkg.currency ?? "USD");
        const validityDays =
          typeof pkg.day === "number"
            ? pkg.day
            : typeof pkg.validity === "number"
              ? pkg.validity
              : null;

        const packageData = {
          countryId: countryRecord.id,
          operatorId: operatorRecord.id,
          name: pkg.title ?? pkg.name ?? "Unknown",
          dataAmountMb,
          validityDays,
          isUnlimited: Boolean(pkg.is_unlimited ?? pkg.isUnlimited),
          priceCents,
          sellingPriceCents,
          currencyCode,
          shortInfo: pkg.short_info ?? null,
          qrInstallation: pkg.qr_installation ?? null,
          manualInstallation: pkg.manual_installation ?? null,
          isFairUsagePolicy: pkg.is_fair_usage_policy ?? null,
          fairUsagePolicy: pkg.fair_usage_policy ?? null,
          imageUrl: pkg.image?.url ?? null,
          metadata: pkg ?? {},
          isActive: true,
          deactivatedAt: null as Date | null,
        };

        const existingPackage = await db.package.findUnique({
          where: { externalId },
        });

        if (!existingPackage) {
          await db.package.create({
            data: {
              externalId,
              ...packageData,
            },
          });
          packagesCreated.count += 1;
          continue;
        }

        const hasChanges = (() => {
          const comparableKeys = [
            "name",
            "dataAmountMb",
            "validityDays",
            "isUnlimited",
            "priceCents",
            "currencyCode",
            "shortInfo",
            "qrInstallation",
            "manualInstallation",
            "isFairUsagePolicy",
            "fairUsagePolicy",
            "imageUrl",
          ] as const;

          for (const key of comparableKeys) {
            if (
              // @ts-expect-error index access for comparison
              existingPackage[key] !== packageData[key]
            ) {
              return true;
            }
          }

          const existingMeta = JSON.stringify(existingPackage.metadata ?? {});
          const nextMeta = JSON.stringify(packageData.metadata ?? {});
          if (existingMeta !== nextMeta) return true;

          if (
            existingPackage.countryId !== packageData.countryId ||
            existingPackage.operatorId !== packageData.operatorId
          ) {
            return true;
          }

          return false;
        })();

        if (hasChanges) {
          await db.package.update({
            where: { externalId },
            data: {
              ...packageData,
              updatedAt: now,
            },
          });
          packagesUpdated.count += 1;
        } else {
          packagesUnchanged.count += 1;
        }
      }
    }
  }

  return {
    countriesCreated: countriesCreated.count,
    countriesUpdated: countriesUpdated.count,
    operatorsCreated: operatorsCreated.count,
    operatorsUpdated: operatorsUpdated.count,
    packagesCreated: packagesCreated.count,
    packagesUpdated: packagesUpdated.count,
    packagesUnchanged: packagesUnchanged.count,
  };
}
