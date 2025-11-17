import { groq } from "next-sanity";
import type { AiraloPackage } from "@prisma/client";

import prisma from "../db/client";
import { getSanityClient } from "../sanity.client";
import type {
  CatalogPackageInfo,
  EsimProductStatus,
  EsimProductSummary,
  MoneyValue,
  PlanSummary,
  ProductSlugSet,
  ProviderInfo,
} from "../sanity.queries";
import type { ImageLike } from "../image";
import type { Package } from "../airalo/schemas";

const CARRIER_SUMMARY_FIELDS = `
  _id,
  title,
  "slug": slug.current,
  logo
`;

const PLAN_SUMMARY_FIELDS = `
  _id,
  title,
  "slug": slug.current,
  priceUSD,
  dataGB,
  validityDays,
  hotspot,
  fiveG,
  label,
  shortBlurb,
  provider->{
    ${CARRIER_SUMMARY_FIELDS}
  }
`;

const COUNTRY_REFERENCE_FIELDS = `
  _id,
  title,
  "slug": slug.current,
  badge,
  summary,
  coverImage,
  featured
`;

const CATALOG_PRODUCTS_QUERY = groq`
  *[_type == "eSimProduct"]{
    _id,
    displayName,
    "slug": slug.current,
    priceUSD,
    coverImage,
    shortDescription,
    providerBadge,
    status,
    keywords,
    plan->{
      ${PLAN_SUMMARY_FIELDS}
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
  plan?: PlanSummary;
  country?: {
    _id: string;
    title: string;
    slug: string;
    badge?: string;
    summary: string;
    coverImage?: ImageLike;
    featured?: boolean;
    plan?: PlanSummary;
  };
  keywords?: string[];
  price?: MoneyValue | null;
  provider?: ProviderInfo | null;
  slugs?: ProductSlugSet;
  package?: CatalogPackageInfo | null;
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
  if (!pkg.metadata) {
    return null;
  }

  try {
    const parsed = JSON.parse(pkg.metadata) as PackageMetadata;
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch (error) {
    console.warn(`Failed to parse Airalo package metadata for ${pkg.externalId}`, error);
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

function mergePlanWithPricing(plan: PlanSummary | undefined, price: MoneyValue | null, pkg: CatalogPackageInfo | null): PlanSummary | undefined {
  if (!plan) {
    return plan;
  }

  const priceUSDOverride = price && price.currency === "USD" ? price.amount : plan.priceUSD;

  return {
    ...plan,
    priceUSD: priceUSDOverride,
    price: price ?? plan.price ?? {
      amount: plan.priceUSD,
      currency: "USD",
      source: "sanity",
    },
    package: pkg ?? plan.package ?? null,
  };
}

function buildProviderInfo(product: SanityCatalogProduct): ProviderInfo | null {
  const provider = product.plan?.provider;
  const badge = product.providerBadge ?? undefined;

  if (!provider && !badge) {
    return null;
  }

  return {
    title: provider?.title,
    slug: provider?.slug,
    badge,
  };
}

function buildSlugs(product: SanityCatalogProduct): ProductSlugSet {
  return {
    product: product.slug,
    plan: product.plan?.slug,
    country: product.country?.slug,
  };
}

function applyPackageToProduct(
  product: SanityCatalogProduct,
  maps: PackageMaps,
): EsimProductSummary {
  const planSlug = normalizeKey(product.plan?.slug ?? null);
  const productSlug = normalizeKey(product.slug);
  const countrySlug = normalizeKey(product.country?.slug ?? null);

  const matchedRecord =
    (planSlug && maps.bySku.get(planSlug)) ||
    (productSlug && maps.bySku.get(productSlug)) ||
    (countrySlug && maps.byDestination.get(countrySlug)) ||
    null;

  const priceFromPackage = matchedRecord ? createPriceFromPackage(matchedRecord) : null;
  const packageInfo = matchedRecord ? createPackageInfo(matchedRecord) : null;

  const fallbackPrice: MoneyValue | null = product.price ??
    (typeof product.priceUSD === "number"
      ? {
          amount: product.priceUSD,
          currency: "USD",
          source: "sanity" as const,
        }
      : null);

  const price = priceFromPackage ?? fallbackPrice;
  const priceUSD =
    price && price.currency === "USD"
      ? price.amount
      : typeof product.priceUSD === "number"
        ? product.priceUSD
        : price?.amount ?? product.plan?.priceUSD ?? 0;

  const provider = product.provider ?? buildProviderInfo(product);
  const slugs = product.slugs ?? buildSlugs(product);

  const mergedPlan = mergePlanWithPricing(product.plan, price, packageInfo);

  return {
    ...product,
    plan: mergedPlan,
    priceUSD,
    price,
    providerBadge: provider?.badge,
    provider,
    slugs,
    package: packageInfo ?? product.package ?? null,
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

    const planSlug = product.slugs?.plan ?? product.plan?.slug;
    if (planSlug && !map.has(planSlug)) {
      map.set(planSlug, product);
    }
  }

  return map;
}
