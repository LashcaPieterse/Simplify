import { createClient } from "@sanity/client";

const projectId = process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset =
  process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const token = process.env.SANITY_READ_TOKEN;
const apiVersion = process.env.SANITY_API_VERSION || "2025-01-01";

if (!projectId || !dataset || !token) {
  console.error("Missing required environment variables for seeding.");
  process.exit(1);
}

const client = createClient({ projectId, dataset, token, apiVersion, useCdn: false });

async function uploadImage(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const asset = await client.assets.upload("image", Buffer.from(arrayBuffer), { filename });
  return {
    _type: "image" as const,
    asset: {
      _type: "reference" as const,
      _ref: asset._id
    }
  };
}

async function seed() {
  console.info("Uploading media assets...");
  const [namibiaCover, southAfricaCover, kenyaCover, botswanaCover, zambiaCover, blogCover] = await Promise.all([
    uploadImage("https://images.unsplash.com/photo-1500530855697-b586d89ba3ee", "namibia.jpg"),
    uploadImage("https://images.unsplash.com/photo-1526481280695-3c469928b67b", "south-africa.jpg"),
    uploadImage("https://images.unsplash.com/photo-1500534623283-312aade485b7", "kenya.jpg"),
    uploadImage("https://images.unsplash.com/photo-1582719478250-c89cae4dc85b", "botswana.jpg"),
    uploadImage("https://images.unsplash.com/photo-1526498460520-4c246339dccb", "zambia.jpg"),
    uploadImage("https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1", "blog-cover.jpg")
  ]);

  console.info("Creating core documents...");

  const docs = [
    {
      _id: "siteSettings",
      _type: "siteSettings",
      title: "Simplify",
      tagline: "#1 eSIM marketplace in Africa 2024",
      contactEmail: "hello@simplify.africa",
      logo: namibiaCover,
      navigation: [
        { _type: "link", label: "eSIM Store", url: "#store" },
        { _type: "link", label: "How it works", url: "#how" },
        { _type: "link", label: "Coverage", url: "#coverage" },
        { _type: "link", label: "Resources", url: "/resources" }
      ],
      footerLinks: [
        { _type: "link", label: "Privacy", url: "https://simplify.africa/privacy" },
        { _type: "link", label: "Terms", url: "https://simplify.africa/terms" },
        { _type: "link", label: "Support", url: "mailto:support@simplify.africa" }
      ]
    },
    {
      _id: "country-namibia",
      _type: "country",
      title: "Namibia",
      slug: { _type: "slug", current: "namibia" },
      featured: true,
      badge: "Popular",
      coverImage: namibiaCover,
      summary: "Perfect signal strength across Etosha, Sossusvlei, and Windhoek with zero roaming fees.",
      carriers: [
        { _type: "reference", _ref: "carrier-tn-mobile" }
      ],
      plans: [
        { _type: "reference", _ref: "plan-nama" }
      ]
    },
    {
      _id: "country-south-africa",
      _type: "country",
      title: "South Africa",
      slug: { _type: "slug", current: "south-africa" },
      featured: true,
      badge: "Best value",
      coverImage: southAfricaCover,
      summary: "Covering the Garden Route, Cape Town, and Kruger with seamless 5G handoffs.",
      carriers: [
        { _type: "reference", _ref: "carrier-vodaconnect" }
      ],
      plans: [
        { _type: "reference", _ref: "plan-cape-explorer" }
      ]
    },
    {
      _id: "country-kenya",
      _type: "country",
      title: "Kenya",
      slug: { _type: "slug", current: "kenya" },
      featured: true,
      badge: "New",
      coverImage: kenyaCover,
      summary: "Stay connected from Nairobi to the Mara with unlimited messaging add-ons.",
      carriers: [
        { _type: "reference", _ref: "carrier-safarinet" }
      ],
      plans: [
        { _type: "reference", _ref: "plan-maasai" }
      ]
    },
    {
      _id: "country-botswana",
      _type: "country",
      title: "Botswana",
      slug: { _type: "slug", current: "botswana" },
      coverImage: botswanaCover,
      summary: "Reliable coverage across the Okavango Delta and Gaborone business district.",
      carriers: [],
      plans: []
    },
    {
      _id: "country-zambia",
      _type: "country",
      title: "Zambia",
      slug: { _type: "slug", current: "zambia" },
      coverImage: zambiaCover,
      summary: "High-speed connectivity from Victoria Falls to Lusaka with seamless roaming.",
      carriers: [],
      plans: []
    },
    {
      _id: "carrier-tn-mobile",
      _type: "carrier",
      title: "TN Mobile",
      slug: { _type: "slug", current: "tn-mobile" },
      logo: namibiaCover,
      country: { _type: "reference", _ref: "country-namibia" },
      notes: "National LTE network with 5G pilots in Windhoek."
    },
    {
      _id: "carrier-vodaconnect",
      _type: "carrier",
      title: "VodaConnect",
      slug: { _type: "slug", current: "vodaconnect" },
      logo: southAfricaCover,
      country: { _type: "reference", _ref: "country-south-africa" },
      notes: "Nationwide 5G with Wi-Fi calling and in-flight roaming agreements."
    },
    {
      _id: "carrier-safarinet",
      _type: "carrier",
      title: "SafariNet",
      slug: { _type: "slug", current: "safarinet" },
      logo: kenyaCover,
      country: { _type: "reference", _ref: "country-kenya" },
      notes: "Best coverage for national parks with unlimited messaging bundles."
    },
    {
      _id: "plan-nama",
      _type: "plan",
      title: "Nama",
      slug: { _type: "slug", current: "nama" },
      priceUSD: 18,
      dataGB: 15,
      validityDays: 14,
      hotspot: true,
      fiveG: false,
      label: "Popular",
      shortBlurb: "Perfect for safari adventurers with 15GB high-speed data.",
      features: ["Instant QR activation", "Usage alerts in the app"],
      whatsIncluded: ["15GB of high-speed data", "Unlimited messaging apps", "24/7 Simplify concierge"],
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
      provider: { _type: "reference", _ref: "carrier-tn-mobile" },
      country: { _type: "reference", _ref: "country-namibia" }
    },
    {
      _id: "plan-cape-explorer",
      _type: "plan",
      title: "Cape Explorer",
      slug: { _type: "slug", current: "cape-explorer" },
      priceUSD: 24,
      dataGB: 20,
      validityDays: 21,
      hotspot: true,
      fiveG: true,
      label: "Best value",
      shortBlurb: "Ideal for road trips with 20GB data and hotspot support.",
      features: ["5G in Cape Town & Johannesburg", "Free lounge Wi-Fi vouchers"],
      whatsIncluded: ["20GB of shared data", "Unlimited WhatsApp calls", "Priority support in-app"],
      installSteps: [
        {
          _type: "block",
          style: "normal",
          children: [{ _type: "span", text: "Add the eSIM via Settings → Cellular → Add eSIM." }]
        },
        {
          _type: "block",
          style: "normal",
          children: [{ _type: "span", text: "Select Cape Explorer as the default line for data." }]
        }
      ],
      terms: [
        {
          _type: "block",
          style: "normal",
          children: [{ _type: "span", text: "Includes 5G where available. Falls back to LTE elsewhere." }]
        }
      ],
      provider: { _type: "reference", _ref: "carrier-vodaconnect" },
      country: { _type: "reference", _ref: "country-south-africa" }
    },
    {
      _id: "plan-maasai",
      _type: "plan",
      title: "Maasai",
      slug: { _type: "slug", current: "maasai" },
      priceUSD: 16,
      dataGB: 10,
      validityDays: 21,
      hotspot: false,
      fiveG: false,
      label: "New",
      shortBlurb: "Free WhatsApp calls and daily safari weather alerts.",
      features: ["Unlimited messaging", "Daily safari weather briefings"],
      whatsIncluded: ["10GB of high-speed data", "In-app top-up", "Live chat support"],
      installSteps: [
        {
          _type: "block",
          style: "normal",
          children: [{ _type: "span", text: "Open Simplify → My eSIMs → Activate Maasai plan." }]
        }
      ],
      terms: [
        {
          _type: "block",
          style: "normal",
          children: [{ _type: "span", text: "Activation required within 30 days of purchase." }]
        }
      ],
      provider: { _type: "reference", _ref: "carrier-safarinet" },
      country: { _type: "reference", _ref: "country-kenya" }
    },
    {
      _id: "bundle-southern-explorer",
      _type: "regionBundle",
      title: "Southern Explorer",
      slug: { _type: "slug", current: "southern-explorer" },
      countries: [
        { _type: "reference", _ref: "country-south-africa" },
        { _type: "reference", _ref: "country-namibia" },
        { _type: "reference", _ref: "country-botswana" },
        { _type: "reference", _ref: "country-zambia" }
      ],
      sharedDataGB: 40,
      includes: ["Regional 5G where available", "Wi-Fi calling", "24/7 live chat"],
      fiveG: true,
      support: "Concierge support",
      perks: ["5G where available", "24/7 live chat", "In-app travel alerts"],
      heroImage: southAfricaCover,
      ctaLabel: "Get this bundle",
      ctaTarget: "/bundle/southern-explorer"
    },
    {
      _id: "post-latest-coverage",
      _type: "post",
      title: "2024 coverage guide: Southern Africa",
      slug: { _type: "slug", current: "2024-coverage-guide-southern-africa" },
      excerpt: "Compare carrier speeds and availability before you depart for Southern Africa.",
      coverImage: blogCover,
      body: [
        {
          _type: "block",
          style: "normal",
          children: [{ _type: "span", text: "Southern Africa now offers the strongest eSIM coverage we've tracked." }]
        }
      ],
      readingMinutes: 6,
      tags: ["Coverage", "Africa"],
      publishedAt: new Date().toISOString()
    },
    {
      _id: "post-esim-checklist",
      _type: "post",
      title: "Pre-flight eSIM checklist",
      slug: { _type: "slug", current: "pre-flight-esim-checklist" },
      excerpt: "Ensure your device and plan are ready before you leave home.",
      coverImage: blogCover,
      body: [
        {
          _type: "block",
          style: "normal",
          children: [{ _type: "span", text: "Run this quick checklist the night before departure." }]
        }
      ],
      readingMinutes: 4,
      tags: ["Tips"],
      publishedAt: new Date().toISOString()
    }
  ];

  for (const doc of docs) {
    await client.createOrReplace(doc);
  }

  console.info("Creating home page sections...");

  const homePage = {
    _id: "homePage",
    _type: "homePage",
    title: "Home",
    sections: [
      {
        _type: "heroSection",
        headline: "Instant eSIMs for every leg of your journey.",
        subhead:
          "Discover curated local, regional, and global plans, install in minutes, and stay connected from touchdown to takeoff.",
        ctas: [
          { _type: "link", label: "Browse plans", url: "#store" },
          { _type: "link", label: "Check compatibility", url: "https://simplify.africa/compatibility" }
        ],
        stats: [
          { label: "Trips connected", value: "1.5M+" },
          { label: "Satisfaction score", value: "98%" },
          { label: "Average activation", value: "<3 mins" }
        ]
      },
      {
        _type: "countryGridSection",
        title: "Curated plans for your next stop",
        countries: [
          { _type: "reference", _ref: "country-namibia" },
          { _type: "reference", _ref: "country-south-africa" },
          { _type: "reference", _ref: "country-kenya" }
        ]
      },
      {
        _type: "whyChooseUsSection",
        title: "Built for constant movement",
        bullets: [
          { _type: "iconBullet", iconName: "globe", title: "190+ countries", body: "Local and regional plans curated for seamless roaming-free travel." },
          { _type: "iconBullet", iconName: "shield", title: "Trusted partners", body: "Tier-one carriers with transparent pricing and round-the-clock support." },
          { _type: "iconBullet", iconName: "zap", title: "Instant activation", body: "Install your QR in minutes and get connected before you depart." }
        ]
      },
      {
        _type: "stepsSection",
        title: "Activate in three guided steps",
        steps: [
          { stepNo: 1, title: "Choose destination plan", body: "Filter by travel dates, network speed, and perks tailored to your itinerary." },
          { stepNo: 2, title: "Install QR or manual setup", body: "Detailed instructions for iOS, Android, and wearables keep setup stress-free." },
          { stepNo: 3, title: "Enjoy secure global coverage", body: "Monitor usage, top up in seconds, and switch plans without touching a SIM tray." }
        ]
      },
      {
        _type: "regionalBundleSpotlightSection",
        title: "Regional bundles for your next escape",
        bundle: { _type: "reference", _ref: "bundle-southern-explorer" }
      },
      {
        _type: "liveNetworkWidgetSection",
        title: "Live network quality",
        regions: [
          { name: "Namibia", latencyMs: 32, signalQuality: "Strong" },
          { name: "Botswana", latencyMs: 28, signalQuality: "Excellent" },
          { name: "Zambia", latencyMs: 41, signalQuality: "Strong" }
        ]
      },
      {
        _type: "newsletterSection",
        title: "Travel smarter with the Simplify briefing",
        body: "Monthly guides to new destinations, carrier launches, lounge perks, and real traveller tips.",
        ctaLabel: "Subscribe",
        ctaTarget: "https://simplify.africa/newsletter"
      },
      {
        _type: "articlesSection",
        title: "Fresh from the resources hub",
        posts: [
          { _type: "reference", _ref: "post-latest-coverage" },
          { _type: "reference", _ref: "post-esim-checklist" }
        ]
      }
    ]
  };

  await client.createOrReplace(homePage);

  console.info("Seed data completed.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
