import { randomUUID } from "crypto";
import prisma from "@/lib/db/client";
import { Prisma } from "@prisma/client";
import { AiraloClient, type AiraloCountryNode, type AiraloOperatorNode, type AiraloPackageNode } from "@/lib/airalo/client";
import { logOrderError, logOrderInfo, logOrderWarn } from "@/lib/observability/logging";
import { applyMarkupRule, computeFieldDiff, getAuditSeverity, hashNormalizedRecord } from "./utils";

export interface SyncThresholds {
  deltaPct: number;
  deltaAbs: number;
}

export interface RunSyncOptions {
  triggeredBy: string;
  continueOnError?: boolean;
  notes?: string;
  thresholds?: SyncThresholds;
}

export interface LegacyAiraloSyncResult {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  deactivated: number;
}

export interface RunSyncAuditResult {
  runId: string;
  inserted: number;
  updated: number;
  skipped: number;
  failures: number;
  warnings: number;
  packages: LegacyAiraloSyncResult;
}

const PACKAGES_PAGE_LIMIT = 100;
const PACKAGES_INCLUDE_TOP_UP = true;
const PACKAGES_INCLUDE_FLAGS = ["topup"] as const;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function normalizePackage(pkg: AiraloPackageNode, operator: AiraloOperatorNode, country: AiraloCountryNode) {
  const airaloId = String(pkg.id ?? pkg.slug ?? `${country.country_code}-${operator.id}-${pkg.title}`);
  const currency = String(pkg.currency ?? "USD").toUpperCase();
  const sourcePrice = Number(pkg.price ?? pkg.amount ?? 0);
  return {
    airaloId,
    name: String(pkg.title ?? pkg.name ?? airaloId),
    countryCode: String(country.country_code ?? "UN"),
    countryName: String(country.title ?? country.country_code ?? "Unknown"),
    operatorCode: String(operator.operator_code ?? operator.id ?? "unknown"),
    operatorName: String(operator.title ?? operator.name ?? "Unknown"),
    sourcePrice,
    currency,
    validityDays: typeof pkg.day === "number" ? pkg.day : null,
    dataAmountMb: typeof pkg.amount === "number" ? pkg.amount : null,
    raw: pkg,
  };
}

function sanitizeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function countryMergeKey(country: AiraloCountryNode): string {
  return String(country.country_code ?? country.slug ?? country.title ?? "unknown").toLowerCase();
}

function operatorMergeKey(operator: AiraloOperatorNode): string {
  return String(operator.id ?? operator.operator_code ?? operator.title ?? operator.name ?? "unknown").toLowerCase();
}

function packageMergeKey(pkg: AiraloPackageNode): string {
  return String(pkg.id ?? pkg.slug ?? pkg.title ?? pkg.name ?? "unknown").toLowerCase();
}

export function mergeAiraloCountryTrees(pages: AiraloCountryNode[][]): AiraloCountryNode[] {
  const mergedCountries = new Map<string, AiraloCountryNode>();

  for (const countries of pages) {
    for (const country of countries ?? []) {
      const key = countryMergeKey(country);
      const existingCountry = mergedCountries.get(key);

      if (!existingCountry) {
        mergedCountries.set(key, {
          ...country,
          operators: (country.operators ?? []).map((operator) => ({
            ...operator,
            packages: [...(operator.packages ?? [])],
          })),
        });
        continue;
      }

      existingCountry.country_code ??= country.country_code;
      existingCountry.slug ??= country.slug;
      existingCountry.title ??= country.title;
      existingCountry.region ??= country.region;
      existingCountry.image ??= country.image;
      existingCountry.operators ??= [];

      for (const operator of country.operators ?? []) {
        const opKey = operatorMergeKey(operator);
        const existingOperator = existingCountry.operators.find((node) => operatorMergeKey(node) === opKey);

        if (!existingOperator) {
          existingCountry.operators.push({
            ...operator,
            packages: [...(operator.packages ?? [])],
          });
          continue;
        }

        existingOperator.id ??= operator.id;
        existingOperator.operator_code ??= operator.operator_code;
        existingOperator.title ??= operator.title;
        existingOperator.name ??= operator.name;
        existingOperator.packages ??= [];

        const seenPackageKeys = new Set(existingOperator.packages.map((pkg) => packageMergeKey(pkg)));
        for (const pkg of operator.packages ?? []) {
          const pkgKey = packageMergeKey(pkg);
          if (seenPackageKeys.has(pkgKey)) {
            continue;
          }
          existingOperator.packages.push({ ...pkg });
          seenPackageKeys.add(pkgKey);
        }
      }
    }
  }

  return Array.from(mergedCountries.values());
}

function buildAiraloResponseMetadata(page: number, limit: number, countryCount: number) {
  return {
    endpoint: "/packages",
    page,
    limit,
    includeTopUp: PACKAGES_INCLUDE_TOP_UP,
    include: [...PACKAGES_INCLUDE_FLAGS],
    countryCount,
    capturedAt: new Date().toISOString(),
  };
}

export function mapAuditResultToLegacySyncResult(result: Pick<RunSyncAuditResult, "packages">): LegacyAiraloSyncResult {
  return result.packages;
}

async function insertRunItem(db: Prisma.TransactionClient | typeof prisma, data: {
  runId: string;
  entityType: "country" | "operator" | "package";
  entityKey: string;
  action: "insert" | "update" | "skip" | "error";
  beforeHash?: string | null;
  afterHash?: string | null;
  diff?: Record<string, unknown>;
  warnings?: string[];
  errorText?: string;
}) {
  return db.syncRunItem.create({
    data: {
      id: randomUUID(),
      runId: data.runId,
      entityType: data.entityType,
      entityKey: data.entityKey,
      action: data.action,
      beforeHash: data.beforeHash ?? null,
      afterHash: data.afterHash ?? null,
      diffJson: (data.diff ?? Prisma.JsonNull) as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
      warningFlags: data.warnings ?? [],
      errorText: data.errorText ?? null,
    },
  });
}

export async function runSyncAuditJob(options: RunSyncOptions): Promise<RunSyncAuditResult> {
  const startedAt = new Date();
  const run = await prisma.syncRun.create({
    data: {
      id: randomUUID(),
      status: "running",
      source: "airalo",
      triggeredBy: options.triggeredBy,
      version: process.env.npm_package_version ?? "unknown",
      notes: options.notes,
      startedAt,
    },
  });

  const client = new AiraloClient({
    clientId: requiredEnv("AIRALO_CLIENT_ID"),
    clientSecret: requiredEnv("AIRALO_CLIENT_SECRET"),
    baseUrl: process.env.AIRALO_BASE_URL,
  });

  const thresholds = options.thresholds ?? { deltaAbs: 0.5, deltaPct: 1 };
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const warnings = 0;
  let failures = 0;
  const errors: string[] = [];
  let packageCreated = 0;
  let packageUpdated = 0;
  let packageUnchanged = 0;

  try {
    const countryPages: AiraloCountryNode[][] = [];
    for (let page = 1; ; page += 1) {
      const pageResult = await client.getPackagesTreePageRaw({
        includeTopUp: PACKAGES_INCLUDE_TOP_UP,
        limit: PACKAGES_PAGE_LIMIT,
        page,
      });

      await prisma.entitySnapshot.create({
        data: {
          id: randomUUID(),
          runId: run.id,
          entityType: "airalo_response",
          entityKey: `packages:page:${page}`,
          rawPayloadJson: sanitizeJson(pageResult.rawResponse),
          normalizedJson: sanitizeJson(
            buildAiraloResponseMetadata(page, PACKAGES_PAGE_LIMIT, pageResult.countries.length),
          ),
        },
      });

      countryPages.push(pageResult.countries);
      if (pageResult.countries.length < PACKAGES_PAGE_LIMIT) {
        break;
      }
    }

    const tree = mergeAiraloCountryTrees(countryPages);
    const processedPackageKeys = new Set<string>();

    for (const countryNode of tree) {
      const countryKey = String(countryNode.country_code ?? countryNode.slug ?? "unknown");
      const countryNormalized = {
        countryCode: countryKey,
        name: String(countryNode.title ?? countryKey),
        slug: String(countryNode.slug ?? countryKey).toLowerCase(),
      };

      const countryBefore = await prisma.country.findUnique({ where: { countryCode: countryNormalized.countryCode } });
      const countryAfterHash = hashNormalizedRecord(countryNormalized);
      const countryBeforeHash = countryBefore ? hashNormalizedRecord(countryBefore) : null;
      const countryDiff = computeFieldDiff(countryBefore as Record<string, unknown> | null, countryNormalized as Record<string, unknown>);

      await prisma.$transaction(async (tx) => {
        if (!countryBefore) {
          await tx.country.create({ data: countryNormalized });
          inserted += 1;
          await insertRunItem(tx, { runId: run.id, entityType: "country", entityKey: countryKey, action: "insert", afterHash: countryAfterHash, diff: countryDiff });
        } else if (Object.keys(countryDiff).length > 0) {
          await tx.country.update({ where: { id: countryBefore.id }, data: { name: countryNormalized.name, slug: countryNormalized.slug } });
          updated += 1;
          await insertRunItem(tx, { runId: run.id, entityType: "country", entityKey: countryKey, action: "update", beforeHash: countryBeforeHash, afterHash: countryAfterHash, diff: countryDiff });
        } else {
          skipped += 1;
          await insertRunItem(tx, { runId: run.id, entityType: "country", entityKey: countryKey, action: "skip", beforeHash: countryBeforeHash, afterHash: countryAfterHash });
        }
      });

      const dbCountry = await prisma.country.findUniqueOrThrow({ where: { countryCode: countryNormalized.countryCode } });
      for (const operatorNode of countryNode.operators ?? []) {
        const operatorKey = `${countryKey}:${String(operatorNode.operator_code ?? operatorNode.id ?? "unknown")}`;
        const operatorNormalized = {
          countryId: dbCountry.id,
          name: String(operatorNode.title ?? operatorNode.name ?? "Unknown"),
          operatorCode: String(operatorNode.operator_code ?? operatorNode.id ?? "unknown"),
          apiOperatorId: operatorNode.id ? Number(operatorNode.id) : null,
          networkTypes: [] as string[],
        };

        const operatorBefore = await prisma.operator.findFirst({ where: { countryId: dbCountry.id, operatorCode: operatorNormalized.operatorCode } });
        const operatorBeforeHash = operatorBefore ? hashNormalizedRecord(operatorBefore) : null;
        const operatorAfterHash = hashNormalizedRecord(operatorNormalized);
        const operatorDiff = computeFieldDiff(operatorBefore as Record<string, unknown> | null, operatorNormalized as Record<string, unknown>);

        const dbOperator = await prisma.$transaction(async (tx) => {
          if (!operatorBefore) {
            const created = await tx.operator.create({ data: operatorNormalized });
            inserted += 1;
            await insertRunItem(tx, { runId: run.id, entityType: "operator", entityKey: operatorKey, action: "insert", afterHash: operatorAfterHash, diff: operatorDiff });
            return created;
          }
          if (Object.keys(operatorDiff).length === 0) {
            skipped += 1;
            await insertRunItem(tx, { runId: run.id, entityType: "operator", entityKey: operatorKey, action: "skip", beforeHash: operatorBeforeHash, afterHash: operatorAfterHash });
            return operatorBefore;
          }
          const updatedOperator = await tx.operator.update({
            where: { id: operatorBefore.id },
            data: {
              name: operatorNormalized.name,
              apiOperatorId: operatorNormalized.apiOperatorId,
              operatorCode: operatorNormalized.operatorCode,
            },
          });
          updated += 1;
          await insertRunItem(tx, { runId: run.id, entityType: "operator", entityKey: operatorKey, action: "update", beforeHash: operatorBeforeHash, afterHash: operatorAfterHash, diff: operatorDiff });
          return updatedOperator;
        });

        for (const packageNode of operatorNode.packages ?? []) {
          const normalized = normalizePackage(packageNode, operatorNode, countryNode);
          const packageKey = normalized.airaloId;
          if (processedPackageKeys.has(packageKey)) {
            continue;
          }
          processedPackageKeys.add(packageKey);

          const markup = { percent: Number(process.env.DEFAULT_PRICE_MARKUP_PERCENT ?? 20), fixed: Number(process.env.DEFAULT_PRICE_MARKUP_FIXED ?? 0) };
          const computedSell = applyMarkupRule(normalized.sourcePrice, markup);
          const normalizedRecord = {
            externalId: normalized.airaloId,
            name: normalized.name,
            currencyCode: normalized.currency,
            price: normalized.sourcePrice,
            sellPrice: computedSell,
            dataAmountMb: normalized.dataAmountMb,
            validityDays: normalized.validityDays,
          };

          const afterHash = hashNormalizedRecord(normalizedRecord);
          const pkgBefore = await prisma.package.findUnique({ where: { externalId: normalized.airaloId } });
          const beforeHash = pkgBefore?.sourceHash ?? null;
          const diff = computeFieldDiff(pkgBefore as Record<string, unknown> | null, normalizedRecord as Record<string, unknown>);

          try {
            await prisma.$transaction(async (tx) => {
              await tx.entitySnapshot.create({
                data: {
                  id: randomUUID(),
                  runId: run.id,
                  entityType: "package",
                  entityKey: packageKey,
                  rawPayloadJson: sanitizeJson(normalized.raw),
                  normalizedJson: sanitizeJson(normalizedRecord),
                },
              });

              if (!pkgBefore) {
                await tx.package.create({
                  data: {
                    externalId: normalized.airaloId,
                    countryId: dbCountry.id,
                    operatorId: dbOperator.id,
                    name: normalized.name,
                    priceCents: Math.round(normalized.sourcePrice * 100),
                    sellingPriceCents: Math.round(computedSell * 100),
                    sourcePriceDecimal: normalized.sourcePrice,
                    sellPriceDecimal: computedSell,
                    currencyCode: normalized.currency,
                    sourceHash: afterHash,
                    lastSyncedAt: new Date(),
                    networkTypes: [],
                  },
                });
                inserted += 1;
                packageCreated += 1;
                await insertRunItem(tx, { runId: run.id, entityType: "package", entityKey: packageKey, action: "insert", afterHash, diff });
              } else if (beforeHash === afterHash) {
                skipped += 1;
                packageUnchanged += 1;
                await insertRunItem(tx, { runId: run.id, entityType: "package", entityKey: packageKey, action: "skip", beforeHash, afterHash });
              } else {
                await tx.package.update({
                  where: { id: pkgBefore.id },
                  data: {
                    countryId: dbCountry.id,
                    operatorId: dbOperator.id,
                    name: normalized.name,
                    priceCents: Math.round(normalized.sourcePrice * 100),
                    sourcePriceDecimal: normalized.sourcePrice,
                    sellPriceDecimal: pkgBefore.sellPriceDecimal ?? computedSell,
                    currencyCode: normalized.currency,
                    sourceHash: afterHash,
                    lastSyncedAt: new Date(),
                  },
                });
                updated += 1;
                packageUpdated += 1;
                await insertRunItem(tx, { runId: run.id, entityType: "package", entityKey: packageKey, action: "update", beforeHash, afterHash, diff });
              }
            });

            const publishing = await prisma.publishingState.findUnique({ where: { packageAiraloId: normalized.airaloId } });
            const dbPrice = pkgBefore?.sellPriceDecimal ? Number(pkgBefore.sellPriceDecimal) : computedSell;
            const publishedPrice = publishing?.publishedPrice ? Number(publishing.publishedPrice) : null;
            const deltaAbs = publishedPrice === null ? 0 : Math.abs(dbPrice - publishedPrice);
            const baseline = publishedPrice || dbPrice || 1;
            const deltaPct = (deltaAbs / baseline) * 100;

            if (deltaAbs > thresholds.deltaAbs || deltaPct > thresholds.deltaPct) {
              await prisma.pricingAudit.create({
                data: {
                  id: randomUUID(),
                  packageAiraloId: normalized.airaloId,
                  runId: run.id,
                  sourcePrice: normalized.sourcePrice,
                  dbPrice,
                  publishedPrice,
                  currency: normalized.currency,
                  deltaAbs,
                  deltaPct,
                  severity: getAuditSeverity(deltaPct, deltaAbs),
                  status: "open",
                },
              });
            }
          } catch (error) {
            failures += 1;
            const message = error instanceof Error ? error.message : "Unknown package sync failure";
            errors.push(`${packageKey}: ${message}`);
            logOrderError("sync.package.failed", { runId: run.id, packageKey, error: message });
            await insertRunItem(prisma, { runId: run.id, entityType: "package", entityKey: packageKey, action: "error", errorText: message });
            if (!options.continueOnError) {
              throw error;
            }
          }
        }
      }
    }

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: failures > 0 ? "failed" : "success",
        finishedAt: new Date(),
        insertedCount: inserted,
        updatedCount: updated,
        skippedCount: skipped,
        warningCount: warnings,
        failureCount: failures,
        errorSummary: errors.slice(0, 50).join("\n"),
      },
    });

    const packages: LegacyAiraloSyncResult = {
      total: packageCreated + packageUpdated + packageUnchanged,
      created: packageCreated,
      updated: packageUpdated,
      unchanged: packageUnchanged,
      deactivated: 0,
    };

    logOrderInfo("sync.run.completed", { runId: run.id, inserted, updated, skipped, failures, warnings, packages });
    return { runId: run.id, inserted, updated, skipped, failures, warnings, packages };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync failure";
    logOrderWarn("sync.run.failed", { runId: run.id, error: message });
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        insertedCount: inserted,
        updatedCount: updated,
        skippedCount: skipped,
        warningCount: warnings,
        failureCount: failures + 1,
        errorSummary: [message, ...errors].join("\n"),
      },
    });
    throw error;
  }
}
