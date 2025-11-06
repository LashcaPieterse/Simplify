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
  logo?: ImageLike;
  contactEmail: string;
  navigation: Link[];
  footerLinks?: Link[];
};

export type HomePagePayload = {
  title: string;
  sections: HomeSection[];
};

const image = (url: string): ImageLike => ({
  _type: "image",
  asset: { url }
});

const carriers: CarrierSummary[] = [
  {
    _id: "carrier-tn-mobile",
    title: "TN Mobile",
    slug: "tn-mobile",
    logo: image("/illustrations/namibia-card.svg")
  },
  {
    _id: "carrier-vodaconnect",
    title: "VodaConnect",
    slug: "vodaconnect",
    logo: image("/illustrations/south-africa-card.svg")
  },
  {
    _id: "carrier-safarinet",
    title: "SafariNet",
    slug: "safarinet",
    logo: image("/illustrations/kenya-card.svg")
  }
];

const countries: CountryDetail[] = [
  {
    _id: "country-namibia",
    title: "Namibia",
    slug: "namibia",
    badge: "Popular",
    summary: "Perfect signal strength across Etosha, Sossusvlei, and Windhoek with zero roaming fees.",
    coverImage: image("/illustrations/namibia-card.svg"),
    featured: true,
    carriers: [carriers[0]],
    plans: []
  },
  {
    _id: "country-south-africa",
    title: "South Africa",
    slug: "south-africa",
    badge: "Best value",
    summary: "Covering the Garden Route, Cape Town, and Kruger with seamless 5G handoffs.",
    coverImage: image("/illustrations/south-africa-card.svg"),
    featured: true,
    carriers: [carriers[1]],
    plans: []
  },
  {
    _id: "country-kenya",
    title: "Kenya",
    slug: "kenya",
    badge: "New",
    summary: "Stay connected from Nairobi to the Mara with unlimited messaging add-ons.",
    coverImage: image("/illustrations/kenya-card.svg"),
    featured: true,
    carriers: [carriers[2]],
    plans: []
  },
  {
    _id: "country-botswana",
    title: "Botswana",
    slug: "botswana",
    summary: "Reliable coverage across the Okavango Delta and Gaborone business district.",
    coverImage: image("/illustrations/namibia-card.svg"),
    carriers: [],
    plans: []
  },
  {
    _id: "country-zambia",
    title: "Zambia",
    slug: "zambia",
    summary: "High-speed connectivity from Victoria Falls to Lusaka with seamless roaming.",
    coverImage: image("/illustrations/south-africa-card.svg"),
    carriers: [],
    plans: []
  }
];

const countryBySlug = Object.fromEntries(countries.map((country) => [country.slug, country]));

type PlanSeed = Omit<PlanDetail, "country"> & { countrySlug: string };

const planSeeds: PlanSeed[] = [
  {
    _id: "plan-nama",
    title: "Nama Explorer",
    slug: "nama-explorer",
    priceUSD: 18,
    dataGB: 15,
    validityDays: 14,
    hotspot: true,
    fiveG: false,
    label: "Popular",
    shortBlurb: "Perfect for safari adventurers with 15GB of high-speed data.",
    features: ["Instant QR activation", "Usage alerts in the app"],
    whatsIncluded: [
      "15GB of high-speed data",
      "Unlimited messaging apps",
      "24/7 Simplify concierge"
    ],
    installSteps: [
      {
        _type: "block",
        style: "normal",
        children: [{ _type: "span", text: "Scan the QR code from your Simplify dashboard." }]
      },
      {
        _type: "block",
        style: "normal",
        children: [{ _type: "span", text: "Label the eSIM 'Simplify Nama' for easy switching." }]
      },
      {
        _type: "block",
        style: "normal",
        children: [{ _type: "span", text: "Turn on data roaming once you land in Namibia." }]
      }
    ],
    terms: [
      {
        _type: "block",
        style: "normal",
        children: [{ _type: "span", text: "Valid for 14 days from first network connection." }]
      }
    ],
    provider: carriers[0],
    countrySlug: "namibia"
  },
  {
    _id: "plan-cape-explorer",
    title: "Cape Explorer",
    slug: "cape-explorer",
    priceUSD: 22,
    dataGB: 25,
    validityDays: 21,
    hotspot: true,
    fiveG: true,
    label: "Roam free",
    shortBlurb: "Seamless 5G across Cape Town, Johannesburg, and the Garden Route.",
    features: ["5G where available", "Wi-Fi calling"],
    whatsIncluded: [
      "25GB of high-speed data",
      "Unlimited messaging apps",
      "Simplify lounge support"
    ],
    installSteps: [
      {
        _type: "block",
        style: "normal",
        children: [{ _type: "span", text: "Activate through the Simplify app before departure." }]
      },
      {
        _type: "block",
        style: "normal",
        children: [{ _type: "span", text: "Toggle roaming on once you arrive in South Africa." }]
      }
    ],
    terms: [
      {
        _type: "block",
        style: "normal",
        children: [{ _type: "span", text: "Hotspot usage counts toward total data." }]
      }
    ],
    provider: carriers[1],
    countrySlug: "south-africa"
  },
  {
    _id: "plan-maasai",
    title: "Maasai Voyager",
    slug: "maasai-voyager",
    priceUSD: 20,
    dataGB: 20,
    validityDays: 21,
    hotspot: true,
    fiveG: false,
    shortBlurb: "Unlimited messaging add-on with generous roaming in the Mara.",
    features: ["Unlimited WhatsApp", "Pause and resume data"],
    whatsIncluded: [
      "20GB of high-speed data",
      "Unlimited messaging apps",
      "Priority support"
    ],
    installSteps: [
      {
        _type: "block",
        style: "normal",
        children: [{ _type: "span", text: "Add the plan from the Simplify mobile app." }]
      },
      {
        _type: "block",
        style: "normal",
        children: [{ _type: "span", text: "Restart your device after installation completes." }]
      }
    ],
    terms: [
      {
        _type: "block",
        style: "normal",
        children: [{ _type: "span", text: "Speeds may reduce after 20GB in peak hours." }]
      }
    ],
    provider: carriers[2],
    countrySlug: "kenya"
  }
];

const planDetails: PlanDetail[] = planSeeds.map(({ countrySlug, ...plan }) => {
  const detail: PlanDetail = { ...plan, country: undefined };
  const country = countryBySlug[countrySlug];
  if (country) {
    detail.country = {
      _id: country._id,
      title: country.title,
      slug: country.slug,
      badge: country.badge,
      summary: country.summary,
      coverImage: country.coverImage
    };
    const summary = toPlanSummary(detail);
    country.plans = [...(country.plans ?? []), summary];
    if (!country.plan) {
      country.plan = summary;
    }
  }
  return detail;
});

const regionBundles: RegionBundle[] = [
  {
    _id: "bundle-southern-africa",
    title: "Southern Africa Explorer",
    slug: "southern-africa-explorer",
    countries: ["namibia", "south-africa", "botswana", "zambia"].map((slug) => toCountrySummary(countryBySlug[slug])),
    sharedDataGB: 40,
    includes: ["Shared data pool", "Unified travel support", "Complimentary lounge passes"],
    fiveG: true,
    support: "24/7 concierge",
    perks: ["Pause data anytime", "Top destinations curated in-app"],
    heroImage: image("/illustrations/south-africa-card.svg"),
    ctaLabel: "Get the explorer bundle",
    ctaTarget: "/plan/cape-explorer"
  }
];

const posts: PostDetail[] = [
  {
    _id: "post-namibia-checklist",
    title: "Namibia safari connectivity checklist",
    slug: "namibia-safari-connectivity",
    excerpt: "Everything you need to stay online across Etosha, Swakopmund, and the Skeleton Coast.",
    coverImage: image("/illustrations/namibia-card.svg"),
    readingMinutes: 6,
    tags: ["namibia", "itinerary"],
    publishedAt: "2024-05-12",
    body: [
      {
        _type: "block",
        style: "normal",
        children: [
          {
            _type: "span",
            text: "Carry an unlocked device, download offline maps, and enable Simplify alerts before landing."
          }
        ]
      }
    ]
  },
  {
    _id: "post-cape-town-guide",
    title: "Cape Town digital nomad starter pack",
    slug: "cape-town-digital-nomad",
    excerpt: "Coworking spaces, coffee shop Wi-Fi, and the best time to activate your Simplify plan.",
    coverImage: image("/illustrations/south-africa-card.svg"),
    readingMinutes: 5,
    tags: ["south africa", "remote work"],
    publishedAt: "2024-04-08",
    body: [
      {
        _type: "block",
        style: "normal",
        children: [
          {
            _type: "span",
            text: "Start your day at Oranjezicht Market with 5G coverage and finish with sunset emails in Camps Bay."
          }
        ]
      }
    ]
  },
  {
    _id: "post-kenya-hotspot",
    title: "Kenya hotspot hacks for photographers",
    slug: "kenya-hotspot-hacks",
    excerpt: "Tips for backing up RAW files from the Mara without draining your Simplify allowance.",
    coverImage: image("/illustrations/kenya-card.svg"),
    readingMinutes: 7,
    tags: ["kenya", "photography"],
    publishedAt: "2024-03-19",
    body: [
      {
        _type: "block",
        style: "normal",
        children: [
          {
            _type: "span",
            text: "Schedule uploads overnight and toggle hotspot sharing in the Simplify app to conserve bandwidth."
          }
        ]
      }
    ]
  }
];

const siteSettings: SiteSettings = {
  title: "Simplify",
  tagline: "#1 eSIM marketplace in Africa 2024",
  contactEmail: "hello@simplify.africa",
  logo: image("/illustrations/namibia-card.svg"),
  navigation: [
    { label: "eSIM Store", url: "#store" },
    { label: "How it works", url: "#how" },
    { label: "Coverage", url: "#coverage" },
    { label: "Resources", url: "/resources" }
  ],
  footerLinks: [
    { label: "Privacy", url: "https://simplify.africa/privacy" },
    { label: "Terms", url: "https://simplify.africa/terms" },
    { label: "Support", url: "mailto:support@simplify.africa" }
  ]
};

const homePage: HomePagePayload = {
  title: "Simplify home",
  sections: [
    {
      _type: "heroSection",
      headline: "Instant eSIMs across Africa",
      subhead: "Choose a destination, activate in minutes, and roam with confidence across the Simplify network.",
      ctas: [
        { label: "Browse plans", url: "#store" },
        { label: "Talk to an expert", url: "mailto:concierge@simplify.africa" }
      ],
      stats: [
        { label: "Destinations online", value: "40+" },
        { label: "Avg. setup time", value: "3 mins" },
        { label: "Traveller rating", value: "4.9/5" }
      ]
    },
    {
      _type: "countryGridSection",
      title: "Handpicked for your next adventure",
      countries: countries.map((country) => toCountrySummary(country))
    },
    {
      _type: "whyChooseUsSection",
      title: "Why travellers choose Simplify",
      bullets: [
        {
          iconName: "shield",
          title: "Trusted connectivity",
          body: "Partnerships with tier-one carriers across 40+ destinations."
        },
        {
          iconName: "bolt",
          title: "Instant activation",
          body: "QR codes delivered instantly with guided setup in the app."
        },
        {
          iconName: "globe",
          title: "Roam like a local",
          body: "Regional bundles that keep you online across borders without surprise fees."
        }
      ]
    },
    {
      _type: "stepsSection",
      title: "Three steps to stay connected",
      steps: [
        { stepNo: 1, title: "Pick your plan", body: "Choose a destination or regional bundle." },
        { stepNo: 2, title: "Activate in the app", body: "Scan your QR code or install directly on device." },
        { stepNo: 3, title: "Roam with support", body: "Chat with our team anytime you need a boost." }
      ]
    },
    {
      _type: "regionalBundleSpotlightSection",
      title: "One bundle for every border",
      bundle: regionBundles[0]
    },
    {
      _type: "liveNetworkWidgetSection",
      title: "Live network status",
      regions: [
        { name: "Cape Town", latencyMs: 28, signalQuality: "Excellent" },
        { name: "Windhoek", latencyMs: 45, signalQuality: "Great" },
        { name: "Nairobi", latencyMs: 38, signalQuality: "Excellent" }
      ]
    },
    {
      _type: "newsletterSection",
      title: "Join 25,000 travellers staying connected",
      body: "Weekly coverage intelligence, local travel tips, and exclusive Simplify offers straight to your inbox.",
      ctaLabel: "Subscribe",
      ctaTarget: "https://simplify.africa/newsletter"
    },
    {
      _type: "articlesSection",
      title: "Travel intelligence",
      posts: posts.map((post) => toPostSummary(post))
    }
  ]
};

function toCountrySummary(country: CountryDetail | undefined): CountrySummary {
  if (!country) {
    throw new Error("Unknown country");
  }

  return {
    _id: country._id,
    title: country.title,
    slug: country.slug,
    badge: country.badge,
    summary: country.summary,
    coverImage: country.coverImage,
    plan: country.plan
  };
}

function toPlanSummary(plan: PlanDetail): PlanSummary {
  return {
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
  };
}

function toPostSummary(post: PostDetail): PostSummary {
  return {
    _id: post._id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    readingMinutes: post.readingMinutes,
    tags: post.tags,
    publishedAt: post.publishedAt
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export async function getSiteSettings() {
  return clone(siteSettings);
}

export async function getHomePage() {
  return clone(homePage);
}

export async function getCountriesList() {
  return clone(countries.map((country) => ({ ...toCountrySummary(country), featured: country.featured })));
}

export async function getCountryBySlug(slug: string) {
  const country = countryBySlug[slug];
  return country ? clone(country) : null;
}

export async function getPlansForCountry(slug: string) {
  return clone(planDetails.filter((plan) => plan.country?.slug === slug));
}

export async function getPlanBySlug(slug: string) {
  const plan = planDetails.find((item) => item.slug === slug);
  return plan ? clone(plan) : null;
}

export async function getRegionBundles() {
  return clone(regionBundles);
}

export async function getBundleBySlug(slug: string) {
  const bundle = regionBundles.find((item) => item.slug === slug);
  return bundle ? clone(bundle) : null;
}

export async function getPosts() {
  return clone(posts.map((post) => toPostSummary(post)));
}

export async function getPostBySlug(slug: string) {
  const post = posts.find((item) => item.slug === slug);
  return post ? clone(post) : null;
}
