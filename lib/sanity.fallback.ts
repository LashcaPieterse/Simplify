import type {
  ArticlesSection,
  CarrierSummary,
  CountryDetail,
  CountryGridSection,
  CountrySummary,
  EsimProductDetail,
  EsimProductSummary,
  HeroSection,
  HomePagePayload,
  IconBullet,
  Link,
  LiveNetworkWidgetSection,
  LiveRegion,
  NewsletterSection,
  PlanDetail,
  PlanSummary,
  PostDetail,
  PostSummary,
  RegionalBundleSpotlightSection,
  RegionBundle,
  SiteSettings,
  Stat,
  StepsSection,
  StepItem,
  WhyChooseUsSection
} from "./sanity.queries";
import type { PortableTextBlock } from "./sanity.queries";

const createBlock = (text: string): PortableTextBlock => ({
  _type: "block",
  style: "normal",
  children: [
    {
      _type: "span",
      text
    }
  ],
  markDefs: []
});

const navigation: Link[] = [
  { label: "eSIM Store", url: "#store" },
  { label: "How it works", url: "#how" },
  { label: "Coverage", url: "#coverage" },
  { label: "Resources", url: "/resources" }
];

const footerLinks: Link[] = [
  { label: "Privacy", url: "https://simplify.africa/privacy" },
  { label: "Terms", url: "https://simplify.africa/terms" },
  { label: "Support", url: "mailto:support@simplify.africa" }
];

export const fallbackSiteSettings: SiteSettings = {
  title: "Simplify",
  tagline: "#1 eSIM marketplace in Africa 2024",
  contactEmail: "hello@simplify.africa",
  logo: { url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee" },
  navigation,
  footerLinks
};

const carriers: CarrierSummary[] = [
  {
    _id: "carrier-tn-mobile",
    title: "TN Mobile",
    slug: "tn-mobile",
    logo: { url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee" }
  },
  {
    _id: "carrier-vodaconnect",
    title: "VodaConnect",
    slug: "vodaconnect",
    logo: { url: "https://images.unsplash.com/photo-1526481280695-3c469928b67b" }
  },
  {
    _id: "carrier-safarinet",
    title: "SafariNet",
    slug: "safarinet",
    logo: { url: "https://images.unsplash.com/photo-1500534623283-312aade485b7" }
  }
];

const carrierBySlug = Object.fromEntries(carriers.map((carrier) => [carrier.slug, carrier]));

const countrySummaries: Record<string, CountrySummary> = {
  namibia: {
    _id: "country-namibia",
    title: "Namibia",
    slug: "namibia",
    badge: "Popular",
    summary: "Perfect signal strength across Etosha, Sossusvlei, and Windhoek with zero roaming fees.",
    coverImage: { url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee" },
    featured: true
  },
  "south-africa": {
    _id: "country-south-africa",
    title: "South Africa",
    slug: "south-africa",
    badge: "Best value",
    summary: "Covering the Garden Route, Cape Town, and Kruger with seamless 5G handoffs.",
    coverImage: { url: "https://images.unsplash.com/photo-1526481280695-3c469928b67b" },
    featured: true
  },
  kenya: {
    _id: "country-kenya",
    title: "Kenya",
    slug: "kenya",
    badge: "New",
    summary: "Stay connected from Nairobi to the Mara with unlimited messaging add-ons.",
    coverImage: { url: "https://images.unsplash.com/photo-1500534623283-312aade485b7" },
    featured: true
  },
  botswana: {
    _id: "country-botswana",
    title: "Botswana",
    slug: "botswana",
    summary: "Reliable coverage across the Okavango Delta and Gaborone business district.",
    coverImage: { url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b" },
    featured: false
  },
  zambia: {
    _id: "country-zambia",
    title: "Zambia",
    slug: "zambia",
    summary: "High-speed connectivity from Victoria Falls to Lusaka with seamless roaming.",
    coverImage: { url: "https://images.unsplash.com/photo-1526498460520-4c246339dccb" },
    featured: false
  }
};

const planDetailsBase: PlanDetail[] = [
  {
    _id: "plan-nama",
    title: "Nama",
    slug: "nama",
    priceUSD: 18,
    dataGB: 15,
    validityDays: 14,
    hotspot: true,
    fiveG: false,
    label: "Popular",
    shortBlurb: "Perfect for safari adventurers with 15GB high-speed data.",
    features: ["Instant QR activation", "Usage alerts in the app"],
    whatsIncluded: [
      "15GB of high-speed data",
      "Unlimited messaging apps",
      "24/7 Simplify concierge"
    ],
    installSteps: [
      createBlock("Scan the QR code from your Simplify dashboard."),
      createBlock("Label the eSIM 'Simplify Nama' for easy switching."),
      createBlock("Turn on data roaming once you land in Namibia.")
    ],
    terms: [createBlock("Valid for 14 days from first network connection.")],
    provider: carrierBySlug["tn-mobile"],
    country: countrySummaries.namibia
  },
  {
    _id: "plan-cape-explorer",
    title: "Cape Explorer",
    slug: "cape-explorer",
    priceUSD: 24,
    dataGB: 20,
    validityDays: 21,
    hotspot: true,
    fiveG: true,
    label: "Best value",
    shortBlurb: "Ideal for road trips with 20GB data and hotspot support.",
    features: ["5G in Cape Town & Johannesburg", "Free lounge Wi-Fi vouchers"],
    whatsIncluded: [
      "20GB of shared data",
      "Unlimited WhatsApp calls",
      "Priority support in-app"
    ],
    installSteps: [
      createBlock("Add the eSIM via Settings → Cellular → Add eSIM."),
      createBlock("Select Cape Explorer as the default line for data.")
    ],
    terms: [createBlock("Includes 5G where available. Falls back to LTE elsewhere.")],
    provider: carrierBySlug["vodaconnect"],
    country: countrySummaries["south-africa"]
  },
  {
    _id: "plan-maasai",
    title: "Maasai",
    slug: "maasai",
    priceUSD: 16,
    dataGB: 10,
    validityDays: 21,
    hotspot: false,
    fiveG: false,
    label: "New",
    shortBlurb: "Free WhatsApp calls and daily safari weather alerts.",
    features: ["Unlimited messaging", "Daily safari weather briefings"],
    whatsIncluded: [
      "10GB of high-speed data",
      "In-app top-up",
      "Live chat support"
    ],
    installSteps: [createBlock("Open Simplify → My eSIMs → Activate Maasai plan.")],
    terms: [createBlock("Activation required within 30 days of purchase.")],
    provider: carrierBySlug["safarinet"],
    country: countrySummaries.kenya
  }
];

const toPlanSummary = (plan: PlanDetail): PlanSummary => ({
  _id: plan._id,
  title: plan.title,
  slug: plan.slug,
  priceUSD: plan.priceUSD,
  dataGB: plan.dataGB,
  validityDays: plan.validityDays,
  hotspot: plan.hotspot,
  fiveG: plan.fiveG,
  label: plan.label,
  shortBlurb: plan.shortBlurb,
  provider: plan.provider
});

const planSummaries = planDetailsBase.map(toPlanSummary);
const planSummaryBySlug = Object.fromEntries(planSummaries.map((plan) => [plan.slug, plan]));

const planCountrySlugById = new Map(planDetailsBase.map((detail) => [detail._id, detail.country?.slug ?? ""]));
const countryPlansMap = new Map<string, PlanSummary[]>();
for (const plan of planSummaries) {
  const slug = planCountrySlugById.get(plan._id);
  if (!slug) {
    continue;
  }

  const current = countryPlansMap.get(slug) ?? [];
  current.push(plan);
  countryPlansMap.set(slug, current);
}

countrySummaries.namibia.plan = planSummaryBySlug["nama"];
countrySummaries["south-africa"].plan = planSummaryBySlug["cape-explorer"];
countrySummaries.kenya.plan = planSummaryBySlug["maasai"];

const carriersByCountry: Record<string, CarrierSummary[]> = {
  namibia: [carrierBySlug["tn-mobile"]],
  "south-africa": [carrierBySlug["vodaconnect"]],
  kenya: [carrierBySlug["safarinet"]],
  botswana: [],
  zambia: []
};

export const fallbackCountrySummaries: CountrySummary[] = Object.values(countrySummaries);

export const fallbackCountryDetails: CountryDetail[] = fallbackCountrySummaries.map((country) => ({
  ...country,
  carriers: carriersByCountry[country.slug] ?? [],
  plans: countryPlansMap.get(country.slug) ?? []
}));

const planDetailsBySlug = Object.fromEntries(planDetailsBase.map((plan) => [plan.slug, plan]));

export const fallbackPlanDetails: PlanDetail[] = planDetailsBase;

export const fallbackEsimProducts: EsimProductDetail[] = [
  {
    _id: "product-namibia-explorer",
    displayName: "Namibia Explorer eSIM",
    slug: "namibia-explorer-esim",
    priceUSD: 18,
    coverImage: { url: "https://images.unsplash.com/photo-1523419409543-0c1df022bdd1" },
    shortDescription: "Instant QR activation with top-tier coverage across Etosha and Windhoek.",
    longDescription: [
      createBlock("Designed for travellers who want reliable LTE while tracking wildlife in Etosha and Sossusvlei."),
      createBlock("Includes concierge support for reactivation and hotspot troubleshooting on the road."),
      createBlock("Pairs perfectly with the Nama data plan from TN Mobile for continuous roaming-free service.")
    ],
    plan: planSummaryBySlug["nama"],
    country: countrySummaries.namibia,
    providerBadge: "TN Mobile partner",
    status: "active",
    keywords: ["namibia", "safari", "tn mobile", "lte"]
  },
  {
    _id: "product-cape-digital-nomad",
    displayName: "Cape Town Digital Nomad eSIM",
    slug: "cape-town-digital-nomad-esim",
    priceUSD: 26,
    coverImage: { url: "https://images.unsplash.com/photo-1544986581-efac024faf62" },
    shortDescription: "5G-ready data with lounge Wi-Fi vouchers for city hopping between Cape Town and Joburg.",
    longDescription: [
      createBlock("Optimised for hybrid workers splitting time between the Cape and Gauteng, with 5G in supported metros."),
      createBlock("Comes bundled with airport lounge Wi-Fi passes and priority chat support during business hours."),
      createBlock("Backed by the Cape Explorer plan to keep you online during multi-week stays.")
    ],
    plan: planSummaryBySlug["cape-explorer"],
    country: countrySummaries["south-africa"],
    providerBadge: "VodaConnect 5G",
    status: "active",
    keywords: ["south africa", "digital nomad", "5g", "vodaconnect"]
  },
  {
    _id: "product-maasai-safari-pro",
    displayName: "Maasai Safari Pro eSIM",
    slug: "maasai-safari-pro-esim",
    priceUSD: 19,
    coverImage: { url: "https://images.unsplash.com/photo-1523800503107-5bc3ba2a6f81" },
    shortDescription: "Unlimited messaging and weather alerts tailored to the Maasai Mara migration season.",
    longDescription: [
      createBlock("Focus on the Great Migration with daily weather notifications and roaming protection across conservancies."),
      createBlock("Ideal for group trips needing coordinated check-ins and local guide communications."),
      createBlock("Built on the Maasai plan from SafariNet with simplified top-ups for extended stays.")
    ],
    plan: planSummaryBySlug["maasai"],
    country: countrySummaries.kenya,
    providerBadge: "SafariNet verified",
    status: "comingSoon",
    keywords: ["kenya", "maasai", "messaging", "safari"]
  }
];

const toEsimProductSummary = (product: EsimProductDetail): EsimProductSummary => ({
  _id: product._id,
  displayName: product.displayName,
  slug: product.slug,
  priceUSD: product.priceUSD,
  coverImage: product.coverImage,
  shortDescription: product.shortDescription,
  providerBadge: product.providerBadge,
  status: product.status,
  plan: product.plan,
  country: product.country,
  keywords: product.keywords
});

export const fallbackEsimProductSummaries: EsimProductSummary[] = fallbackEsimProducts.map(toEsimProductSummary);

const fallbackBundleCountries = [
  countrySummaries["south-africa"],
  countrySummaries.namibia,
  countrySummaries.botswana,
  countrySummaries.zambia
];

export const fallbackRegionBundles: RegionBundle[] = [
  {
    _id: "bundle-southern-explorer",
    title: "Southern Explorer",
    slug: "southern-explorer",
    countries: fallbackBundleCountries,
    sharedDataGB: 40,
    includes: ["Regional 5G where available", "Wi-Fi calling", "24/7 live chat"],
    fiveG: true,
    support: "Concierge support",
    perks: ["5G where available", "24/7 live chat", "In-app travel alerts"],
    heroImage: { url: "https://images.unsplash.com/photo-1526481280695-3c469928b67b" },
    ctaLabel: "Get this bundle",
    ctaTarget: "/bundle/southern-explorer"
  }
];

const postsBase: PostDetail[] = [
  {
    _id: "post-latest-coverage",
    title: "2024 coverage guide: Southern Africa",
    slug: "2024-coverage-guide-southern-africa",
    excerpt: "Compare carrier speeds and availability before you depart for Southern Africa.",
    coverImage: { url: "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1" },
    readingMinutes: 6,
    tags: ["Coverage", "Africa"],
    publishedAt: "2024-06-01T00:00:00.000Z",
    body: [createBlock("Southern Africa now offers the strongest eSIM coverage we've tracked.")]
  },
  {
    _id: "post-esim-checklist",
    title: "Pre-flight eSIM checklist",
    slug: "pre-flight-esim-checklist",
    excerpt: "Ensure your device and plan are ready before you leave home.",
    coverImage: { url: "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1" },
    readingMinutes: 4,
    tags: ["Tips"],
    publishedAt: "2024-05-20T00:00:00.000Z",
    body: [createBlock("Run this quick checklist the night before departure.")]
  }
];

const postSummaries = postsBase.map<PostSummary>((post) => ({
  _id: post._id,
  title: post.title,
  slug: post.slug,
  excerpt: post.excerpt,
  coverImage: post.coverImage,
  readingMinutes: post.readingMinutes,
  tags: post.tags,
  publishedAt: post.publishedAt
}));

export const fallbackPostSummaries: PostSummary[] = postSummaries;
export const fallbackPostDetails: PostDetail[] = postsBase;

const heroStats: Stat[] = [
  { label: "Trips connected", value: "1.5M+" },
  { label: "Satisfaction score", value: "98%" },
  { label: "Average activation", value: "<3 mins" }
];

const heroFeaturedProducts = fallbackEsimProductSummaries.slice(0, 3);
const heroFeaturedProductIds = heroFeaturedProducts.map((product) => product._id);

const heroSection: HeroSection = {
  _type: "heroSection",
  headline: "Instant eSIMs for every leg of your journey.",
  subhead:
    "Discover curated local, regional, and global plans, install in minutes, and stay connected from touchdown to takeoff.",
  ctas: [
    { label: "Browse plans", url: "#store" },
    { label: "Check compatibility", url: "https://simplify.africa/compatibility" }
  ],
  stats: heroStats,
  featuredProductIds: heroFeaturedProductIds,
  featuredProducts: heroFeaturedProducts
};

const countrySection: CountryGridSection = {
  _type: "countryGridSection",
  title: "Curated plans for your next stop",
  countries: [
    countrySummaries.namibia,
    countrySummaries["south-africa"],
    countrySummaries.kenya
  ]
};

const whyBullets: IconBullet[] = [
  {
    iconName: "globe",
    title: "190+ countries",
    body: "Local and regional plans curated for seamless roaming-free travel."
  },
  {
    iconName: "shield",
    title: "Trusted partners",
    body: "Tier-one carriers with transparent pricing and round-the-clock support."
  },
  {
    iconName: "zap",
    title: "Instant activation",
    body: "Install your QR in minutes and get connected before you depart."
  }
];

const whySection: WhyChooseUsSection = {
  _type: "whyChooseUsSection",
  title: "Built for constant movement",
  bullets: whyBullets
};

const stepItems: StepItem[] = [
  {
    stepNo: 1,
    title: "Choose destination plan",
    body: "Filter by travel dates, network speed, and perks tailored to your itinerary."
  },
  {
    stepNo: 2,
    title: "Install QR or manual setup",
    body: "Detailed instructions for iOS, Android, and wearables keep setup stress-free."
  },
  {
    stepNo: 3,
    title: "Enjoy secure global coverage",
    body: "Monitor usage, top up in seconds, and switch plans without touching a SIM tray."
  }
];

const stepsSection: StepsSection = {
  _type: "stepsSection",
  title: "Activate in three guided steps",
  steps: stepItems
};

const bundleSection: RegionalBundleSpotlightSection = {
  _type: "regionalBundleSpotlightSection",
  title: "Regional bundles for your next escape",
  bundle: fallbackRegionBundles[0]
};

const liveRegions: LiveRegion[] = [
  { name: "Namibia", latencyMs: 32, signalQuality: "Strong" },
  { name: "Botswana", latencyMs: 28, signalQuality: "Excellent" },
  { name: "Zambia", latencyMs: 41, signalQuality: "Strong" }
];

const liveSection: LiveNetworkWidgetSection = {
  _type: "liveNetworkWidgetSection",
  title: "Live network quality",
  regions: liveRegions
};

const newsletterSection: NewsletterSection = {
  _type: "newsletterSection",
  title: "Travel smarter with the Simplify briefing",
  body: "Monthly guides to new destinations, carrier launches, lounge perks, and real traveller tips.",
  ctaLabel: "Subscribe",
  ctaTarget: "https://simplify.africa/newsletter"
};

const articlesSection: ArticlesSection = {
  _type: "articlesSection",
  title: "Fresh from the resources hub",
  posts: postSummaries
};

export const fallbackHomePage: HomePagePayload = {
  title: "Home",
  sections: [
    heroSection,
    countrySection,
    whySection,
    stepsSection,
    bundleSection,
    liveSection,
    newsletterSection,
    articlesSection
  ]
};

export const getFallbackCountryPlans = (slug: string): PlanDetail[] => {
  switch (slug) {
    case "namibia":
      return [planDetailsBySlug["nama"]];
    case "south-africa":
      return [planDetailsBySlug["cape-explorer"]];
    case "kenya":
      return [planDetailsBySlug["maasai"]];
    default:
      return [];
  }
};

export const getFallbackPlanBySlug = (slug: string): PlanDetail | undefined => planDetailsBySlug[slug];

export const getFallbackBundleBySlug = (slug: string): RegionBundle | undefined =>
  fallbackRegionBundles.find((bundle) => bundle.slug === slug);

export const getFallbackPostBySlug = (slug: string): PostDetail | undefined =>
  postsBase.find((post) => post.slug === slug);

export const getFallbackProductBySlug = (slug: string): EsimProductDetail | undefined =>
  fallbackEsimProducts.find((product) => product.slug === slug);
