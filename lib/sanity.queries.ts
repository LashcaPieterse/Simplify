import { groq } from "next-sanity";
import { getSanityClient } from "./sanity.client";
import type { ImageLike } from "./image";

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

export type CarrierSummary = {
  _id: string;
  title: string;
  slug: string;
  logo?: ImageLike;
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
  provider?: CarrierSummary;
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
    ${COUNTRY_REFERENCE_FIELDS}
  }
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
        stats[]{label, value}
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
  const client = getSanityClient();
  const settings = await client.fetch<SiteSettings | null>(siteSettingsQuery);
  return settings ?? null;
}

export async function getHomePage(): Promise<HomePagePayload | null> {
  const client = getSanityClient();
  const home = await client.fetch<HomePagePayload | null>(homePageQuery);
  return home ?? null;
}

export async function getCountriesList(): Promise<CountrySummary[]> {
  const client = getSanityClient();
  const results = await client.fetch<CountrySummary[]>(countriesQuery);
  return results ?? [];
}

export async function getCountryBySlug(slug: string): Promise<CountryDetail | null> {
  const client = getSanityClient();
  const country = await client.fetch<CountryDetail | null>(countryBySlugQuery, { slug });
  return country ?? null;
}

export async function getPlansForCountry(slug: string): Promise<PlanDetail[]> {
  const client = getSanityClient();
  const plans = await client.fetch<PlanDetail[]>(plansForCountryQuery, { slug });
  return plans ?? [];
}

export async function getPlanBySlug(slug: string): Promise<PlanDetail | null> {
  const client = getSanityClient();
  const plan = await client.fetch<PlanDetail | null>(planBySlugQuery, { slug });
  return plan ?? null;
}

export async function getPlanSlugs(): Promise<string[]> {
  const client = getSanityClient();
  const slugs = await client.fetch<{ slug: string }[]>(planSlugsQuery);
  return (slugs ?? []).map((entry) => entry.slug).filter(Boolean);
}

export async function getRegionBundles(): Promise<RegionBundle[]> {
  const client = getSanityClient();
  const bundles = await client.fetch<RegionBundle[]>(regionBundlesQuery);
  return bundles ?? [];
}

export async function getBundleBySlug(slug: string): Promise<RegionBundle | null> {
  const client = getSanityClient();
  const bundle = await client.fetch<RegionBundle | null>(bundleBySlugQuery, { slug });
  return bundle ?? null;
}

export async function getPosts(): Promise<PostSummary[]> {
  const client = getSanityClient();
  const posts = await client.fetch<PostSummary[]>(postsQuery);
  return posts ?? [];
}

export async function getPostBySlug(slug: string): Promise<PostDetail | null> {
  const client = getSanityClient();
  const post = await client.fetch<PostDetail | null>(postBySlugQuery, { slug });
  return post ?? null;
}
