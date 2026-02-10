import { Prisma, type PrismaClient } from "@prisma/client";

import {
  AiraloClient,
  type AiraloCountryNode,
  type GetPackagesOptions,
} from "../airalo/client";
import { resolveSharedTokenCache } from "../airalo/token-cache";
import type { Package } from "../airalo/schemas";
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

export interface SyncAiraloPackagesOptions {
  prisma?: PrismaClient;
  client?: AiraloClient;
  logger?: SyncLogger;
  packagesOptions?: GetPackagesOptions;
  allowDeactivation?: boolean;
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
  packagesDeactivated: number;
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

function toPrismaJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  // Sanitize through JSON serialization to ensure Prisma-compatible JSON values.
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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


function requiredEnv(name: "AIRALO_CLIENT_ID" | "AIRALO_CLIENT_SECRET"): string {
  const raw = process.env[name];
  const value = raw?.trim();

  if (!value) {
    throw new Error(`${name} must be set`);
  }

  return value;
}

function resolveAiraloClient(logger: Required<SyncLogger>): AiraloClient {
  const clientId = requiredEnv("AIRALO_CLIENT_ID");
  const clientSecret = requiredEnv("AIRALO_CLIENT_SECRET");

  return new AiraloClient({
    clientId,
    clientSecret,
    tokenCache: resolveSharedTokenCache(),
    logger: {
      info: logger.info,
      warn: logger.warn,
      error: logger.error,
    },
  });
}

export async function syncAiraloPackages(
  options: SyncAiraloPackagesOptions = {},
): Promise<SyncAiraloPackagesResult> {
  const result = await syncAiraloCatalog(options);
  const total = result.packagesCreated + result.packagesUpdated + result.packagesUnchanged;
  recordPackageSyncSuccess(options.now ?? new Date());
  return {
    total,
    created: result.packagesCreated,
    updated: result.packagesUpdated,
    unchanged: result.packagesUnchanged,
    deactivated: result.packagesDeactivated,
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
  const client = options.client ?? resolveAiraloClient(logger);
  const now = options.now ?? new Date();

  logger.info("[airalo-sync] Starting catalog sync");

  const countriesCreated = { count: 0 };
  const countriesUpdated = { count: 0 };
  const operatorsCreated = { count: 0 };
  const operatorsUpdated = { count: 0 };
  const packagesCreated = { count: 0 };
  const packagesUpdated = { count: 0 };
  const packagesUnchanged = { count: 0 };
  const packagesDeactivated = { count: 0 };
  const seenPackageExternalIds = new Set<string>();

  const countries = await fetchAllCountries();
  logger.info(`[airalo-sync] Completed Airalo fetch stage with ${countries.length} merged countries`);

  for (const country of countries ?? []) {
    const countryCode =
      country?.country_code ?? country?.slug ?? country?.title ?? "unknown";
    const slug = country?.slug ?? countryCode.toLowerCase();
    const countryName = country?.title ?? slug;
    const countryImageUrl = country?.image?.url ?? null;
    const countryFlagUrl = country?.image?.url ?? null;

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
        flagUrl: countryFlagUrl,
        metadata: toPrismaJson(country),
      },
      update: {
        slug,
        name: countryName,
        imageUrl: countryImageUrl,
        flagUrl: countryFlagUrl,
        metadata: toPrismaJson(country),
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
      const operatorNetworkTypes = Array.isArray((operator as Record<string, unknown>).network_types)
        ? ((operator as Record<string, unknown>).network_types as string[]).map((n) => n.toString())
        : [];

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
          networkTypes: operatorNetworkTypes,
          metadata: toPrismaJson(operator),
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
          networkTypes: operatorNetworkTypes,
          metadata: toPrismaJson(operator),
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
        seenPackageExternalIds.add(externalId);

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
          status: (pkg as Record<string, unknown>).status?.toString() ?? "active",
          simType: (pkg as Record<string, unknown>).sim_type?.toString() ?? null,
          isRechargeable: Boolean((pkg as Record<string, unknown>).is_rechargeable ?? null),
          networkTypes: Array.isArray((pkg as Record<string, unknown>).network_types)
            ? ((pkg as Record<string, unknown>).network_types as string[])
            : [],
          voiceMinutes: typeof (pkg as Record<string, unknown>).voice === "number"
            ? ((pkg as Record<string, unknown>).voice as number)
            : null,
          sms: typeof (pkg as Record<string, unknown>).sms === "number"
            ? ((pkg as Record<string, unknown>).sms as number)
            : null,
          apn: (pkg as Record<string, unknown>).apn?.toString() ?? null,
          iccid: (pkg as Record<string, unknown>).iccid?.toString() ?? null,
          smdpAddress: (pkg as Record<string, unknown>).smdp_address?.toString() ?? null,
          qrCodeData: (pkg as Record<string, unknown>).qr_code_data?.toString() ?? null,
          qrCodeUrl: (pkg as Record<string, unknown>).qr_code_url?.toString() ?? null,
          activationCode: (pkg as Record<string, unknown>).activation_code?.toString() ?? null,
          topupParentId: (pkg as Record<string, unknown>).top_up_parent_package_id
            ? (pkg as Record<string, unknown>).top_up_parent_package_id!.toString()
            : null,
          dataAmountMb,
          validityDays,
          isUnlimited: Boolean(pkg.is_unlimited ?? pkg.isUnlimited),
          priceCents,
          sellingPriceCents,
          currencyCode,
          netPriceJson: toPrismaJson(pkg.prices?.net_price ?? null),
          rrpPriceJson: toPrismaJson(pkg.prices?.recommended_retail_price ?? null),
          shortInfo: pkg.short_info ?? null,
          qrInstallation: pkg.qr_installation ?? null,
          manualInstallation: pkg.manual_installation ?? null,
          isFairUsagePolicy: pkg.is_fair_usage_policy ?? null,
          fairUsagePolicy: pkg.fair_usage_policy ?? null,
          imageUrl: pkg.image?.url ?? null,
          metadata: toPrismaJson(pkg),
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
            "status",
            "simType",
            "isRechargeable",
            "dataAmountMb",
            "validityDays",
            "isUnlimited",
            "priceCents",
            "currencyCode",
            "netPriceJson",
            "rrpPriceJson",
            "shortInfo",
            "qrInstallation",
            "manualInstallation",
            "isFairUsagePolicy",
            "fairUsagePolicy",
            "imageUrl",
            "voiceMinutes",
            "sms",
            "apn",
            "iccid",
            "smdpAddress",
            "qrCodeData",
            "qrCodeUrl",
            "activationCode",
            "topupParentId",
          ] as const;

          for (const key of comparableKeys) {
            if (existingPackage[key] !== packageData[key]) {
              return true;
            }
          }

          const existingNetworks = Array.isArray(existingPackage.networkTypes)
            ? existingPackage.networkTypes.join("|")
            : "";
          const nextNetworks = Array.isArray(packageData.networkTypes)
            ? packageData.networkTypes.join("|")
            : "";
          if (existingNetworks !== nextNetworks) {
            return true;
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

  const allowDeactivation =
    typeof options.allowDeactivation === "boolean"
      ? options.allowDeactivation
      : !options.packagesOptions?.filter;

  if (allowDeactivation && seenPackageExternalIds.size > 0) {
    const activePackages = await db.package.findMany({
      where: { isActive: true },
      select: { id: true, externalId: true },
    });
    const missing = activePackages.filter(
      (pkg) => !seenPackageExternalIds.has(pkg.externalId),
    );

    const CHUNK_SIZE = 500;
    for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
      const chunkIds = missing.slice(i, i + CHUNK_SIZE).map((pkg) => pkg.id);
      const result = await db.package.updateMany({
        where: { id: { in: chunkIds } },
        data: { isActive: false, deactivatedAt: now },
      });
      packagesDeactivated.count += result.count;
    }

    if (packagesDeactivated.count > 0) {
      logger.warn(
        `Deactivated ${packagesDeactivated.count} packages missing from the latest Airalo sync.`,
      );
    }
  }

  logger.info(
    `[airalo-sync] Sync summary countries(created=${countriesCreated.count}, updated=${countriesUpdated.count}) operators(created=${operatorsCreated.count}, updated=${operatorsUpdated.count}) packages(created=${packagesCreated.count}, updated=${packagesUpdated.count}, unchanged=${packagesUnchanged.count}, deactivated=${packagesDeactivated.count})`,
  );

  return {
    countriesCreated: countriesCreated.count,
    countriesUpdated: countriesUpdated.count,
    operatorsCreated: operatorsCreated.count,
    operatorsUpdated: operatorsUpdated.count,
    packagesCreated: packagesCreated.count,
    packagesUpdated: packagesUpdated.count,
    packagesUnchanged: packagesUnchanged.count,
    packagesDeactivated: packagesDeactivated.count,
  };
}
