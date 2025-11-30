/**
 * Seeds Sanity using the current catalog data stored in the database.
 *
 * This script mirrors countries, operators, and packages from Postgres into Sanity
 * so Studio users can browse and QA the same data that powers the app.
 *
 * Run after refreshing the catalog (e.g. `npx tsx scripts/sync-airalo-packages.ts`):
 *
 *   npx tsx scripts/seed.ts
 */
import { createClient } from "@sanity/client";
import prisma from "../lib/db/client";

const projectId = process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_READ_TOKEN;
const apiVersion = process.env.SANITY_API_VERSION || "2025-01-01";

if (!projectId || !dataset || !token) {
  console.error("Missing SANITY_PROJECT_ID, SANITY_DATASET, or SANITY_READ_TOKEN");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  token,
  apiVersion,
  useCdn: false,
});

const BATCH_SIZE = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function serializeMetadata(value: unknown): string | null {
  if (!value) return null;
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn("Failed to serialize metadata", error);
    return null;
  }
}

function safeId(value: string): string {
  const cleaned = value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return cleaned || "pkg";
}

async function upsertDocuments(documents: Record<string, unknown>[], label: string) {
  for (const batch of chunk(documents, BATCH_SIZE)) {
    const mutations = batch.map((doc) => ({ createOrReplace: doc }));
    await sanity.mutate(mutations, { returnIds: false, visibility: "async" });
  }
  console.info(`[seed] Upserted ${documents.length} ${label}`);
}

async function main() {
  const [countries, operators, packages] = await Promise.all([
    prisma.country.findMany(),
    prisma.operator.findMany(),
    prisma.package.findMany(),
  ]);

  const now = new Date().toISOString();

  const countryIdMap = new Map<string, string>();
  const countryDocs = countries.map((country) => {
    const docId = `catalog-country-${country.countryCode.toLowerCase()}`;
    countryIdMap.set(country.id, docId);
    return {
      _id: docId,
      _type: "catalogCountry",
      title: country.name,
      slug: { _type: "slug", current: country.slug || slugify(country.name) },
      countryCode: country.countryCode,
      imageUrl: country.imageUrl ?? null,
      metadataJson: serializeMetadata(country.metadata),
      lastSyncedAt: now,
    };
  });

  const operatorIdMap = new Map<string, string>();
  const operatorDocs = operators.map((operator) => {
    const countryRef = countryIdMap.get(operator.countryId);
    const docId = `catalog-operator-${operator.apiOperatorId ?? operator.id}`;
    operatorIdMap.set(operator.id, docId);

    return {
      _id: docId,
      _type: "catalogOperator",
      title: operator.name,
      apiOperatorId: operator.apiOperatorId ?? null,
      operatorCode: operator.operatorCode ?? null,
      country: countryRef ? { _type: "reference", _ref: countryRef } : null,
      metadataJson: serializeMetadata(operator.metadata),
      lastSyncedAt: now,
    };
  });

  const packageDocs = packages
    .map((pkg) => {
      const countryRef = countryIdMap.get(pkg.countryId);
      const operatorRef = operatorIdMap.get(pkg.operatorId);

      if (!countryRef || !operatorRef) {
        console.warn(
          `[seed] Skipping package ${pkg.externalId} because references are missing (countryRef=${countryRef}, operatorRef=${operatorRef})`,
        );
        return null;
      }

      const externalId = safeId(pkg.externalId);

      return {
        _id: `catalog-package-${externalId}`,
        _type: "catalogPackage",
        title: pkg.name,
        externalId: pkg.externalId,
        priceCents: pkg.priceCents,
        sellingPriceCents: pkg.sellingPriceCents ?? null,
        currencyCode: pkg.currencyCode,
        dataAmountMb: pkg.dataAmountMb ?? null,
        validityDays: pkg.validityDays ?? null,
        isUnlimited: pkg.isUnlimited,
        country: { _type: "reference", _ref: countryRef },
        operator: { _type: "reference", _ref: operatorRef },
        shortInfo: pkg.shortInfo ?? null,
        qrInstallation: pkg.qrInstallation ?? null,
        manualInstallation: pkg.manualInstallation ?? null,
        isFairUsagePolicy: pkg.isFairUsagePolicy ?? null,
        fairUsagePolicy: pkg.fairUsagePolicy ?? null,
        imageUrl: pkg.imageUrl ?? null,
        metadataJson: serializeMetadata(pkg.metadata),
        isActive: pkg.isActive,
        deactivatedAt: pkg.deactivatedAt?.toISOString() ?? null,
        lastSyncedAt: now,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];

  await upsertDocuments(countryDocs, "catalog countries");
  await upsertDocuments(operatorDocs, "catalog operators");
  await upsertDocuments(packageDocs, "catalog packages");

  console.info(
    `[seed] Completed. countries=${countryDocs.length} operators=${operatorDocs.length} packages=${packageDocs.length}`,
  );
}

main()
  .catch((error) => {
    console.error("[seed] Failed to populate Sanity from DB", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
