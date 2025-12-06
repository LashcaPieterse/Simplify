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

type SanityImageValue = {
  _type: "image";
  asset: {
    _type: "reference";
    _ref: string;
  };
};

const imageRefCache = new Map<string, SanityImageValue>();

async function fetchExistingImages(): Promise<Map<string, SanityImageValue>> {
  const docs = await sanity.fetch<{ _id: string; image?: SanityImageValue }[]>(
    '*[_type in ["catalogCountry","catalogOperator","catalogPackage"] && defined(image)]{_id, image}',
  );

  return new Map(
    docs
      .filter((doc) => Boolean(doc.image?.asset?._ref))
      .map((doc) => [doc._id, doc.image as SanityImageValue]),
  );
}

async function resolveImageFromUrl(url: string | null | undefined): Promise<SanityImageValue | null> {
  if (!url) return null;

  const cached = imageRefCache.get(url);
  if (cached) return cached;

  const existingAssetId = await sanity.fetch<string | null>(
    '*[_type == "sanity.imageAsset" && source.id == $url][0]._id',
    { url },
  );

  if (existingAssetId) {
    const image = {
      _type: "image",
      asset: { _type: "reference", _ref: existingAssetId },
    } satisfies SanityImageValue;
    imageRefCache.set(url, image);
    return image;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[seed] Skipping image upload for ${url} (status ${response.status})`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const asset = await sanity.assets.upload("image", buffer, {
      filename: url.split("/").pop()?.split("?")[0] || "catalog-image.jpg",
      contentType: response.headers.get("content-type") ?? undefined,
      source: { id: url, name: "Catalog seed", url },
    });

    const image = {
      _type: "image",
      asset: { _type: "reference", _ref: asset._id },
    } satisfies SanityImageValue;

    imageRefCache.set(url, image);
    return image;
  } catch (error) {
    console.warn(`[seed] Failed to upload image from ${url}`, error);
    return null;
  }
}

const PLACEHOLDER_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6wHuAAAAAASUVORK5CYII=";

async function uploadPlaceholderImage(filename = "placeholder.png"): Promise<SanityImageValue | null> {
  try {
    const asset = await sanity.assets.upload(
      "image",
      Buffer.from(PLACEHOLDER_IMAGE_BASE64, "base64"),
      { filename, contentType: "image/png" },
    );
    const image = {
      _type: "image",
      asset: { _type: "reference", _ref: asset._id },
    } satisfies SanityImageValue;
    return image;
  } catch (error) {
    console.warn("[seed] Failed to upload placeholder image", error);
    return null;
  }
}

function fallbackCountryImageUrl(countryCode?: string | null, name?: string | null): string | null {
  const code = (countryCode ?? name ?? "").toLowerCase();
  const map: Record<string, string> = {
    na: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
    za: "https://images.unsplash.com/photo-1526481280695-3c469928b67b?auto=format&fit=crop&w=1600&q=80",
    ke: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1600&q=80",
    bw: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=80",
    zm: "https://images.unsplash.com/photo-1526498460520-4c246339dccb?auto=format&fit=crop&w=1600&q=80",
    tz: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=80",
  };
  return map[code] ?? "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1600&q=80";
}

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
  const existingImages = await fetchExistingImages();

  const now = new Date().toISOString();

  // Select a primary package per country (cheapest by priceCents).
  const primaryPackageRefByCountryId = new Map<string, string>();
  for (const pkg of packages) {
    if (typeof pkg.priceCents !== "number") continue;
    const currentRef = primaryPackageRefByCountryId.get(pkg.countryId);
    const currentPrice =
      currentRef === undefined
        ? Number.POSITIVE_INFINITY
        : pkg.priceCents;
    const candidatePrice = pkg.priceCents;
    if (candidatePrice <= currentPrice) {
      const pkgDocId = `catalog-package-${safeId(pkg.externalId)}`;
      primaryPackageRefByCountryId.set(pkg.countryId, pkgDocId);
    }
  }

  const countryIdMap = new Map<string, string>();
  const countryDocs: Record<string, unknown>[] = [];

  for (const country of countries) {
    const docId = `catalog-country-${country.countryCode.toLowerCase()}`;
    countryIdMap.set(country.id, docId);

    const sourceImageUrl = country.imageUrl ?? fallbackCountryImageUrl(country.countryCode, country.name);
    const image =
      (await resolveImageFromUrl(sourceImageUrl)) ??
      existingImages.get(docId) ??
      (await uploadPlaceholderImage("catalog-country-placeholder.png"));

    countryDocs.push({
      _id: docId,
      _type: "catalogCountry",
      title: country.name,
      slug: { _type: "slug", current: country.slug || slugify(country.name) },
      countryCode: country.countryCode,
      badge: null,
      summary: null,
      featured: false,
      primaryPackage: primaryPackageRefByCountryId.has(country.id)
        ? { _type: "reference", _ref: primaryPackageRefByCountryId.get(country.id)! }
        : null,
      image,
      metadataJson: serializeMetadata(country.metadata),
      lastSyncedAt: now,
    });
  }

  // Extra test document to validate sync behavior.
  const seedSyncTestImage =
    (await resolveImageFromUrl(
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
    )) ??
    (await uploadPlaceholderImage("seed-sync-placeholder.png"));
  countryDocs.push({
    _id: "seedsyncing",
    _type: "catalogCountry",
    title: "Seed Syncing Test",
    slug: { _type: "slug", current: "seed-syncing-test" },
    countryCode: "ZZ",
    badge: null,
    summary: null,
    featured: false,
    primaryPackage: primaryPackageRefByCountryId.size
      ? { _type: "reference", _ref: Array.from(primaryPackageRefByCountryId.values())[0] }
      : null,
    image: seedSyncTestImage,
    metadataJson: null,
    lastSyncedAt: now,
  });

  const operatorIdMap = new Map<string, string>();
  const operatorDocs = operators.map((operator) => {
    const countryRef = countryIdMap.get(operator.countryId);
    const docId = `catalog-operator-${operator.apiOperatorId ?? operator.id}`;
    operatorIdMap.set(operator.id, docId);
    const existingImage = existingImages.get(docId) ?? null;

    return {
      _id: docId,
      _type: "catalogOperator",
      title: operator.name,
      apiOperatorId: operator.apiOperatorId ?? null,
      operatorCode: operator.operatorCode ?? null,
      badge: null,
      summary: null,
      image: existingImage,
      country: countryRef ? { _type: "reference", _ref: countryRef } : null,
      metadataJson: serializeMetadata(operator.metadata),
      lastSyncedAt: now,
    };
  });

  const packageDocs: Record<string, unknown>[] = [];

  for (const pkg of packages) {
    const countryRef = countryIdMap.get(pkg.countryId);
    const operatorRef = operatorIdMap.get(pkg.operatorId);

    if (!countryRef || !operatorRef) {
      console.warn(
        `[seed] Skipping package ${pkg.externalId} because references are missing (countryRef=${countryRef}, operatorRef=${operatorRef})`,
      );
      continue;
    }

    const externalId = safeId(pkg.externalId);
    const docId = `catalog-package-${externalId}`;
    const image =
      (await resolveImageFromUrl(pkg.imageUrl)) ??
      existingImages.get(docId) ??
      null;

    packageDocs.push({
      _id: docId,
      _type: "catalogPackage",
      title: pkg.name,
      externalId: pkg.externalId,
      priceCents: pkg.priceCents,
      sellingPriceCents: pkg.sellingPriceCents ?? null,
      currencyCode: pkg.currencyCode,
      dataAmountMb: pkg.dataAmountMb ?? null,
      validityDays: pkg.validityDays ?? null,
      isUnlimited: pkg.isUnlimited,
      badge: null,
      summary: null,
      country: { _type: "reference", _ref: countryRef },
      operator: { _type: "reference", _ref: operatorRef },
      shortInfo: pkg.shortInfo ?? null,
      qrInstallation: pkg.qrInstallation ?? null,
      manualInstallation: pkg.manualInstallation ?? null,
      isFairUsagePolicy: pkg.isFairUsagePolicy ?? null,
      fairUsagePolicy: pkg.fairUsagePolicy ?? null,
      image,
      metadataJson: serializeMetadata(pkg.metadata),
      isActive: pkg.isActive,
      deactivatedAt: pkg.deactivatedAt?.toISOString() ?? null,
      lastSyncedAt: now,
    });
  }

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
