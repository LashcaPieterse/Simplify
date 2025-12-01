import { groq } from "next-sanity";
import { getSanityClient, isSanityConfigured } from "./sanity.client";
import { getCatalogProductSummaries } from "./catalog/query";

export { prisma } from "./db/client";
import {
  fallbackCountryDetails,
  fallbackCountrySummaries,
  fallbackEsimProductSummaries,
  fallbackHomePage,
  fallbackPlanDetails,
  fallbackPostSummaries,
  fallbackRegionBundles,
  fallbackSiteSettings,
  getFallbackBundleBySlug,
  getFallbackCountryPlans,
  getFallbackPlanBySlug,
  getFallbackProductBySlug,
  getFallbackPostBySlug
} from "./sanity.fallback";
import type { ImageLike } from "./image";
import type { EsimProductCardData } from "./products";

export type PortableTextSpan = {
  _type: "span";
  text?: string;
  marks?: string[];
};

export type PortableTextBlock = {
  _type: "block";
  _key?: string;
  style?: string;
  children?: PortableTextSpan[];
  markDefs?: { _key: string; href?: string }[];
  listItem?: "bullet" | "number" | string;
  level?: number;
};

export type Link = {
  label: string;
  url: string;
};

export type Stat = {
  label: string;
  value: string;
};

export type HeroSection = {
  _type: "heroSection";
  headline: string;
  subhead: string;
  ctas?: Link[];
  stats: Stat[];
  featuredProductIds?: string[];
  featuredProducts?: EsimProductSummary[];
};

export type CountrySummary = {
  _id: string;
  title: string;
  slug: string;
  badge?: string;
  summary: string;
  coverImage?: ImageLike;
  plan?: PlanSummary;
  featured?: boolean;
  productCard?: EsimProductCardData;
};

export type CatalogCountrySummary = {
  _id: string;
  title: string;
  slug: string;
  countryCode?: string;
  image?: ImageLike;
};

export type CountryGridSection = {
  _type: "countryGridSection";
  title: string;
  countries: CountrySummary[];
};

export type WhyChooseUsSection = {
  _type: "whyChooseUsSection";
  title: string;
  bullets: IconBullet[];
};

export type StepsSection = {
  _type: "stepsSection";
  title: string;
  steps: StepItem[];
};

export type RegionalBundleSpotlightSection = {
  _type: "regionalBundleSpotlightSection";
  title: string;
  bundle: RegionBundle;
};

export type LiveNetworkWidgetSection = {
  _type: "liveNetworkWidgetSection";
  title: string;
  regions: LiveRegion[];
};

export type NewsletterSection = {
  _type: "newsletterSection";
  title: string;
  body: string;
  ctaLabel: string;
  ctaTarget: string;
};

export type ArticlesSection = {
  _type: "articlesSection";
  title: string;
  posts: PostSummary[];
};

export type HomeSection =
  | HeroSection
  | CountryGridSection
  | WhyChooseUsSection
  | StepsSection
  | RegionalBundleSpotlightSection
  | LiveNetworkWidgetSection
  | NewsletterSection
  | ArticlesSection;

export type IconBullet = {
  iconName: string;
  title: string;
  body: string;
};

export type StepItem = {
  stepNo: number;
  title: string;
  body: string;
};

export type LiveRegion = {
  name: string;
  latencyMs: number;
  signalQuality: string;
};

export type CatalogOperatorSummary = {
  _id: string;
  title: string;
  operatorCode?: string | null;
  apiOperatorId?: number | null;
  slug?: string;
  logo?: ImageLike;
  image?: ImageLike;
};

export type CarrierSummary = CatalogOperatorSummary;

export type MoneyValue = {
  amount: number;
  currency: string;
  source: "airalo" | "sanity";
  lastSyncedAt?: string | null;
};

export type ProviderInfo = {
  title?: string;
  slug?: string;
  badge?: string;
};

export type ProductSlugSet = {
  product?: string;
  plan?: string;
  country?: string;
};

export type CatalogPackageInfo = {
  id: string;
  externalId: string;
  currency: string;
  priceCents: number;
  dataLimitMb?: number | null;
  validityDays?: number | null;
  region?: string | null;
  lastSyncedAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CatalogPackageDocument = {
  _id: string;
  title: string;
  externalId: string;
  priceCents?: number;
  sellingPriceCents?: number | null;
  currencyCode?: string;
  dataAmountMb?: number | null;
  validityDays?: number | null;
  isUnlimited?: boolean;
  isActive?: boolean;
  lastSyncedAt?: string | null;
  metadataJson?: string | null;
  operator?: CatalogOperatorSummary | null;
  country?: CatalogCountrySummary | null;
};

export const getCatalogPackageId = (
  pkg?: CatalogPackageInfo | CatalogPackageDocument | null
): string | null => {
  if (!pkg) {
    return null;
  }

  if ("id" in pkg) {
    return pkg.id;
  }

  return pkg._id ?? pkg.externalId ?? null;
};

export type PlanSummary = {
  _id: string;
  title: string;
  slug: string;
  priceUSD: number;
  dataGB: number;
  validityDays: number;
  hotspot?: boolean;
  fiveG?: boolean;
  label?: string;
  shortBlurb: string;
  provider?: CatalogOperatorSummary;
  price?: MoneyValue | null;
  package?: CatalogPackageInfo | CatalogPackageDocument | null;
};

export type RegionBundle = {
  _id: string;
  title: string;
  slug: string;
  countries: CountrySummary[];
  sharedDataGB: number;
  includes: string[];
  fiveG?: boolean;
  support: string;
  perks?: string[];
  heroImage?: ImageLike;
  ctaLabel?: string;
  ctaTarget?: string;
  featuredProductCard?: EsimProductCardData;
};

export type EsimProductStatus = "active" | "comingSoon" | "archived";

export type EsimProductSummary = {
  _id: string;
  displayName: string;
  slug: string;
  priceUSD: number;
  coverImage?: ImageLike;
  shortDescription: string;
  providerBadge?: string;
  status: EsimProductStatus;
  plan?: PlanSummary;
  country?: CountrySummary;
  keywords?: string[];
  price?: MoneyValue | null;
  provider?: ProviderInfo | null;
  slugs?: ProductSlugSet;
  package?: CatalogPackageInfo | null;
};

export type EsimProductDetail = EsimProductSummary & {
  longDescription: PortableTextBlock[];
  keywords: string[];
};

export type PostSummary = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage?: ImageLike;
  readingMinutes: number;
  tags?: string[];
  publishedAt: string;
};

export type CountryDetail = CountrySummary & {
  carriers?: CarrierSummary[];
  plans?: PlanSummary[];
};

export type PlanDetail = PlanSummary & {
  features?: string[];
  whatsIncluded: string[];
  installSteps: PortableTextBlock[];
  terms?: PortableTextBlock[];
  country?: CatalogCountrySummary | CountrySummary;
};

export type PostDetail = PostSummary & {
  body: PortableTextBlock[];
};

export type SiteSettings = {
  title: string;
  tagline: string;
  logo?: ImageLike;
  contactEmail: string;
  navigation: Link[];
  footerLinks?: Link[];
};

export type HomePagePayload = {
  title: string;
  sections: HomeSection[];
};

const structuredCloneFn: (<T>(value: T) => T) | undefined = (globalThis as { structuredClone?: <T>(value: T) => T }).structuredClone;

const clone = <T>(value: T): T => {
  if (typeof value === "undefined" || value === null) {
    return value;
  }

  if (structuredCloneFn) {
    return structuredCloneFn(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
};

const parseMetadataJson = (value?: string | null): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch (error) {
    console.warn("Failed to parse metadata JSON", error);
    return null;
  }
};

const normalizeCatalogPackage = (
  pkg?: CatalogPackageInfo | CatalogPackageDocument | null
): CatalogPackageInfo | null => {
  if (!pkg) {
    return null;
  }

  if ("currency" in pkg) {
    return pkg as CatalogPackageInfo;
  }

  return {
    id: pkg._id ?? pkg.externalId,
    externalId: pkg.externalId,
    currency: pkg.currencyCode ?? "USD",
    priceCents: pkg.priceCents ?? pkg.sellingPriceCents ?? 0,
    dataLimitMb: pkg.dataAmountMb ?? null,
    validityDays: pkg.validityDays ?? null,
    region: null,
    lastSyncedAt: pkg.lastSyncedAt ?? null,
    metadata: parseMetadataJson(pkg.metadataJson)
  };
};

const CARRIER_SUMMARY_FIELDS = `
  _id,
  title,
  "slug": slug.current,
  logo
`;

const CATALOG_COUNTRY_FIELDS = `
  _id,
  title,
  "slug": slug.current,
  countryCode,
  image
`;

const CATALOG_OPERATOR_FIELDS = `
  _id,
  title,
  operatorCode,
  apiOperatorId,
  image,
  "logo": image,
  country->{
    ${CATALOG_COUNTRY_FIELDS}
  }
`;

const CATALOG_PACKAGE_FIELDS = `
  _id,
  title,
  externalId,
  priceCents,
  sellingPriceCents,
  currencyCode,
  dataAmountMb,
  validityDays,
  isUnlimited,
  isActive,
  lastSyncedAt,
  metadataJson,
  operator->{
    ${CATALOG_OPERATOR_FIELDS}
  },
  country->{
    ${CATALOG_COUNTRY_FIELDS}
  }
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
    ${CATALOG_OPERATOR_FIELDS}
  },
  package->{
    ${CATALOG_PACKAGE_FIELDS}
  }
`;

const COUNTRY_CARD_FIELDS = `
  _id,
  title,
  "slug": slug.current,
  badge,
  summary,
  coverImage,
  featured,
  "plan": plans[0]->{
    ${PLAN_SUMMARY_FIELDS}
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

const REGION_BUNDLE_FIELDS = `
  _id,
  title,
  "slug": slug.current,
  countries[]->{
    ${COUNTRY_CARD_FIELDS}
  },
  sharedDataGB,
  includes,
  fiveG,
  support,
  perks,
  heroImage,
  ctaLabel,
  ctaTarget
`;

const POST_SUMMARY_FIELDS = `
  _id,
  title,
  "slug": slug.current,
  excerpt,
  coverImage,
  readingMinutes,
  tags,
  "publishedAt": coalesce(publishedAt, _updatedAt)
`;

const PLAN_DETAIL_FIELDS = `
  ${PLAN_SUMMARY_FIELDS},
  features,
  whatsIncluded,
  installSteps[]{..., markDefs[], children[]},
  terms[]{..., markDefs[], children[]},
  country->{
    ${CATALOG_COUNTRY_FIELDS}
  }
`;

const ESIM_PRODUCT_CARD_FIELDS = `
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
`;

const ESIM_PRODUCT_DETAIL_FIELDS = `
  ${ESIM_PRODUCT_CARD_FIELDS},
  longDescription[]{..., markDefs[], children[]},
  keywords
`;

const siteSettingsQuery = groq`
  *[_type == "siteSettings"][0]{
    title,
    tagline,
    logo,
    contactEmail,
    navigation[]{label, "url": url},
    footerLinks[]{label, "url": url}
  }
`;

const homePageQuery = groq`
  *[_type == "homePage"][0]{
    title,
    sections[]{
      _type == "heroSection" => {
        _type,
        headline,
        subhead,
        ctas[]{label, "url": url},
        stats[]{label, value},
        "featuredProductIds": featuredProducts[]._ref,
        "featuredProducts": featuredProducts[]->{
          ${ESIM_PRODUCT_CARD_FIELDS}
        }
      },
      _type == "countryGridSection" => {
        _type,
        title,
        "countries": countries[]->{
          ${COUNTRY_CARD_FIELDS}
        }
      },
      _type == "whyChooseUsSection" => {
        _type,
        title,
        bullets[]{iconName, title, body}
      },
      _type == "stepsSection" => {
        _type,
        title,
        steps[]{stepNo, title, body}
      },
      _type == "regionalBundleSpotlightSection" => {
        _type,
        title,
        bundle->{
          ${REGION_BUNDLE_FIELDS}
        }
      },
      _type == "liveNetworkWidgetSection" => {
        _type,
        title,
        regions[]{name, latencyMs, signalQuality}
      },
      _type == "newsletterSection" => {
        _type,
        title,
        body,
        ctaLabel,
        "ctaTarget": ctaTarget
      },
      _type == "articlesSection" => {
        _type,
        title,
        posts[]->{
          ${POST_SUMMARY_FIELDS}
        }
      }
    }
  }
`;

const countriesQuery = groq`
  *[_type == "country"] | order(title asc) {
    ${COUNTRY_CARD_FIELDS}
  }
`;

const countryBySlugQuery = groq`
  *[_type == "country" && slug.current == $slug][0]{
    ${COUNTRY_CARD_FIELDS},
    carriers[]->{
      ${CARRIER_SUMMARY_FIELDS}
    },
    plans[]->{
      ${PLAN_SUMMARY_FIELDS}
    }
  }
`;

const plansForCountryQuery = groq`
  *[_type == "plan" && country->slug.current == $slug] | order(priceUSD asc) {
    ${PLAN_DETAIL_FIELDS}
  }
`;

const planBySlugQuery = groq`
  *[_type == "plan" && slug.current == $slug][0]{
    ${PLAN_DETAIL_FIELDS}
  }
`;

const planSlugsQuery = groq`
  *[_type == "plan" && defined(slug.current)]{ "slug": slug.current }
`;

export const esimProductsQuery = groq`
  *[_type == "eSimProduct"] | order(displayName asc) {
    ${ESIM_PRODUCT_CARD_FIELDS}
  }
`;

export const esimProductBySlugQuery = groq`
  *[_type == "eSimProduct" && slug.current == $slug][0]{
    ${ESIM_PRODUCT_DETAIL_FIELDS}
  }
`;

export const esimProductSlugsQuery = groq`
  *[_type == "eSimProduct" && defined(slug.current)]{ "slug": slug.current }
`;

const regionBundlesQuery = groq`
  *[_type == "regionBundle"] | order(title asc) {
    ${REGION_BUNDLE_FIELDS}
  }
`;

const bundleBySlugQuery = groq`
  *[_type == "regionBundle" && slug.current == $slug][0]{
    ${REGION_BUNDLE_FIELDS}
  }
`;

const postsQuery = groq`
  *[_type == "post"] | order(publishedAt desc) {
    ${POST_SUMMARY_FIELDS}
  }
`;

const postBySlugQuery = groq`
  *[_type == "post" && slug.current == $slug][0]{
    ${POST_SUMMARY_FIELDS},
    body[]{..., markDefs[], children[]}
  }
`;

export async function getSiteSettings(): Promise<SiteSettings | null> {
  if (!isSanityConfigured) {
    return clone(fallbackSiteSettings);
  }

  try {
    const client = getSanityClient();
    const settings = await client.fetch<SiteSettings | null>(siteSettingsQuery);
    return settings ?? clone(fallbackSiteSettings);
  } catch (error) {
    console.error("Failed to fetch site settings from Sanity", error);
    return clone(fallbackSiteSettings);
  }
}

export async function getHomePage(): Promise<HomePagePayload | null> {
  if (!isSanityConfigured) {
    return clone(fallbackHomePage);
  }

  try {
    const client = getSanityClient();
    const home = await client.fetch<HomePagePayload | null>(homePageQuery);
    return home ?? clone(fallbackHomePage);
  } catch (error) {
    console.error("Failed to fetch home page content from Sanity", error);
    return clone(fallbackHomePage);
  }
}

export async function getCountriesList(): Promise<CountrySummary[]> {
  if (!isSanityConfigured) {
    return clone(fallbackCountrySummaries);
  }

  try {
    const client = getSanityClient();
    const results = await client.fetch<CountrySummary[]>(countriesQuery);
    return results ?? [];
  } catch (error) {
    console.error("Failed to fetch countries from Sanity", error);
    return clone(fallbackCountrySummaries);
  }
}

async function enrichPlansWithCatalogPricing<T extends PlanSummary>(plans: T[]): Promise<T[]> {
  if (!plans.length) {
    return plans;
  }

  try {
    const products = await getCatalogProductSummaries();
    if (!products.length) {
      return plans;
    }

    const byPlanSlug = new Map<string, EsimProductSummary>();

    for (const product of products) {
      const planSlug = product.slugs?.plan ?? product.plan?.slug;
      if (!planSlug || byPlanSlug.has(planSlug)) {
        continue;
      }

      byPlanSlug.set(planSlug, product);
    }

    return plans.map((plan) => {
      const product = byPlanSlug.get(plan.slug);
      const planPackage = normalizeCatalogPackage(plan.package);
      if (!product) {
        return { ...plan, package: planPackage };
      }

      const productPrice: MoneyValue | null = product.price ?? null;
      const planPrice: MoneyValue | null = plan.price ?? null;

      const resolvedPriceUSD =
        productPrice && productPrice.currency === "USD"
          ? productPrice.amount
          : product.priceUSD ?? plan.priceUSD;

      const fallbackPrice: MoneyValue = {
        amount: resolvedPriceUSD,
        currency: (productPrice ?? planPrice)?.currency ?? "USD",
        source: (productPrice ?? planPrice)?.source ?? "sanity",
        lastSyncedAt: (productPrice ?? planPrice)?.lastSyncedAt ?? null,
      };

      const resolvedPrice = productPrice ?? planPrice ?? fallbackPrice;

      return {
        ...plan,
        priceUSD: resolvedPriceUSD ?? plan.priceUSD,
        price: resolvedPrice,
        package: product.package ?? planPackage ?? null,
      };
    });
  } catch (error) {
    console.error("Failed to merge catalog pricing with Sanity plans", error);
    return plans;
  }
}

async function enrichPlanWithCatalogPricing<T extends PlanSummary>(plan: T | null): Promise<T | null> {
  if (!plan) {
    return plan;
  }

  const [enriched] = await enrichPlansWithCatalogPricing([plan]);
  return enriched ?? plan;
}

export async function getCountryBySlug(slug: string): Promise<CountryDetail | null> {
  if (!isSanityConfigured) {
    const fallback = fallbackCountryDetails.find((country) => country.slug === slug);
    return fallback ? clone(fallback) : null;
  }

  try {
    const client = getSanityClient();
    const country = await client.fetch<CountryDetail | null>(countryBySlugQuery, { slug });
    if (!country) {
      return null;
    }

    const enrichedPlan = await enrichPlanWithCatalogPricing(country.plan ?? null);
    return enrichedPlan ? { ...country, plan: enrichedPlan } : country;
  } catch (error) {
    console.error(`Failed to fetch country '${slug}' from Sanity`, error);
    const fallback = fallbackCountryDetails.find((country) => country.slug === slug);
    return fallback ? clone(fallback) : null;
  }
}

export async function getPlansForCountry(slug: string): Promise<PlanDetail[]> {
  if (!isSanityConfigured) {
    return clone(getFallbackCountryPlans(slug));
  }

  try {
    const client = getSanityClient();
    const plans = await client.fetch<PlanDetail[]>(plansForCountryQuery, { slug });
    const enriched = await enrichPlansWithCatalogPricing(plans ?? []);
    return enriched ?? [];
  } catch (error) {
    console.error(`Failed to fetch plans for country '${slug}' from Sanity`, error);
    return clone(getFallbackCountryPlans(slug));
  }
}

export async function getPlanBySlug(slug: string): Promise<PlanDetail | null> {
  if (!isSanityConfigured) {
    const fallback = getFallbackPlanBySlug(slug);
    return fallback ? clone(fallback) : null;
  }

  try {
    const client = getSanityClient();
    const plan = await client.fetch<PlanDetail | null>(planBySlugQuery, { slug });
    if (!plan) {
      return null;
    }

    const [enriched] = await enrichPlansWithCatalogPricing([plan]);
    return enriched ?? plan;
  } catch (error) {
    console.error(`Failed to fetch plan '${slug}' from Sanity`, error);
    const fallback = getFallbackPlanBySlug(slug);
    return fallback ? clone(fallback) : null;
  }
}

export async function getPlanSlugs(): Promise<string[]> {
  if (!isSanityConfigured) {
    return fallbackPlanDetails.map((plan) => plan.slug);
  }

  try {
    const client = getSanityClient();
    const slugs = await client.fetch<{ slug: string }[]>(planSlugsQuery);
    return (slugs ?? []).map((entry) => entry.slug).filter(Boolean);
  } catch (error) {
    console.error("Failed to fetch plan slugs from Sanity", error);
    return fallbackPlanDetails.map((plan) => plan.slug);
  }
}

export async function getEsimProducts(): Promise<EsimProductSummary[]> {
  if (!isSanityConfigured) {
    return clone(fallbackEsimProductSummaries);
  }

  try {
    const products = await getCatalogProductSummaries();
    return products;
  } catch (error) {
    console.error("Failed to fetch eSIM products from Sanity", error);
    return clone(fallbackEsimProductSummaries);
  }
}

export async function getEsimProductBySlug(slug: string): Promise<EsimProductDetail | null> {
  if (!isSanityConfigured) {
    const fallback = getFallbackProductBySlug(slug);
    return fallback ? clone(fallback) : null;
  }

  try {
    const client = getSanityClient();
    const product = await client.fetch<EsimProductDetail | null>(esimProductBySlugQuery, { slug });
    return product ?? null;
  } catch (error) {
    console.error(`Failed to fetch eSIM product '${slug}' from Sanity`, error);
    const fallback = getFallbackProductBySlug(slug);
    return fallback ? clone(fallback) : null;
  }
}

export async function getEsimProductSlugs(): Promise<string[]> {
  if (!isSanityConfigured) {
    return fallbackEsimProductSummaries
      .map((product) => product.slugs?.product ?? product.slug)
      .filter((slug): slug is string => Boolean(slug));
  }

  try {
    const client = getSanityClient();
    const slugs = await client.fetch<{ slug: string }[]>(esimProductSlugsQuery);
    return (slugs ?? []).map((entry) => entry.slug).filter(Boolean);
  } catch (error) {
    console.error("Failed to fetch eSIM product slugs from Sanity", error);
    return fallbackEsimProductSummaries
      .map((product) => product.slugs?.product ?? product.slug)
      .filter((slug): slug is string => Boolean(slug));
  }
}

export async function getRegionBundles(): Promise<RegionBundle[]> {
  if (!isSanityConfigured) {
    return clone(fallbackRegionBundles);
  }

  try {
    const client = getSanityClient();
    const bundles = await client.fetch<RegionBundle[]>(regionBundlesQuery);
    return bundles ?? [];
  } catch (error) {
    console.error("Failed to fetch region bundles from Sanity", error);
    return clone(fallbackRegionBundles);
  }
}

export async function getBundleBySlug(slug: string): Promise<RegionBundle | null> {
  if (!isSanityConfigured) {
    const fallback = getFallbackBundleBySlug(slug);
    return fallback ? clone(fallback) : null;
  }

  try {
    const client = getSanityClient();
    const bundle = await client.fetch<RegionBundle | null>(bundleBySlugQuery, { slug });
    return bundle ?? null;
  } catch (error) {
    console.error(`Failed to fetch bundle '${slug}' from Sanity`, error);
    const fallback = getFallbackBundleBySlug(slug);
    return fallback ? clone(fallback) : null;
  }
}

export async function getPosts(): Promise<PostSummary[]> {
  if (!isSanityConfigured) {
    return clone(fallbackPostSummaries);
  }

  try {
    const client = getSanityClient();
    const posts = await client.fetch<PostSummary[]>(postsQuery);
    return posts ?? [];
  } catch (error) {
    console.error("Failed to fetch posts from Sanity", error);
    return clone(fallbackPostSummaries);
  }
}

export async function getPostBySlug(slug: string): Promise<PostDetail | null> {
  if (!isSanityConfigured) {
    const fallback = getFallbackPostBySlug(slug);
    return fallback ? clone(fallback) : null;
  }

  try {
    const client = getSanityClient();
    const post = await client.fetch<PostDetail | null>(postBySlugQuery, { slug });
    return post ?? null;
  } catch (error) {
    console.error(`Failed to fetch post '${slug}' from Sanity`, error);
    const fallback = getFallbackPostBySlug(slug);
    return fallback ? clone(fallback) : null;
  }
}
