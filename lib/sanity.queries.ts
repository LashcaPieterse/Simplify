import { groq } from "next-sanity";
import { getSanityClient } from "./sanity.client";
import { getCatalogProductSummaries } from "./catalog/query";

export { prisma } from "./db/client";
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
  badge?: string | null;
  summary?: string | null;
  coverImage?: ImageLike;
  plan?: PlanSummary;
  featured?: boolean;
  productCard?: EsimProductCardData;
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

// Sanity catalog document shapes (as fetched via GROQ)
type CatalogPackageDoc = {
  _id: string;
  externalId?: string;
  title?: string;
  slug?: { current?: string };
  priceCents?: number;
  sellingPriceCents?: number | null;
  currencyCode?: string;
  dataAmountMb?: number | null;
  validityDays?: number | null;
  isUnlimited?: boolean | null;
  badge?: string | null;
  summary?: string | null;
  shortInfo?: string | null;
  image?: ImageLike;
  operator?: {
    _id: string;
    title?: string;
    operatorCode?: string;
    badge?: string | null;
    summary?: string | null;
    image?: ImageLike;
  } | null;
};

type CatalogCountryDoc = {
  _id: string;
  title: string;
  slug: { current?: string };
  countryCode?: string;
  badge?: string | null;
  summary?: string | null;
  featured?: boolean | null;
  image?: ImageLike;
  primaryPackage?: CatalogPackageDoc | null;
  packages?: CatalogPackageDoc[];
};

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

export type CarrierSummary = {
  _id: string;
  title: string;
  slug: string;
  logo?: ImageLike;
};

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
  title?: string;
  currency: string;
  priceCents: number;
  isActive?: boolean;
  badge?: string | null;
  summary?: string | null;
  image?: ImageLike;
  dataLimitMb?: number | null;
  validityDays?: number | null;
  region?: string | null;
  lastSyncedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  operator?: {
    _id: string;
    title?: string;
    slug?: string;
    logo?: ImageLike;
    badge?: string | null;
  };
};

// Utility: pick a stable identifier from a catalog package reference.
export function getCatalogPackageId(pkg?: CatalogPackageInfo | null): string | undefined {
  if (!pkg || pkg.isActive === false) return undefined;
  return pkg.externalId || pkg.id;
}

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
  provider?: CarrierSummary;
  price?: MoneyValue | null;
  package?: CatalogPackageInfo | null;
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
  country?: CountrySummary;
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
  "operator": operator->{
    _id,
    title,
    operatorCode,
    badge,
    summary,
    image
  }
`;

const CATALOG_COUNTRY_FIELDS = `
  _id,
  title,
  countryCode,
  "slug": slug.current,
  badge,
  summary,
  featured,
  "coverImage": image,
  primaryPackage->{
    ${CATALOG_PACKAGE_FIELDS}
  }
`;

const REGION_BUNDLE_FIELDS = `
  _id,
  title,
  "slug": slug.current,
  countries[]->{
    ${CATALOG_COUNTRY_FIELDS}
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

const ESIM_PRODUCT_CARD_FIELDS = `
  _id,
  displayName,
  "slug": slug.current,
  priceUSD,
  "coverImage": coalesce(coverImage, country->image),
  shortDescription,
  providerBadge,
  status,
  keywords,
  package->{
    ${CATALOG_PACKAGE_FIELDS}
  },
  country->{
    ${CATALOG_COUNTRY_FIELDS}
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
          ${CATALOG_COUNTRY_FIELDS}
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
  *[_type == "catalogCountry"] | order(title asc) {
    ${CATALOG_COUNTRY_FIELDS}
  }
`;

const countryBySlugQuery = groq`
  *[_type == "catalogCountry" && slug.current == $slug][0]{
    ${CATALOG_COUNTRY_FIELDS},
    "packages": *[_type == "catalogPackage" && country._ref == ^._id] | order(priceCents asc) {
      ${CATALOG_PACKAGE_FIELDS}
    }
  }
`;

const plansForCountryQuery = groq`
  *[_type == "catalogPackage" && country->slug.current == $slug] | order(priceCents asc) {
    ${CATALOG_PACKAGE_FIELDS}
  }
`;

const planBySlugQuery = groq`
  *[_type == "catalogPackage" && externalId == $slug][0]{
    ${CATALOG_PACKAGE_FIELDS}
  }
`;

const planSlugsQuery = groq`
  *[_type == "catalogPackage" && defined(externalId)]{ "slug": externalId }
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

function mapCatalogPackageToPlan(pkg: CatalogPackageDoc): PlanSummary {
  return {
    _id: pkg._id,
    title: pkg.title ?? pkg.slug?.current ?? "Untitled package",
    slug: pkg.slug?.current ?? pkg._id,
    priceUSD: (pkg.priceCents ?? 0) / 100,
    dataGB: pkg.dataAmountMb ? Math.round(pkg.dataAmountMb / 102.4) / 10 : 0,
    validityDays: pkg.validityDays ?? 0,
    hotspot: undefined,
    fiveG: undefined,
    label: pkg.badge ?? undefined,
    shortBlurb: pkg.summary ?? pkg.shortInfo ?? "",
    provider: pkg.operator
      ? {
          _id: pkg.operator._id,
          title: pkg.operator.title ?? "",
          slug: pkg.operator.operatorCode ?? pkg.operator._id,
          logo: pkg.operator.image,
        }
      : undefined,
    price: pkg.priceCents
      ? {
          amount: pkg.priceCents / 100,
          currency: pkg.currencyCode ?? "USD",
          source: "airalo",
        }
      : null,
    package: {
      id: pkg._id,
      externalId: pkg.externalId ?? pkg._id,
      currency: pkg.currencyCode ?? "USD",
      priceCents: pkg.priceCents ?? 0,
      dataLimitMb: pkg.dataAmountMb ?? null,
      validityDays: pkg.validityDays ?? null,
      region: null,
      lastSyncedAt: null,
      metadata: null,
    },
  };
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  try {
    const client = getSanityClient();
    const settings = await client.fetch<SiteSettings | null>(siteSettingsQuery);
    return settings ?? null;
  } catch (error) {
    console.error("Failed to fetch site settings from Sanity", error);
    return null;
  }
}

export async function getHomePage(): Promise<HomePagePayload | null> {
  try {
    const client = getSanityClient();
    const home = await client.fetch<HomePagePayload | null>(homePageQuery);
    if (!home) return null;

    const countries = await getCountriesList();
    const sections = (home.sections ?? []).map((section) => {
      if (section?._type === "countryGridSection") {
        return { ...section, countries } as CountryGridSection;
      }
      return section;
    });

    return { ...home, sections };
  } catch (error) {
    console.error("Failed to fetch home page content from Sanity", error);
    return null;
  }
}

export async function getCountriesList(): Promise<CountrySummary[]> {
  try {
    const client = getSanityClient();
    const results = await client.fetch<CatalogCountryDoc[]>(countriesQuery);
    return (
      results
        // Ignore countries that do not have a slug to avoid generating invalid paths like "/country".
        ?.filter((country) => country.slug?.current)
        .map((country) => ({
          _id: country._id,
          title: country.title,
          slug: country.slug?.current ?? "",
          badge: country.badge ?? null,
          summary: country.summary ?? null,
          coverImage: country.image,
          featured: country.featured ?? false,
          plan: country.primaryPackage ? mapCatalogPackageToPlan(country.primaryPackage) : undefined,
        })) ?? []
    );
  } catch (error) {
    console.error("Failed to fetch countries from Sanity", error);
    return [];
  }
}

export async function getCountryBySlug(slug: string): Promise<CountryDetail | null> {
  try {
    const client = getSanityClient();
    const country = await client.fetch<CatalogCountryDoc | null>(countryBySlugQuery, { slug });
    if (!country) return null;

    const plans = (country.packages ?? []).map(mapCatalogPackageToPlan);
    return {
      _id: country._id,
      title: country.title,
      slug: country.slug?.current ?? "",
      badge: country.badge ?? null,
      summary: country.summary ?? null,
      coverImage: country.image,
      featured: country.featured ?? false,
      carriers: [],
      plans,
      productCard: undefined,
      plan: country.primaryPackage ? mapCatalogPackageToPlan(country.primaryPackage) : undefined,
    };
  } catch (error) {
    console.error(`Failed to fetch country '${slug}' from Sanity`, error);
    return null;
  }
}

export async function getPlansForCountry(slug: string): Promise<PlanDetail[]> {
  try {
    const client = getSanityClient();
    const packages = await client.fetch<CatalogPackageDoc[]>(plansForCountryQuery, { slug });
    return (packages ?? []).map((pkg) => mapCatalogPackageToPlan(pkg) as PlanDetail);
  } catch (error) {
    console.error(`Failed to fetch plans for country '${slug}' from Sanity`, error);
    return [];
  }
}

export async function getPlanBySlug(slug: string): Promise<PlanDetail | null> {
  try {
    const client = getSanityClient();
    const pkg = await client.fetch<CatalogPackageDoc | null>(planBySlugQuery, { slug });
    if (!pkg) return null;
    return mapCatalogPackageToPlan(pkg) as PlanDetail;
  } catch (error) {
    console.error(`Failed to fetch plan '${slug}' from Sanity`, error);
    return null;
  }
}

export async function getPlanSlugs(): Promise<string[]> {
  try {
    const client = getSanityClient();
    const slugs = await client.fetch<{ slug: string }[]>(planSlugsQuery);
    return (slugs ?? []).map((entry) => entry.slug).filter(Boolean);
  } catch (error) {
    console.error("Failed to fetch plan slugs from Sanity", error);
    return [];
  }
}

export async function getEsimProducts(): Promise<EsimProductSummary[]> {
  try {
    const products = await getCatalogProductSummaries();
    return products;
  } catch (error) {
    console.error("Failed to fetch eSIM products from Sanity", error);
    return [];
  }
}

export async function getEsimProductBySlug(slug: string): Promise<EsimProductDetail | null> {
  try {
    const client = getSanityClient();
    const product = await client.fetch<EsimProductDetail | null>(esimProductBySlugQuery, { slug });
    return product ?? null;
  } catch (error) {
    console.error(`Failed to fetch eSIM product '${slug}' from Sanity`, error);
    return null;
  }
}

export async function getEsimProductSlugs(): Promise<string[]> {
  try {
    const client = getSanityClient();
    const slugs = await client.fetch<{ slug: string }[]>(esimProductSlugsQuery);
    return (slugs ?? []).map((entry) => entry.slug).filter(Boolean);
  } catch (error) {
    console.error("Failed to fetch eSIM product slugs from Sanity", error);
    return [];
  }
}

export async function getRegionBundles(): Promise<RegionBundle[]> {
  try {
    const client = getSanityClient();
    const bundles = await client.fetch<RegionBundle[]>(regionBundlesQuery);
    return bundles ?? [];
  } catch (error) {
    console.error("Failed to fetch region bundles from Sanity", error);
    return [];
  }
}

export async function getBundleBySlug(slug: string): Promise<RegionBundle | null> {
  try {
    const client = getSanityClient();
    const bundle = await client.fetch<RegionBundle | null>(bundleBySlugQuery, { slug });
    return bundle ?? null;
  } catch (error) {
    console.error(`Failed to fetch bundle '${slug}' from Sanity`, error);
    return null;
  }
}

export async function getPosts(): Promise<PostSummary[]> {
  try {
    const client = getSanityClient();
    const posts = await client.fetch<PostSummary[]>(postsQuery);
    return posts ?? [];
  } catch (error) {
    console.error("Failed to fetch posts from Sanity", error);
    return [];
  }
}

export async function getPostBySlug(slug: string): Promise<PostDetail | null> {
  try {
    const client = getSanityClient();
    const post = await client.fetch<PostDetail | null>(postBySlugQuery, { slug });
    return post ?? null;
  } catch (error) {
    console.error(`Failed to fetch post '${slug}' from Sanity`, error);
    return null;
  }
}
