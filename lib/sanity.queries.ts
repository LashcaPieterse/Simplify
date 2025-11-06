import { groq } from "groq";
import type { PortableTextBlock, Image as SanityImage } from "sanity";
import { sanityClient } from "./sanity.client";

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

export type CountrySummary = {
  _id: string;
  title: string;
  slug: string;
  badge?: string;
  summary: string;
  coverImage?: SanityImage;
  plan?: PlanSummary;
};

export type CarrierSummary = {
  _id: string;
  title: string;
  slug: string;
  logo?: SanityImage;
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
  heroImage?: SanityImage;
  ctaLabel?: string;
  ctaTarget?: string;
};

export type PostSummary = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage?: SanityImage;
  readingMinutes: number;
  tags?: string[];
  publishedAt: string;
};

export type CountryDetail = CountrySummary & {
  featured?: boolean;
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
  logo?: SanityImage;
  contactEmail: string;
  navigation: Link[];
  footerLinks?: Link[];
};

export type HomePagePayload = {
  title: string;
  sections: HomeSection[];
};

export const SITE_SETTINGS_QUERY = groq`*[_type == "siteSettings"][0]{
  title,
  tagline,
  logo,
  contactEmail,
  navigation[]{label, url},
  footerLinks[]{label, url}
}`;

export const HOME_PAGE_QUERY = groq`*[_type == "homePage"][0]{
  title,
  sections[]{
    ...,
    _type == "heroSection" => {
      _type,
      headline,
      subhead,
      ctas[]{label, url},
      stats[]{label, value}
    },
    _type == "countryGridSection" => {
      _type,
      title,
      countries[]->{
        _id,
        title,
        "slug": slug.current,
        badge,
        summary,
        coverImage,
        "plan": plans[0]->{
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
            _id,
            title,
            "slug": slug.current
          }
        }
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
        _id,
        title,
        "slug": slug.current,
        countries[]->{_id, title, "slug": slug.current, coverImage},
        sharedDataGB,
        includes,
        fiveG,
        support,
        perks,
        heroImage,
        ctaLabel,
        ctaTarget
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
      ctaTarget
    },
    _type == "articlesSection" => {
      _type,
      title,
      posts[]->{
        _id,
        title,
        "slug": slug.current,
        excerpt,
        coverImage,
        readingMinutes,
        tags,
        publishedAt
      }
    }
  }
}`;

export const COUNTRIES_LIST_QUERY = groq`*[_type == "country"]|order(title asc){
  _id,
  title,
  "slug": slug.current,
  badge,
  summary,
  coverImage,
  featured
}`;

export const COUNTRY_BY_SLUG_QUERY = groq`*[_type == "country" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  badge,
  summary,
  coverImage,
  featured,
  carriers[]->{
    _id,
    title,
    "slug": slug.current,
    logo
  },
  plans[]->{
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
      _id,
      title,
      "slug": slug.current,
      logo
    }
  }
}`;

export const PLANS_FOR_COUNTRY_QUERY = groq`*[_type == "plan" && country->slug.current == $slug]{
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
  whatsIncluded,
  installSteps,
  terms,
  features,
  provider->{
    _id,
    title,
    "slug": slug.current,
    logo
  },
  country->{
    _id,
    title,
    "slug": slug.current
  }
}`;

export const PLAN_BY_SLUG_QUERY = groq`*[_type == "plan" && slug.current == $slug][0]{
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
  features,
  whatsIncluded,
  installSteps,
  terms,
  provider->{
    _id,
    title,
    "slug": slug.current,
    logo
  },
  country->{
    _id,
    title,
    "slug": slug.current
  }
}`;

export const REGION_BUNDLES_QUERY = groq`*[_type == "regionBundle"]|order(title asc){
  _id,
  title,
  "slug": slug.current,
  countries[]->{_id, title, "slug": slug.current},
  sharedDataGB,
  includes,
  fiveG,
  support,
  perks,
  heroImage,
  ctaLabel,
  ctaTarget
}`;

export const BUNDLE_BY_SLUG_QUERY = groq`*[_type == "regionBundle" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  countries[]->{_id, title, "slug": slug.current, coverImage},
  sharedDataGB,
  includes,
  fiveG,
  support,
  perks,
  heroImage,
  ctaLabel,
  ctaTarget
}`;

export const POSTS_QUERY = groq`*[_type == "post"]|order(publishedAt desc){
  _id,
  title,
  "slug": slug.current,
  excerpt,
  coverImage,
  readingMinutes,
  tags,
  publishedAt
}`;

export const POST_BY_SLUG_QUERY = groq`*[_type == "post" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  excerpt,
  coverImage,
  readingMinutes,
  tags,
  publishedAt,
  body
}`;

export async function getSiteSettings() {
  return sanityClient.fetch<SiteSettings | null>(SITE_SETTINGS_QUERY);
}

export async function getHomePage() {
  return sanityClient.fetch<HomePagePayload | null>(HOME_PAGE_QUERY);
}

export async function getCountriesList() {
  return sanityClient.fetch<(CountrySummary & { featured?: boolean })[]>(COUNTRIES_LIST_QUERY);
}

export async function getCountryBySlug(slug: string) {
  return sanityClient.fetch<CountryDetail | null>(COUNTRY_BY_SLUG_QUERY, { slug });
}

export async function getPlansForCountry(slug: string) {
  return sanityClient.fetch<PlanDetail[]>(PLANS_FOR_COUNTRY_QUERY, { slug });
}

export async function getPlanBySlug(slug: string) {
  return sanityClient.fetch<PlanDetail | null>(PLAN_BY_SLUG_QUERY, { slug });
}

export async function getRegionBundles() {
  return sanityClient.fetch<RegionBundle[]>(REGION_BUNDLES_QUERY);
}

export async function getBundleBySlug(slug: string) {
  return sanityClient.fetch<RegionBundle | null>(BUNDLE_BY_SLUG_QUERY, { slug });
}

export async function getPosts() {
  return sanityClient.fetch<PostSummary[]>(POSTS_QUERY);
}

export async function getPostBySlug(slug: string) {
  return sanityClient.fetch<PostDetail | null>(POST_BY_SLUG_QUERY, { slug });
}
