import { createHash, randomUUID } from "crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

import {
  AiraloClient,
  type AiraloPackageNode,
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
const CHUNK_SIZE = 500;

const DEFAULT_LOGGER: Required<SyncLogger> = {
  info: () => {},
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
  syncRunId?: string;
  triggeredBy?: string;
  runNotes?: string;
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

interface PaginateAiraloPackagesOptions {
  client: Pick<AiraloClient, "getPackages">;
  logger: Required<SyncLogger>;
  packagesOptions: GetPackagesOptions;
  delayMs?: number;
  onPage: (packages: Package[], page: number) => Promise<void> | void;
}

type ResolvedPrice = {
  amount: number;
  currency: string;
};

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requiredEnv(name: "AIRALO_CLIENT_ID" | "AIRALO_CLIENT_SECRET"): string {
  const raw = process.env[name];
  const value = raw?.trim();

  if (!value) {
    throw new Error(`${name} must be set`);
  }

  return value;
}

function resolveAiraloClient(): AiraloClient {
  const clientId = requiredEnv("AIRALO_CLIENT_ID");
  const clientSecret = requiredEnv("AIRALO_CLIENT_SECRET");

  return new AiraloClient({
    clientId,
    clientSecret,
    tokenCache: resolveSharedTokenCache(),
  });
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function parseInteger(value: unknown): number | null {
  const parsed = parseNumber(value);
  if (parsed === null) {
    return null;
  }
  return Math.trunc(parsed);
}

function normalizeString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveFirstCurrencyAmount(map: unknown): ResolvedPrice | null {
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    return null;
  }

  const entries = Object.entries(map as Record<string, unknown>).filter(([, amount]) => {
    const parsed = parseNumber(amount);
    return parsed !== null;
  });

  if (!entries.length) {
    return null;
  }

  const usd = entries.find(([currency]) => currency.toUpperCase() === "USD");
  const [currency, rawAmount] = usd ?? entries[0];
  const amount = parseNumber(rawAmount);

  if (amount === null) {
    return null;
  }

  return {
    amount,
    currency: currency.toUpperCase(),
  };
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stableHash(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractEnvelope(raw: unknown): {
  links: unknown;
  meta: unknown;
  pricing: unknown;
} {
  if (!isObject(raw)) {
    return { links: null, meta: null, pricing: null };
  }

  const links = "links" in raw ? raw.links : null;
  const meta = "meta" in raw ? raw.meta : null;
  const pricing = "pricing" in raw ? raw.pricing : null;
  return { links, meta, pricing };
}

function normalizePackageData(pkg: AiraloPackageNode, operatorId: string) {
  const airaloPackageId = normalizeString(pkg.id ?? pkg.slug ?? pkg.title);
  if (!airaloPackageId) {
    return null;
  }

  const rawType = (pkg as Record<string, unknown>).type;
  const type = normalizeString(rawType, "sim");
  const title = normalizeString(pkg.title ?? pkg.name, airaloPackageId);
  const amount = parseInteger(pkg.amount) ?? 0;
  const data = normalizeString(pkg.data, amount > 0 ? `${amount} MB` : "0 MB");
  const day = parseInteger(pkg.day ?? pkg.validity) ?? 0;
  const isUnlimited = Boolean(pkg.is_unlimited ?? pkg.isUnlimited);
  const manualInstallation = normalizeString(pkg.manual_installation, "");
  const qrInstallation = normalizeString(pkg.qr_installation, "");
  const isFairUsagePolicy =
    typeof pkg.is_fair_usage_policy === "boolean" ? pkg.is_fair_usage_policy : null;
  const fairUsagePolicy = normalizeString(pkg.fair_usage_policy, "") || null;

  const netPriceResolved = resolveFirstCurrencyAmount(pkg.prices?.net_price);
  const rrpResolved = resolveFirstCurrencyAmount(pkg.prices?.recommended_retail_price);
  const fallbackPrice = parseNumber(pkg.price);

  const netPrice = netPriceResolved?.amount ?? null;
  const price = rrpResolved?.amount ?? fallbackPrice ?? netPriceResolved?.amount ?? 0;
  const currency = normalizeString(
    (pkg as Record<string, unknown>).currency,
    rrpResolved?.currency ?? netPriceResolved?.currency ?? "USD",
  ).toUpperCase();

  const text = parseInteger((pkg as Record<string, unknown>).text);
  const voice = parseInteger((pkg as Record<string, unknown>).voice);
  const shortInfo = normalizeString(pkg.short_info, "") || null;

  const packageData = {
    operatorId,
    airaloPackageId,
    type,
    title,
    amount,
    data,
    day,
    isUnlimited,
    manualInstallation,
    qrInstallation,
    isFairUsagePolicy,
    fairUsagePolicy,
    netPrice,
    price,
    pricesNetPrice: toPrismaJson(pkg.prices?.net_price ?? null),
    pricesRecommendedRetailPrice: toPrismaJson(pkg.prices?.recommended_retail_price ?? null),
    shortInfo,
    text,
    voice,
  };

  const basePriceCents = Math.round((netPrice ?? price) * 100);
  const defaultSellingPriceCents = Math.round(price * 100);
  const sourceHash = stableHash({
    airaloPackageId,
    type,
    title,
    amount,
    data,
    day,
    isUnlimited,
    manualInstallation,
    qrInstallation,
    isFairUsagePolicy,
    fairUsagePolicy,
    netPrice,
    price,
    prices: pkg.prices ?? null,
    shortInfo,
    text,
    voice,
  });

  return {
    airaloPackageId,
    currency,
    packageData,
    basePriceCents,
    defaultSellingPriceCents,
    sourcePriceDecimal: netPrice ?? price,
    defaultSellPriceDecimal: price,
    sourceHash,
  };
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
  const logger: Required<SyncLogger> = {
    ...DEFAULT_LOGGER,
    ...options.logger,
  };
  const db = options.prisma ?? prismaClient;
  const client = options.client ?? resolveAiraloClient();
  const now = options.now ?? new Date();

  const runId = options.syncRunId ?? randomUUID();
  const ownsRun = !options.syncRunId;

  if (ownsRun) {
    await db.syncRun.create({
      data: {
        id: runId,
        status: "running",
        source: "airalo",
        triggeredBy: options.triggeredBy ?? "system",
        notes: options.runNotes ?? "catalog sync",
        startedAt: now,
      },
    });
  }

  const countriesCreated = { count: 0 };
  const countriesUpdated = { count: 0 };
  const operatorsCreated = { count: 0 };
  const operatorsUpdated = { count: 0 };
  const packagesCreated = { count: 0 };
  const packagesUpdated = { count: 0 };
  const packagesUnchanged = { count: 0 };
  const packagesDeactivated = { count: 0 };
  const seenPackageIds = new Set<string>();

  const baseOptions: GetPackagesOptions = {
    ...options.packagesOptions,
  };
  const limit = baseOptions.limit ?? 100;
  let page = baseOptions.page ?? 1;

  try {
    while (true) {
      logger.info(`[airalo-sync] Fetching package tree page ${page}`);

      const pageResult = await client.getPackagesTreePageRaw({
        ...baseOptions,
        page,
        limit,
      });
      const countriesPage = pageResult.countries ?? [];
      const envelope = extractEnvelope(pageResult.rawResponse);

      await db.packageSyncPage.upsert({
        where: { runId_page: { runId, page } },
        create: {
          runId,
          page,
          limit,
          linksJson: toPrismaJson(envelope.links),
          metaJson: toPrismaJson(envelope.meta),
          pricingJson: toPrismaJson(envelope.pricing),
          countryCount: countriesPage.length,
          capturedAt: now,
        },
        update: {
          limit,
          linksJson: toPrismaJson(envelope.links),
          metaJson: toPrismaJson(envelope.meta),
          pricingJson: toPrismaJson(envelope.pricing),
          countryCount: countriesPage.length,
          capturedAt: now,
        },
      });

      for (const country of countriesPage) {
        const providedCountryCode = normalizeString(country.country_code, "");
        const normalizedSlug = slugify(
          normalizeString(country.slug, normalizeString(country.title, providedCountryCode || "unknown")),
        );
        const slug = normalizeString(normalizedSlug, "unknown");
        const countryCode = normalizeString(
          providedCountryCode,
          `AIRALO-${slug}`,
        ).toUpperCase();
        const title = normalizeString(country.title, slug);
        const imageJson = toPrismaJson(country.image ?? null);

        const countryByCode = await db.country.findUnique({ where: { countryCode } });
        const countryBySlug = await db.country.findUnique({ where: { slug } });
        const existingCountry = countryByCode ?? countryBySlug;
        const hasIdentityConflict =
          countryByCode !== null &&
          countryBySlug !== null &&
          countryByCode.id !== countryBySlug.id;

        if (hasIdentityConflict) {
          logger.warn(
            `[airalo-sync] Country identity conflict for code=${countryCode} slug=${slug}; preserving existing code/slug pair`,
          );
        }

        const countryData = {
          countryCode: hasIdentityConflict && countryByCode ? countryByCode.countryCode : countryCode,
          slug: hasIdentityConflict && countryByCode ? countryByCode.slug : slug,
          title,
          imageJson,
        };

        const countryRecord = existingCountry
          ? await db.country.update({
              where: { id: existingCountry.id },
              data: {
                ...countryData,
                updatedAt: now,
              },
            })
          : await db.country.create({
              data: countryData,
            });

        if (existingCountry) {
          countriesUpdated.count += 1;
        } else {
          countriesCreated.count += 1;
        }

        for (const operator of country.operators ?? []) {
          const operatorRaw = operator as Record<string, unknown>;
          const airaloOperatorId = parseInteger(operator.id);
          const titleValue = normalizeString(operator.title ?? operator.name, "Unknown");
          const operatorLookup: Prisma.OperatorWhereInput = {
            countryId: countryRecord.id,
            ...(airaloOperatorId !== null
              ? { airaloOperatorId }
              : { title: titleValue }),
          };

          const existingOperator = await db.operator.findFirst({
            where: operatorLookup,
          });

          const operatorData = {
            countryId: countryRecord.id,
            airaloOperatorId,
            activationPolicy: normalizeString(operatorRaw.activation_policy, "") || null,
            apn: toPrismaJson(operatorRaw.apn ?? null),
            apnType: normalizeString(operatorRaw.apn_type, "") || null,
            apnValue: normalizeString(operatorRaw.apn_value, "") || null,
            countriesJson: toPrismaJson(operatorRaw.countries ?? null),
            coveragesJson: toPrismaJson(operatorRaw.coverages ?? null),
            esimType: normalizeString(operatorRaw.esim_type, "") || null,
            gradientEnd: normalizeString(operatorRaw.gradient_end, "") || null,
            gradientStart: normalizeString(operatorRaw.gradient_start, "") || null,
            imageJson: toPrismaJson(operatorRaw.image ?? null),
            info: normalizeStringArray(operatorRaw.info),
            installWindowDays: parseInteger(operatorRaw.install_window_days),
            isKycVerify:
              typeof operatorRaw.is_kyc_verify === "boolean" ? operatorRaw.is_kyc_verify : null,
            isPrepaid:
              typeof operatorRaw.is_prepaid === "boolean" ? operatorRaw.is_prepaid : null,
            isRoaming:
              typeof operatorRaw.is_roaming === "boolean" ? operatorRaw.is_roaming : null,
            otherInfo: normalizeString(operatorRaw.other_info, "") || null,
            planType: normalizeString(operatorRaw.plan_type, "") || null,
            rechargeability:
              typeof operatorRaw.rechargeability === "boolean"
                ? operatorRaw.rechargeability
                : null,
            style: normalizeString(operatorRaw.style, "") || null,
            title: titleValue,
            topupGraceWindowDays: parseInteger(operatorRaw.topup_grace_window_days),
            type: normalizeString(operatorRaw.type, "") || null,
            warning: toPrismaJson(operatorRaw.warning ?? null),
          };

          const operatorRecord = existingOperator
            ? await db.operator.update({
                where: { id: existingOperator.id },
                data: {
                  ...operatorData,
                  updatedAt: now,
                },
              })
            : await db.operator.create({ data: operatorData });

          if (existingOperator) {
            operatorsUpdated.count += 1;
          } else {
            operatorsCreated.count += 1;
          }

          for (const pkg of operator.packages ?? []) {
            const normalized = normalizePackageData(pkg as AiraloPackageNode, operatorRecord.id);
            if (!normalized) {
              continue;
            }
            seenPackageIds.add(normalized.airaloPackageId);

            const existingPackage = await db.package.findUnique({
              where: { airaloPackageId: normalized.airaloPackageId },
              include: { state: true },
            });

            const previousSellCents = existingPackage?.state?.sellingPriceCents ?? null;
            const previousSellDecimal = decimalToNumber(existingPackage?.state?.sellPriceDecimal);

            const stateData = {
              isActive: true,
              deactivatedAt: null as Date | null,
              basePriceCents: normalized.basePriceCents,
              sellingPriceCents: previousSellCents ?? normalized.defaultSellingPriceCents,
              currencyCode: normalized.currency,
              sourcePriceDecimal: normalized.sourcePriceDecimal,
              sellPriceDecimal: previousSellDecimal ?? normalized.defaultSellPriceDecimal,
              lastSyncedAt: now,
              sourceHash: normalized.sourceHash,
            };

            if (!existingPackage) {
              await db.package.create({
                data: {
                  ...normalized.packageData,
                  state: { create: stateData },
                },
              });
              packagesCreated.count += 1;
              continue;
            }

            const hasPackageChanges =
              existingPackage.operatorId !== normalized.packageData.operatorId ||
              existingPackage.type !== normalized.packageData.type ||
              existingPackage.title !== normalized.packageData.title ||
              existingPackage.amount !== normalized.packageData.amount ||
              existingPackage.data !== normalized.packageData.data ||
              existingPackage.day !== normalized.packageData.day ||
              existingPackage.isUnlimited !== normalized.packageData.isUnlimited ||
              existingPackage.manualInstallation !== normalized.packageData.manualInstallation ||
              existingPackage.qrInstallation !== normalized.packageData.qrInstallation ||
              existingPackage.isFairUsagePolicy !== normalized.packageData.isFairUsagePolicy ||
              existingPackage.fairUsagePolicy !== normalized.packageData.fairUsagePolicy ||
              decimalToNumber(existingPackage.netPrice) !== normalized.packageData.netPrice ||
              decimalToNumber(existingPackage.price) !== normalized.packageData.price ||
              JSON.stringify(existingPackage.pricesNetPrice ?? null) !==
                JSON.stringify(normalized.packageData.pricesNetPrice ?? null) ||
              JSON.stringify(existingPackage.pricesRecommendedRetailPrice ?? null) !==
                JSON.stringify(normalized.packageData.pricesRecommendedRetailPrice ?? null) ||
              existingPackage.shortInfo !== normalized.packageData.shortInfo ||
              existingPackage.text !== normalized.packageData.text ||
              existingPackage.voice !== normalized.packageData.voice;

            const hasStateChanges =
              existingPackage.state?.isActive !== stateData.isActive ||
              existingPackage.state?.deactivatedAt?.toISOString() !==
                stateData.deactivatedAt?.toISOString() ||
              existingPackage.state?.basePriceCents !== stateData.basePriceCents ||
              existingPackage.state?.sellingPriceCents !== stateData.sellingPriceCents ||
              existingPackage.state?.currencyCode !== stateData.currencyCode ||
              decimalToNumber(existingPackage.state?.sourcePriceDecimal) !==
                stateData.sourcePriceDecimal ||
              decimalToNumber(existingPackage.state?.sellPriceDecimal) !==
                stateData.sellPriceDecimal ||
              existingPackage.state?.sourceHash !== stateData.sourceHash;

            if (!hasPackageChanges && !hasStateChanges) {
              packagesUnchanged.count += 1;
              continue;
            }

            await db.package.update({
              where: { id: existingPackage.id },
              data: {
                ...normalized.packageData,
                updatedAt: now,
                state: {
                  upsert: {
                    create: stateData,
                    update: stateData,
                  },
                },
              },
            });
            packagesUpdated.count += 1;
          }
        }
      }

      logger.info(`[airalo-sync] Fetched ${countriesPage.length} countries from page ${page}`);
      if (countriesPage.length < limit) {
        break;
      }

      page += 1;
      await delay(AIRALO_RATE_LIMIT_DELAY_MS);
    }

    const allowDeactivation =
      typeof options.allowDeactivation === "boolean"
        ? options.allowDeactivation
        : !options.packagesOptions?.filter;

    if (allowDeactivation && seenPackageIds.size > 0) {
      const activeStates = await db.packageState.findMany({
        where: { isActive: true },
        select: {
          packageId: true,
          package: { select: { airaloPackageId: true } },
        },
      });

      const missing = activeStates.filter(
        (entry) => !seenPackageIds.has(entry.package.airaloPackageId),
      );

      for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
        const chunkIds = missing.slice(i, i + CHUNK_SIZE).map((entry) => entry.packageId);
        const result = await db.packageState.updateMany({
          where: { packageId: { in: chunkIds }, isActive: true },
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

    if (ownsRun) {
      await db.syncRun.update({
        where: { id: runId },
        data: {
          status: "success",
          finishedAt: new Date(),
          insertedCount: countriesCreated.count + operatorsCreated.count + packagesCreated.count,
          updatedCount: countriesUpdated.count + operatorsUpdated.count + packagesUpdated.count,
          skippedCount: packagesUnchanged.count,
          failureCount: 0,
        },
      });
    }

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
  } catch (error) {
    if (ownsRun) {
      await db.syncRun.update({
        where: { id: runId },
        data: {
          status: "failed",
          finishedAt: new Date(),
          errorSummary: error instanceof Error ? error.message : String(error),
        },
      });
    }
    throw error;
  }
}
