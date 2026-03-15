/**
* Synchronizes catalog countries, operators, and packages from the database into Sanity.
* Run after `npx tsx scripts/sync-airalo-packages.ts` to mirror the latest Airalo catalog.
*/
import { createClient, type Mutation } from "@sanity/client";
import prisma from "../db/client";

const BATCH_SIZE = 50;

type SanityImageValue = {
  _type: "image";
  asset: {
    _type: "reference";
    _ref: string;
  };
};

type SyncDocument = {
  _id: string;
  _type: string;
  [key: string]: unknown;
};

const imageRefCache = new Map<string, SanityImageValue>();
let sanity: ReturnType<typeof createClient> | null = null;

function getSanityClient() {
  if (!sanity) {
    throw new Error("Sanity client was not initialized.");
  }
  return sanity;
}

async function fetchExistingImages(): Promise<Map<string, SanityImageValue>> {
  const docs = await getSanityClient().fetch<{ _id: string; image?: SanityImageValue }[]>(
    '*[_type in ["catalogCountry","catalogOperator","catalogPackage"] && defined(image)]{_id, image}'
  );

  return new Map(
    docs
      .filter((doc) => Boolean(doc.image?.asset?._ref))
      .map((doc) => [doc._id, doc.image as SanityImageValue])
  );
}

async function resolveImageFromUrl(url: string | null | undefined): Promise<SanityImageValue | null> {
  if (!url) return null;

  const cached = imageRefCache.get(url);
  if (cached) return cached;

  const existingAssetId = await getSanityClient().fetch<string | null>(
    '*[_type == "sanity.imageAsset" && source.id == $url][0]._id',
    { url }
  );

  if (existingAssetId) {
    const image = {
      _type: "image",
      asset: { _type: "reference", _ref: existingAssetId }
    } satisfies SanityImageValue;
    imageRefCache.set(url, image);
    return image;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[sanity-sync] Skipping image upload for ${url} (status ${response.status})`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const asset = await getSanityClient().assets.upload("image", buffer, {
      filename: url.split("/").pop()?.split("?")[0] || "catalog-image.jpg",
      contentType: response.headers.get("content-type") ?? undefined,
      source: { id: url, name: "Catalog sync", url }
    });

    const image = {
      _type: "image",
      asset: { _type: "reference", _ref: asset._id }
    } satisfies SanityImageValue;

    imageRefCache.set(url, image);
    return image;
  } catch (error) {
    console.warn(`[sanity-sync] Failed to upload image from ${url}`, error);
    return null;
  }
}

const PLACEHOLDER_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6wHuAAAAAASUVORK5CYII=";

async function uploadPlaceholderImage(filename = "placeholder.png"): Promise<SanityImageValue | null> {
  try {
    const asset = await getSanityClient().assets.upload(
      "image",
      Buffer.from(PLACEHOLDER_IMAGE_BASE64, "base64"),
      { filename, contentType: "image/png" }
    );
    const image = {
      _type: "image",
      asset: { _type: "reference", _ref: asset._id }
    } satisfies SanityImageValue;
    return image;
  } catch (error) {
    console.warn("[sanity-sync] Failed to upload placeholder image", error);
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
    tz: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1600&q=80"
  };
  return map[code] ?? "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1600&q=80";
}

function fallbackOperatorImageUrl(code?: string | null, name?: string | null): string | null {
  const key = (code ?? name ?? "").toLowerCase();
  if (key.includes("vod") || key.includes("vodacom") || key.includes("vodafone")) {
    return "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80";
  }
  if (key.includes("airtel")) {
    return "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80";
  }
  return "https://images.unsplash.com/photo-1483478550801-ceba5fe50e8e?auto=format&fit=crop&w=1600&q=80";
}

function fallbackPackageImageUrl(): string | null {
  return "https://images.unsplash.com/photo-1483478550801-ceba5fe50e8e?auto=format&fit=crop&w=1600&q=80";
}

function extractImageUrl(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const candidate = (value as { url?: unknown }).url;
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}

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

function sanitizeDocumentId(value: string): string {
  const cleaned = value
    // Sanity IDs only allow letters, numbers, underscore, dash, and dot.
    .replace(/[^A-Za-z0-9_.-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  if (cleaned) return cleaned.toLowerCase();

  // Fallback for edge cases that were entirely stripped.
  return Buffer.from(value).toString("base64url").slice(0, 24);
}

async function upsertDocuments(
  documents: SyncDocument[],
  label: string,
  visibility: "sync" | "async" = "async",
) {
  for (const batch of chunk(documents, BATCH_SIZE)) {
    const mutations: Mutation<Record<string, unknown>>[] = batch.map((doc) => ({
      createOrReplace: doc,
    }));
    await getSanityClient().mutate(mutations, { visibility });
  }
  console.info(`[sanity-sync] Upserted ${documents.length} ${label}`);
}

async function fetchExistingIds(type: string): Promise<Set<string>> {
  const ids = await getSanityClient().fetch<string[]>(`*[_type == $type]._id`, { type });
  return new Set(ids ?? []);
}

function isReferenceDeleteError(error: unknown): {
  isReferenceError: boolean;
  referencingIds?: string[];
} {
  if (!error || typeof error !== "object") return { isReferenceError: false };
  const details = (error as { details?: { items?: Array<{ error?: { type?: string; referencingIDs?: string[] } }> } }).details;
  const items = details?.items ?? [];
  for (const item of items) {
    const type = item?.error?.type;
    if (type === "documentHasExistingReferencesError") {
      return { isReferenceError: true, referencingIds: item.error?.referencingIDs };
    }
  }
  return { isReferenceError: false };
}

async function deleteDocuments(
  docIds: string[],
  label: string,
  visibility: "sync" | "async" = "async",
) {
  if (!docIds.length) return;
  let deleted = 0;
  let skipped = 0;
  for (const id of docIds) {
    try {
      await getSanityClient().delete(id, { visibility });
      deleted += 1;
    } catch (error) {
      const { isReferenceError, referencingIds } = isReferenceDeleteError(error);
      if (isReferenceError) {
        skipped += 1;
        console.warn(
          `[sanity-sync] Skipping delete for ${id} (${label}); still referenced by ${referencingIds?.join(", ") ?? "unknown docs"}`,
        );
        continue;
      }
      throw error;
    }
  }
  console.info(`[sanity-sync] Deleted ${deleted} stale ${label} (${skipped} skipped due to references)`);
}

export type SanityCatalogSyncResult = {
  countries: number;
  operators: number;
  packages: number;
};

export async function syncCatalogToSanity(): Promise<SanityCatalogSyncResult> {
  const projectId = process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
  const token = process.env.SANITY_READ_TOKEN;
  const apiVersion = process.env.SANITY_API_VERSION || "2025-01-01";

  if (!projectId || !dataset || !token) {
    throw new Error("SANITY_PROJECT_ID, SANITY_DATASET, and SANITY_READ_TOKEN are required to sync.");
  }

  sanity = createClient({
    projectId,
    dataset,
    token,
    apiVersion,
    useCdn: false,
  });

  imageRefCache.clear();

  const [countries, operators, packages] = await Promise.all([
    prisma.country.findMany(),
    prisma.operator.findMany(),
    prisma.package.findMany({
      include: {
        operator: { select: { countryId: true } },
        state: true,
      },
    }),
  ]);
  const existingImages = await fetchExistingImages();

  const now = new Date().toISOString();

  const countryIdMap = new Map<string, string>();
  const countryById = new Map<string, (typeof countries)[number]>();
  const countryDocs: SyncDocument[] = [];

  for (const country of countries) {
    const docId = `catalog-country-${country.countryCode.toLowerCase()}`;
    countryIdMap.set(country.id, docId);
    countryById.set(country.id, country);

    const sourceImageUrl =
      extractImageUrl(country.imageJson) ??
      fallbackCountryImageUrl(country.countryCode, country.title);
    const image =
      (await resolveImageFromUrl(sourceImageUrl)) ??
      existingImages.get(docId) ??
      (await uploadPlaceholderImage("catalog-country-placeholder.png"));

    countryDocs.push({
      _id: docId,
      _type: "catalogCountry",
      title: country.title,
      slug: { _type: "slug", current: country.slug || slugify(country.title) },
      countryCode: country.countryCode,
      badge: null,
      summary: null,
      featured: false,
      // Set primaryPackage after packages exist to avoid reference errors.
      primaryPackage: null,
      image,
      metadataJson: null,
      lastSyncedAt: now
    });
  }

  const operatorIdMap = new Map<string, string>();
  const operatorDocs: SyncDocument[] = [];
  for (const operator of operators) {
    const countryRef = countryIdMap.get(operator.countryId);
    const docId = `catalog-operator-${operator.airaloOperatorId ?? operator.id}`;
    operatorIdMap.set(operator.id, docId);
    const country = countryById.get(operator.countryId);
    const sourceImageUrl =
      extractImageUrl(operator.imageJson) ??
      fallbackOperatorImageUrl(
        operator.airaloOperatorId?.toString() ?? null,
        operator.title,
      ) ??
      fallbackCountryImageUrl(country?.countryCode, country?.title);
    const image =
      (await resolveImageFromUrl(sourceImageUrl)) ??
      existingImages.get(docId) ??
      (await uploadPlaceholderImage("catalog-operator-placeholder.png"));

    operatorDocs.push({
      _id: docId,
      _type: "catalogOperator",
      title: operator.title,
      apiOperatorId: operator.airaloOperatorId ?? null,
      operatorCode: operator.airaloOperatorId?.toString() ?? null,
      badge: null,
      summary: null,
      image,
      country: countryRef
        ? { _type: "reference", _ref: countryRef }
        : null,
      metadataJson: serializeMetadata({
        apn: operator.apn,
        countries: operator.countriesJson,
        coverages: operator.coveragesJson,
        info: operator.info,
        type: operator.type,
      }),
      lastSyncedAt: now
    });
  }

  const packageDocs: SyncDocument[] = [];
  const primaryCandidateByCountryId = new Map<string, { priceCents: number; docId: string }>();

  for (const pkg of packages) {
    const countryRef = countryIdMap.get(pkg.operator.countryId);
    const operatorRef = operatorIdMap.get(pkg.operatorId);

    if (!countryRef || !operatorRef) {
      console.warn(
        `[sanity-sync] Skipping package ${pkg.airaloPackageId} due to missing references (countryRef=${countryRef}, operatorRef=${operatorRef})`
      );
      continue;
    }

    const docId = `catalog-package-${sanitizeDocumentId(pkg.airaloPackageId)}`;
    const sourceImageUrl = fallbackPackageImageUrl();
    const image =
      (await resolveImageFromUrl(sourceImageUrl)) ??
      existingImages.get(docId) ??
      (await uploadPlaceholderImage("catalog-package-placeholder.png"));

    const pkgDocId = `catalog-package-${sanitizeDocumentId(pkg.airaloPackageId)}`;
    const currentPriceCents =
      pkg.state?.sellingPriceCents ??
      Math.round(Number(pkg.price) * 100);

    if (typeof currentPriceCents === "number") {
      const current = primaryCandidateByCountryId.get(pkg.operator.countryId);
      if (!current || currentPriceCents <= current.priceCents) {
        primaryCandidateByCountryId.set(pkg.operator.countryId, { priceCents: currentPriceCents, docId: pkgDocId });
      }
    }

    packageDocs.push({
      _id: pkgDocId,
      _type: "catalogPackage",
      title: pkg.title,
      externalId: pkg.airaloPackageId,
      dataAmountMb: pkg.amount ?? null,
      validityDays: pkg.day ?? null,
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
      metadataJson: serializeMetadata({
        pricesNetPrice: pkg.pricesNetPrice,
        pricesRecommendedRetailPrice: pkg.pricesRecommendedRetailPrice,
      }),
      isActive: pkg.state?.isActive ?? true,
      deactivatedAt: pkg.state?.deactivatedAt?.toISOString() ?? null,
      lastSyncedAt: now
    });
  }

  await upsertDocuments(countryDocs, "catalog countries");
  await upsertDocuments(operatorDocs, "catalog operators");
  await upsertDocuments(packageDocs, "catalog packages", "sync");

  const primaryPackageRefByCountryDocId = new Map<string, string>();
  primaryCandidateByCountryId.forEach((candidate, countryId) => {
    const countryDocId = countryIdMap.get(countryId);
    if (countryDocId) {
      primaryPackageRefByCountryDocId.set(countryDocId, candidate.docId);
    }
  });

  const expectedPackageIds = new Set(packageDocs.map((doc) => doc._id as string));
  const existingPackageIds = await fetchExistingIds("catalogPackage");
  const countryDocsWithPrimary = countryDocs.map((doc) => {
    const docId = doc._id as string;
    const primaryRef = primaryPackageRefByCountryDocId.get(docId);
    return {
      ...doc,
      primaryPackage: primaryRef && expectedPackageIds.has(primaryRef) && existingPackageIds.has(primaryRef)
        ? { _type: "reference", _ref: primaryRef }
        : null,
    };
  });

  await upsertDocuments(countryDocsWithPrimary, "catalog countries (primary packages)", "sync");

  // Remove stale docs so Sanity mirrors the database exactly.
  const [existingCountryIds, existingOperatorIds, existingPackageIdsFinal] = await Promise.all([
    fetchExistingIds("catalogCountry"),
    fetchExistingIds("catalogOperator"),
    fetchExistingIds("catalogPackage")
  ]);

  const expectedCountryIds = new Set(countryDocs.map((doc) => doc._id as string));
  const expectedOperatorIds = new Set(operatorDocs.map((doc) => doc._id as string));
  const staleCountries = Array.from(existingCountryIds).filter((id) => !expectedCountryIds.has(id));
  const staleOperators = Array.from(existingOperatorIds).filter((id) => !expectedOperatorIds.has(id));
  const stalePackages = Array.from(existingPackageIdsFinal).filter((id) => !expectedPackageIds.has(id));

  await deleteDocuments(stalePackages, "catalog packages", "sync");
  await deleteDocuments(staleOperators, "catalog operators", "sync");
  await deleteDocuments(staleCountries, "catalog countries", "sync");

  console.info(
    `[sanity-sync] Completed. countries=${countryDocs.length} operators=${operatorDocs.length} packages=${packageDocs.length}`
  );

  return {
    countries: countryDocs.length,
    operators: operatorDocs.length,
    packages: packageDocs.length,
  };
}
