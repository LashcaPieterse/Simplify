import { groq } from "next-sanity";
import type { AiraloPackage } from "@prisma/client";

import prisma from "../db/client";
import { getSanityClient } from "../sanity.client";
import type {
  CatalogPackageInfo,
  EsimProductStatus,
  EsimProductSummary,
  MoneyValue,
  ProductSlugSet,
  ProviderInfo,
} from "../sanity.queries";
import type { ImageLike } from "../image";
import type { Package } from "../airalo/schemas";

// Featured products now reference Catalog Countries and Catalog Packages directly.
const COUNTRY_REFERENCE_FIELDS = `
  _id,
  title,
  "slug": slug.current,
  badge,
  summary,
  coverImage,
  featured
`;

const CATALOG_PACKAGE_FIELDS = `
  _id,
  externalId,
  title,
  priceCents,
  sellingPriceCents,
  currencyCode,
  dataAmountMb,
  validityDays,
  isUnlimited,
  badge,
  summary,
  shortInfo,
  image,
  operator->{
    _id,
    title,
    operatorCode,
    badge,
    summary,
    image
  }
`;

const CATALOG_PRODUCTS_QUERY = groq`
  *[_type == "eSimProduct"]{
    _id,
    displayName,
    "slug": slug.current,
    priceUSD,
    // Prefer explicit product artwork; otherwise fall back to the catalog country's cover image.
    "coverImage": coalesce(coverImage, country->coverImage),
    shortDescription,
    providerBadge,
    status,
    keywords,
    package->{
      ${CATALOG_PACKAGE_FIELDS}
    },
    country->{
      ${COUNTRY_REFERENCE_FIELDS}
    }
  }
`;

type SanityCatalogProduct = {
  _id: string;
  displayName: string;
  slug: string;
  priceUSD: number;
  coverImage?: ImageLike;
  shortDescription: string;
  providerBadge?: string;
  status: EsimProductStatus;
  package?: CatalogPackageDoc | null;
  country?: CatalogCountryDoc | null;
  keywords?: string[];
  price?: MoneyValue | null;
  provider?: ProviderInfo | null;
  slugs?: ProductSlugSet;
};

type CatalogCountryDoc = {
  _id: string;
  title: string;
  slug: string;
  badge?: string | null;
  summary?: string | null;
  coverImage?: ImageLike;
  featured?: boolean;
};

type CatalogPackageDoc = {
  _id: string;
  externalId?: string;
  title?: string;
  priceCents?: number;
  sellingPriceCents?: number | null;
  currencyCode?: string;
  dataAmountMb?: number | null;
  validityDays?: number | null;
  isUnlimited?: boolean;
  badge?: string | null;
  summary?: string | null;
  shortInfo?: string | null;
  image?: ImageLike;
  operator?: {
    _id: string;
    title?: string;
    operatorCode?: string;
    badge?: string;
    summary?: string | null;
    image?: ImageLike;
  } | null;
};

type MultiCurrencyPriceMap = NonNullable<Package["net_prices"]>;

type PackageMetadata = {
  sku?: string | null;
  destination?: string | null;
  destinationName?: string | null;
  netPrices?: MultiCurrencyPriceMap | null;
  recommendedRetailPrices?: MultiCurrencyPriceMap | null;
  [key: string]: unknown;
};

type PackageRecord = {
  pkg: AiraloPackage;
  metadata: PackageMetadata | null;
};

type PackageMaps = {
  bySku: Map<string, PackageRecord>;
  byDestination: Map<string, PackageRecord>;
};

function normalizeKey(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function parsePackageMetadata(pkg: AiraloPackage): PackageMetadata | null {
  const raw = pkg.metadata;
  if (!raw) return null;

  // prisma JSON fields can be stored as stringified JSON or object; handle both.
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as PackageMetadata;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.warn(`Failed to parse Airalo package metadata for ${pkg.externalId}`, error);
    }
    return null;
  }

  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as PackageMetadata;
  }

  return null;
}

function buildPackageMaps(packages: AiraloPackage[]): PackageMaps {
  const bySku = new Map<string, PackageRecord>();
  const byDestination = new Map<string, PackageRecord>();

  for (const pkg of packages) {
    const metadata = parsePackageMetadata(pkg);
    const record: PackageRecord = { pkg, metadata };

    const skuKey = normalizeKey(metadata?.sku ?? null);
    if (skuKey && !bySku.has(skuKey)) {
      bySku.set(skuKey, record);
    }

    const destinationKeys = new Set<string>();
    const destination = normalizeKey(metadata?.destination ?? null);
    const destinationName = normalizeKey(metadata?.destinationName ?? null);
    const region = normalizeKey(pkg.region ?? null);

    if (destination) {
      destinationKeys.add(destination);
    }
    if (destinationName) {
      destinationKeys.add(destinationName);
    }
    if (region) {
      destinationKeys.add(region);
    }

    destinationKeys.forEach((key) => {
      if (key && !byDestination.has(key)) {
        byDestination.set(key, record);
      }
    });
  }

  return { bySku, byDestination };
}

function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

function createPriceFromPackage(record: PackageRecord): MoneyValue {
  return {
    amount: centsToAmount(record.pkg.priceCents),
    currency: record.pkg.currency.toUpperCase(),
    source: "airalo",
    lastSyncedAt: record.pkg.lastSyncedAt?.toISOString() ?? null,
  };
}

function createPackageInfo(record: PackageRecord): CatalogPackageInfo {
  return {
    id: record.pkg.id,
    externalId: record.pkg.externalId,
    currency: record.pkg.currency.toUpperCase(),
    priceCents: record.pkg.priceCents,
    dataLimitMb: record.pkg.dataLimitMb,
    validityDays: record.pkg.validityDays,
    region: record.pkg.region,
    lastSyncedAt: record.pkg.lastSyncedAt?.toISOString() ?? null,
    metadata: record.metadata,
  };
}

function buildProviderInfo(product: SanityCatalogProduct, pkg?: CatalogPackageInfo | null): ProviderInfo | null {
  const badge = product.providerBadge ?? undefined;
  const operator = pkg?.operator;

  if (!operator && !badge) {
    return null;
  }

  return {
    title: operator?.title,
    slug: operator?.slug,
    badge,
  };
}

function buildSlugs(product: SanityCatalogProduct): ProductSlugSet {
  return {
    product: product.slug,
    plan: product.package?.externalId,
    country: product.country?.slug,
  };
}

function toCatalogPackageInfo(pkg?: CatalogPackageDoc | null): CatalogPackageInfo | null {
  if (!pkg) return null;

  const currency = pkg.currencyCode ?? "USD";

  return {
    id: pkg._id,
    externalId: pkg.externalId ?? pkg._id,
    title: pkg.title,
    currency,
    badge: pkg.badge,
    summary: pkg.summary,
    image: pkg.image,
    priceCents: pkg.priceCents ?? 0,
    dataLimitMb: pkg.dataAmountMb ?? null,
    validityDays: pkg.validityDays ?? null,
    region: null,
    lastSyncedAt: null,
    metadata: null,
    operator: pkg.operator
      ? {
          _id: pkg.operator._id,
          title: pkg.operator.title ?? "",
          slug: pkg.operator.operatorCode ?? pkg.operator._id,
          logo: pkg.operator.image,
          badge: pkg.operator.badge,
        }
      : undefined,
  };
}

function priceFromCatalogPackage(pkg?: CatalogPackageInfo | null): MoneyValue | null {
  if (!pkg || typeof pkg.priceCents !== "number") return null;

  return {
    amount: centsToAmount(pkg.priceCents),
    currency: pkg.currency,
    source: "sanity",
  };
}

function applyPackageToProduct(
  product: SanityCatalogProduct,
  maps: PackageMaps,
): EsimProductSummary {
  const productSlug = normalizeKey(product.slug);
  const countrySlug = normalizeKey(product.country?.slug ?? null);
  const packageInfoFromSanity = toCatalogPackageInfo(product.package);

  const matchedRecord =
    (productSlug && maps.bySku.get(productSlug)) ||
    (countrySlug && maps.byDestination.get(countrySlug)) ||
    null;

  const priceFromPackage = matchedRecord ? createPriceFromPackage(matchedRecord) : null;
  const packageInfo = packageInfoFromSanity ?? (matchedRecord ? createPackageInfo(matchedRecord) : null);
  const sanityPackagePrice = priceFromCatalogPackage(packageInfoFromSanity);

  const fallbackPrice: MoneyValue | null = product.price ??
    (typeof product.priceUSD === "number"
      ? {
          amount: product.priceUSD,
          currency: "USD",
          source: "sanity" as const,
        }
      : null);

  const price = priceFromPackage ?? sanityPackagePrice ?? fallbackPrice;
  const priceUSD =
    price && price.currency === "USD"
      ? price.amount
      : typeof product.priceUSD === "number"
        ? product.priceUSD
        : price?.amount ?? 0;

  const provider = product.provider ?? buildProviderInfo(product, packageInfo);
  const slugs = product.slugs ?? buildSlugs(product);

  return {
    ...product,
    priceUSD,
    price,
    providerBadge: provider?.badge,
    provider,
    slugs,
    package: packageInfo ?? null,
  };
}

export interface CatalogProductSummaryOptions {
  fetchProducts?: () => Promise<SanityCatalogProduct[]>;
  fetchPackages?: () => Promise<AiraloPackage[]>;
}

export async function getCatalogProductSummaries(
  options: CatalogProductSummaryOptions = {},
): Promise<EsimProductSummary[]> {
  const fetchProducts =
    options.fetchProducts ??
    (() => getSanityClient().fetch<SanityCatalogProduct[]>(CATALOG_PRODUCTS_QUERY));

  const fetchPackages =
    options.fetchPackages ??
    (() =>
      prisma.airaloPackage.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
      }));

  const [products, packages] = await Promise.all([fetchProducts(), fetchPackages()]);

  if (!products?.length) {
    return [];
  }

  const maps = buildPackageMaps(packages);

  return products.map((product) => applyPackageToProduct(product, maps));
}

export async function getCatalogProductSummariesMap(): Promise<Map<string, EsimProductSummary>> {
  const products = await getCatalogProductSummaries();
  const map = new Map<string, EsimProductSummary>();

  for (const product of products) {
    const slug = product.slugs?.product ?? product.slug;
    if (slug && !map.has(slug)) {
      map.set(slug, product);
    }

    const packageSlug = product.slugs?.plan;
    if (packageSlug && !map.has(packageSlug)) {
      map.set(packageSlug, product);
    }
  }

  return map;
}
