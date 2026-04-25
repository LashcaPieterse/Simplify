import { groq } from "next-sanity";
import type { Prisma } from "@prisma/client";

import prisma from "../db/client";
import { getSanityClient } from "../sanity.client";
import type {
  CatalogPackageInfo,
  CountrySummary,
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
  "coverImage": image,
  featured
`;

const CATALOG_PACKAGE_FIELDS = `
  _id,
  externalId,
  title,
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
    // Always use the selected Catalog Country cover when available; otherwise fall back to the product cover image.
    "coverImage": coalesce(country->image, coverImage),
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

type PackageRecord = {
  pkg: Prisma.PackageGetPayload<{
    select: typeof CATALOG_PACKAGE_SELECT;
  }>;
};

const CATALOG_PACKAGE_SELECT = {
  id: true,
  airaloPackageId: true,
  title: true,
  amount: true,
  day: true,
  isUnlimited: true,
  price: true,
  netPrice: true,
  pricesNetPrice: true,
  pricesRecommendedRetailPrice: true,
  shortInfo: true,
  qrInstallation: true,
  manualInstallation: true,
  isFairUsagePolicy: true,
  fairUsagePolicy: true,
  createdAt: true,
  updatedAt: true,
  operator: {
    select: {
      id: true,
      title: true,
      airaloOperatorId: true,
    },
  },
  state: {
    select: {
      isActive: true,
      sellingPriceCents: true,
      basePriceCents: true,
      currencyCode: true,
      lastSyncedAt: true,
      updatedAt: true,
    },
  },
} as const satisfies Prisma.PackageSelect;

type PackageMaps = {
  bySku: Map<string, PackageRecord["pkg"]>;
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

function buildPackageMaps(packages: PackageRecord["pkg"][]): PackageMaps {
  const bySku = new Map<string, PackageRecord["pkg"]>();

  for (const pkg of packages) {
    const skuKey = normalizeKey(pkg.airaloPackageId ?? null);
    if (skuKey && !bySku.has(skuKey)) {
      bySku.set(skuKey, pkg);
    }
  }

  return { bySku };
}

function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

function hasConfiguredSellingPrice(
  state: PackageRecord["pkg"]["state"],
): state is NonNullable<PackageRecord["pkg"]["state"]> & { sellingPriceCents: number } {
  if (!state) {
    return false;
  }

  return typeof state.sellingPriceCents === "number";
}

function createPriceFromPackage(record: PackageRecord): MoneyValue | null {
  const state = record.pkg.state;
  if (!hasConfiguredSellingPrice(state)) {
    return null;
  }

  const priceCents = state.sellingPriceCents;
  return {
    amount: centsToAmount(priceCents),
    currency: (state.currencyCode ?? "USD").toUpperCase(),
    source: "airalo",
    lastSyncedAt:
      state.lastSyncedAt?.toISOString() ??
      record.pkg.updatedAt?.toISOString() ??
      null,
  };
}

function createPackageInfo(record: PackageRecord): CatalogPackageInfo {
  const state = record.pkg.state;
  const hasSellingPrice = hasConfiguredSellingPrice(state);
  const isSellable = (state?.isActive ?? false) && hasSellingPrice;
  const priceCents = hasSellingPrice ? state.sellingPriceCents : 0;
  return {
    id: record.pkg.id,
    externalId: record.pkg.airaloPackageId,
    title: record.pkg.title,
    currency: (record.pkg.state?.currencyCode ?? "USD").toUpperCase(),
    priceCents,
    isActive: isSellable,
    dataLimitMb: record.pkg.amount,
    validityDays: record.pkg.day,
    region: null,
    lastSyncedAt:
      record.pkg.state?.lastSyncedAt?.toISOString() ??
      record.pkg.updatedAt?.toISOString() ??
      null,
    metadata: {
      sku: record.pkg.airaloPackageId,
      netPrices: (record.pkg.pricesNetPrice as MultiCurrencyPriceMap | null) ?? null,
      recommendedRetailPrices:
        (record.pkg.pricesRecommendedRetailPrice as MultiCurrencyPriceMap | null) ?? null,
    },
    operator: record.pkg.operator
      ? {
          _id: record.pkg.operator.id,
          title: record.pkg.operator.title ?? "",
          slug:
            record.pkg.operator.airaloOperatorId?.toString() ??
            record.pkg.operator.id,
          logo: undefined,
          badge: undefined,
        }
      : undefined,
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

  return {
    id: pkg._id,
    externalId: pkg.externalId ?? pkg._id,
    title: pkg.title,
    currency: "USD",
    badge: pkg.badge,
    summary: pkg.summary,
    image: pkg.image,
    priceCents: 0,
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

function applyPackageToProduct(
  product: SanityCatalogProduct,
  maps: PackageMaps,
): EsimProductSummary {
  const packageSlug = normalizeKey(product.package?.externalId ?? product.slugs?.plan ?? null);
  const packageInfoFromSanity = toCatalogPackageInfo(product.package);

  const matchedPkg = packageSlug ? maps.bySku.get(packageSlug) ?? null : null;
  const matchedRecord = matchedPkg ? { pkg: matchedPkg } : null;

  const priceFromPackage = matchedRecord ? createPriceFromPackage(matchedRecord) : null;
  let packageInfo: CatalogPackageInfo | null = null;
  if (packageInfoFromSanity) {
    const isSellable = matchedRecord
      ? (matchedRecord.pkg.state?.isActive ?? false) &&
        hasConfiguredSellingPrice(matchedRecord.pkg.state)
      : false;
    packageInfo = {
      ...packageInfoFromSanity,
      isActive: isSellable,
    };
  } else if (matchedRecord) {
    packageInfo = createPackageInfo(matchedRecord);
  }
  const price = priceFromPackage ?? null;
  const priceUSD = price?.currency === "USD" ? price.amount : 0;

  const provider = product.provider ?? buildProviderInfo(product, packageInfo);
  const slugs = product.slugs ?? buildSlugs(product);
  const country: CountrySummary | undefined = product.country
    ? {
        _id: product.country._id,
        title: product.country.title,
        slug: product.country.slug,
        badge: product.country.badge ?? undefined,
        summary: product.country.summary ?? undefined,
        coverImage: product.country.coverImage,
        featured: product.country.featured ?? false,
      }
    : undefined;

  return {
    ...product,
    priceUSD,
    price,
    providerBadge: provider?.badge,
    provider,
    slugs,
    country,
    package: packageInfo ?? null,
  };
}

export interface CatalogProductSummaryOptions {
  fetchProducts?: () => Promise<SanityCatalogProduct[]>;
  fetchPackages?: () => Promise<PackageRecord["pkg"][]>;
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
      prisma.package.findMany({
        where: { state: { is: { isActive: true } } },
        select: CATALOG_PACKAGE_SELECT,
        orderBy: [{ updatedAt: "desc" }],
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
