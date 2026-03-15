import { randomUUID } from "crypto";
import prisma from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import {
  AiraloClient,
  type AiraloCountryNode,
  type AiraloOperatorNode,
  type AiraloPackageNode,
} from "@/lib/airalo/client";
import { syncAiraloCatalog } from "@/lib/catalog/sync";
import { logOrderInfo, logOrderWarn } from "@/lib/observability/logging";
import { getAuditSeverity } from "./utils";

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

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
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

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

export function mapAuditResultToLegacySyncResult(result: Pick<RunSyncAuditResult, "packages">): LegacyAiraloSyncResult {
  return result.packages;
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

  try {
    const client = new AiraloClient({
      clientId: requiredEnv("AIRALO_CLIENT_ID"),
      clientSecret: requiredEnv("AIRALO_CLIENT_SECRET"),
      baseUrl: process.env.AIRALO_BASE_URL,
    });

    const syncResult = await syncAiraloCatalog({
      prisma,
      client,
      syncRunId: run.id,
      now: startedAt,
      packagesOptions: {
        includeTopUp: PACKAGES_INCLUDE_TOP_UP,
        limit: PACKAGES_PAGE_LIMIT,
      },
    });

    const thresholds = options.thresholds ?? { deltaAbs: 0.5, deltaPct: 1 };
    const syncedPackages = await prisma.package.findMany({
      where: {
        state: {
          is: {
            lastSyncedAt: {
              gte: startedAt,
            },
          },
        },
      },
      select: {
        airaloPackageId: true,
        price: true,
        state: {
          select: {
            sellPriceDecimal: true,
            sellingPriceCents: true,
            sourcePriceDecimal: true,
            currencyCode: true,
          },
        },
      },
    });

    const publishingStates = await prisma.publishingState.findMany({
      where: {
        packageAiraloId: {
          in: syncedPackages.map((pkg) => pkg.airaloPackageId),
        },
      },
      select: {
        packageAiraloId: true,
        publishedPrice: true,
      },
    });
    const publishingMap = new Map(
      publishingStates.map((item) => [item.packageAiraloId, item]),
    );

    for (const pkg of syncedPackages) {
      const sourcePrice =
        decimalToNumber(pkg.state?.sourcePriceDecimal) ??
        decimalToNumber(pkg.price) ??
        0;
      const dbPrice =
        decimalToNumber(pkg.state?.sellPriceDecimal) ??
        (typeof pkg.state?.sellingPriceCents === "number"
          ? pkg.state.sellingPriceCents / 100
          : sourcePrice);

      const publishedRaw = publishingMap.get(pkg.airaloPackageId)?.publishedPrice;
      const publishedPrice = decimalToNumber(publishedRaw);
      const deltaAbs = publishedPrice === null ? 0 : Math.abs(dbPrice - publishedPrice);
      const baseline = publishedPrice || dbPrice || 1;
      const deltaPct = (deltaAbs / baseline) * 100;

      if (deltaAbs > thresholds.deltaAbs || deltaPct > thresholds.deltaPct) {
        await prisma.pricingAudit.create({
          data: {
            id: randomUUID(),
            packageAiraloId: pkg.airaloPackageId,
            runId: run.id,
            sourcePrice,
            dbPrice,
            publishedPrice,
            currency: pkg.state?.currencyCode ?? "USD",
            deltaAbs,
            deltaPct,
            severity: getAuditSeverity(deltaPct, deltaAbs),
            status: "open",
          },
        });
      }
    }

    const inserted = syncResult.countriesCreated + syncResult.operatorsCreated + syncResult.packagesCreated;
    const updated = syncResult.countriesUpdated + syncResult.operatorsUpdated + syncResult.packagesUpdated;
    const skipped = syncResult.packagesUnchanged;
    const failures = 0;
    const warnings = 0;

    const packages: LegacyAiraloSyncResult = {
      total: syncResult.packagesCreated + syncResult.packagesUpdated + syncResult.packagesUnchanged,
      created: syncResult.packagesCreated,
      updated: syncResult.packagesUpdated,
      unchanged: syncResult.packagesUnchanged,
      deactivated: syncResult.packagesDeactivated,
    };

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        insertedCount: inserted,
        updatedCount: updated,
        skippedCount: skipped,
        warningCount: warnings,
        failureCount: failures,
        errorSummary: null,
      },
    });

    logOrderInfo("sync.run.completed", {
      runId: run.id,
      inserted,
      updated,
      skipped,
      failures,
      warnings,
      packages,
    });

    return { runId: run.id, inserted, updated, skipped, failures, warnings, packages };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync failure";
    logOrderWarn("sync.run.failed", { runId: run.id, error: message });

    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        failureCount: { increment: 1 },
        errorSummary: message,
      },
    });
    throw error;
  }
}
