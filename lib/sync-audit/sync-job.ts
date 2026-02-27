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

async function insertRunItem(data: {
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
  return prisma.syncRunItem.create({
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

export async function runSyncAuditJob(options: RunSyncOptions) {
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

  try {
    const tree = await client.getPackagesTree({ includeTopUp: true, limit: 500 });
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
          await insertRunItem({ runId: run.id, entityType: "country", entityKey: countryKey, action: "insert", afterHash: countryAfterHash, diff: countryDiff });
        } else if (Object.keys(countryDiff).length > 0) {
          await tx.country.update({ where: { id: countryBefore.id }, data: { name: countryNormalized.name, slug: countryNormalized.slug } });
          updated += 1;
          await insertRunItem({ runId: run.id, entityType: "country", entityKey: countryKey, action: "update", beforeHash: countryBeforeHash, afterHash: countryAfterHash, diff: countryDiff });
        } else {
          skipped += 1;
          await insertRunItem({ runId: run.id, entityType: "country", entityKey: countryKey, action: "skip", beforeHash: countryBeforeHash, afterHash: countryAfterHash });
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
            await insertRunItem({ runId: run.id, entityType: "operator", entityKey: operatorKey, action: "insert", afterHash: operatorAfterHash, diff: operatorDiff });
            return created;
          }
          if (Object.keys(operatorDiff).length === 0) {
            skipped += 1;
            await insertRunItem({ runId: run.id, entityType: "operator", entityKey: operatorKey, action: "skip", beforeHash: operatorBeforeHash, afterHash: operatorAfterHash });
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
          await insertRunItem({ runId: run.id, entityType: "operator", entityKey: operatorKey, action: "update", beforeHash: operatorBeforeHash, afterHash: operatorAfterHash, diff: operatorDiff });
          return updatedOperator;
        });

        for (const packageNode of operatorNode.packages ?? []) {
          const normalized = normalizePackage(packageNode, operatorNode, countryNode);
          const packageKey = normalized.airaloId;
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
                  rawPayloadJson: normalized.raw as object,
                  normalizedJson: normalizedRecord as object,
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
                await insertRunItem({ runId: run.id, entityType: "package", entityKey: packageKey, action: "insert", afterHash, diff });
              } else if (beforeHash === afterHash) {
                skipped += 1;
                await insertRunItem({ runId: run.id, entityType: "package", entityKey: packageKey, action: "skip", beforeHash, afterHash });
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
                await insertRunItem({ runId: run.id, entityType: "package", entityKey: packageKey, action: "update", beforeHash, afterHash, diff });
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
            await insertRunItem({ runId: run.id, entityType: "package", entityKey: packageKey, action: "error", errorText: message });
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

    logOrderInfo("sync.run.completed", { runId: run.id, inserted, updated, skipped, failures, warnings });
    return { runId: run.id, inserted, updated, skipped, failures, warnings };
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
