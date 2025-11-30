/**
* Synchronizes catalog countries, operators, and packages from the database into Sanity.
* Run after `npx tsx scripts/sync-airalo-packages.ts` to mirror the latest Airalo catalog.
*/
import { createClient } from "@sanity/client";
import prisma from "../lib/db/client";

const projectId = process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_READ_TOKEN;
const apiVersion = process.env.SANITY_API_VERSION || "2025-01-01";

if (!projectId || !dataset || !token) {
  console.error("SANITY_PROJECT_ID, SANITY_DATASET, and SANITY_READ_TOKEN are required to sync.");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  token,
  apiVersion,
  useCdn: false
});

const BATCH_SIZE = 50;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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

async function upsertDocuments(documents: Record<string, unknown>[], label: string) {
  for (const batch of chunk(documents, BATCH_SIZE)) {
    const mutations = batch.map((doc) => ({ createOrReplace: doc }));
    await sanity.mutate(mutations, { returnIds: false, visibility: "async" });
  }
  console.info(`[sanity-sync] Upserted ${documents.length} ${label}`);
}

async function main() {
  const [countries, operators, packages] = await Promise.all([
    prisma.country.findMany(),
    prisma.operator.findMany(),
    prisma.package.findMany()
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
      lastSyncedAt: now
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
      country: countryRef
        ? { _type: "reference", _ref: countryRef }
        : null,
      metadataJson: serializeMetadata(operator.metadata),
      lastSyncedAt: now
    };
  });

  const packageDocs = packages
    .map((pkg) => {
      const countryRef = countryIdMap.get(pkg.countryId);
      const operatorRef = operatorIdMap.get(pkg.operatorId);

      if (!countryRef || !operatorRef) {
        console.warn(
          `[sanity-sync] Skipping package ${pkg.externalId} due to missing references (countryRef=${countryRef}, operatorRef=${operatorRef})`
        );
        return null;
      }

      return {
        _id: `catalog-package-${pkg.externalId}`,
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
        lastSyncedAt: now
      };
    })
    .filter(Boolean) as Record<string, unknown>[];

  await upsertDocuments(countryDocs, "catalog countries");
  await upsertDocuments(operatorDocs, "catalog operators");
  await upsertDocuments(packageDocs, "catalog packages");

  console.info(
    `[sanity-sync] Completed. countries=${countryDocs.length} operators=${operatorDocs.length} packages=${packageDocs.length}`
  );
}

main()
  .catch((error) => {
    console.error("[sanity-sync] Failed to sync catalog to Sanity", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
