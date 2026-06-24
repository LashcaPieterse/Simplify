import type { CountrySummary, EsimProductSummary, RegionBundle } from "../sanity.queries";

export type UsageProfileId = "light" | "social" | "work" | "heavy";
export type TripDurationDays = 3 | 7 | 15 | 30;

export type UsageProfile = {
  id: UsageProfileId;
  label: string;
  shortLabel: string;
  dataPerDayMb: number;
};

export type TripDestinationOption = {
  _id?: string;
  title: string;
  slug: string;
  destinationType?: "city" | "country" | "route";
  country?: Pick<CountrySummary, "title" | "slug"> | string | null;
  aliases?: readonly string[];
  searchTerms?: readonly string[];
  active?: boolean;
  preferredPackageIds?: readonly string[];
  regionalBundle?: RegionBundle | null;
};

export type TripRecommendation = {
  product: EsimProductSummary;
  packageId: string;
  score: number;
  fitReason: string;
  dataLimitMb: number | null;
  validityDays: number | null;
  priceAmount: number | null;
  priceCurrency: string;
  providerName: string | null;
};

export type TripMatchResult = {
  primary: TripRecommendation | null;
  alternatives: {
    cheapest: TripRecommendation | null;
    moreData: TripRecommendation | null;
  };
  durationDays: number;
  requiredDataMb: number;
  usageProfile: UsageProfile;
  destinationTerms: string[];
  isMultiDestination: boolean;
  suggestedCountries: CountrySummary[];
  matchedDestination: TripDestinationOption | null;
};

type ScoredProduct = TripRecommendation & {
  destinationScore: number;
  featuredIndex: number;
};

type TripMatchOptions = {
  destination: string;
  durationDays: number;
  usageProfileId: UsageProfileId;
  products: EsimProductSummary[];
  highlightedProductIds?: string[];
  tripDestinations?: readonly TripDestinationOption[];
  fallbackCountries?: CountrySummary[];
  maxSuggestions?: number;
};

const STOP_WORDS = new Set([
  "africa",
  "african",
  "data",
  "esim",
  "sim",
  "trip",
  "travel",
  "travelling",
  "traveling",
  "for",
  "from",
  "in",
  "into",
  "the",
  "to",
  "with",
]);

export const TRIP_DURATION_OPTIONS: readonly TripDurationDays[] = [3, 7, 15, 30];

export const EAST_AFRICA_TRIP_DESTINATION: TripDestinationOption = {
  title: "East-Africa",
  slug: "east-africa",
  destinationType: "route",
  country: "Africa Safari",
  aliases: ["East Africa"],
  searchTerms: ["Safarilink"],
};

export const MENA_TRIP_DESTINATION: TripDestinationOption = {
  title: "MENA",
  slug: "mena",
  destinationType: "route",
  country: "Middle East and North Africa",
  aliases: ["North Africa", "Middle East and North Africa"],
  searchTerms: ["Menalink"],
};

export const PINNED_ROUTE_TRIP_DESTINATIONS: readonly TripDestinationOption[] = [
  EAST_AFRICA_TRIP_DESTINATION,
  MENA_TRIP_DESTINATION,
];

export const FALLBACK_TRIP_DESTINATIONS: readonly TripDestinationOption[] = [
  ...PINNED_ROUTE_TRIP_DESTINATIONS,
  { title: "Cape Town", slug: "cape-town", destinationType: "city", country: "South Africa" },
  { title: "Zanzibar", slug: "zanzibar", destinationType: "city", country: "Tanzania" },
  { title: "Mombasa", slug: "mombasa", destinationType: "city", country: "Kenya" },
  { title: "Kampala", slug: "kampala", destinationType: "city", country: "Uganda" },
  { title: "Lagos", slug: "lagos", destinationType: "city", country: "Nigeria" },
  { title: "Cairo", slug: "cairo", destinationType: "city", country: "Egypt" },
  { title: "Kigali", slug: "kigali", destinationType: "city", country: "Rwanda" },
  { title: "Marrakesh", slug: "marrakesh", destinationType: "city", country: "Morocco", aliases: ["Marrakech"] },
  { title: "Addis Ababa", slug: "addis-ababa", destinationType: "city", country: "Ethiopia" },
  { title: "Johannesburg", slug: "johannesburg", destinationType: "city", country: "South Africa" },
  { title: "Nairobi", slug: "nairobi", destinationType: "city", country: "Kenya" },
  { title: "Casablanca", slug: "casablanca", destinationType: "city", country: "Morocco" },
  { title: "Accra", slug: "accra", destinationType: "city", country: "Ghana" },
];

export const POPULAR_AFRICAN_CITY_DESTINATIONS = FALLBACK_TRIP_DESTINATIONS;

export const USAGE_PROFILES: readonly UsageProfile[] = [
  {
    id: "light",
    label: "WhatsApp + maps",
    shortLabel: "Maps",
    dataPerDayMb: 250,
  },
  {
    id: "social",
    label: "Social browsing",
    shortLabel: "Social",
    dataPerDayMb: 600,
  },
  {
    id: "work",
    label: "Work calls",
    shortLabel: "Work",
    dataPerDayMb: 1200,
  },
  {
    id: "heavy",
    label: "Heavy data",
    shortLabel: "Heavy",
    dataPerDayMb: 2000,
  },
];

export const DEFAULT_USAGE_PROFILE_ID: UsageProfileId = "social";
export const DEFAULT_TRIP_DURATION_DAYS: TripDurationDays = 15;

export function getUsageProfile(id: UsageProfileId): UsageProfile {
  return USAGE_PROFILES.find((profile) => profile.id === id) ?? USAGE_PROFILES[1];
}

export function formatDataAmount(dataLimitMb: number | null | undefined): string {
  if (typeof dataLimitMb !== "number" || !Number.isFinite(dataLimitMb) || dataLimitMb <= 0) {
    return "Data varies";
  }

  if (dataLimitMb < 1024) {
    return `${Math.round(dataLimitMb)} MB`;
  }

  const gigabytes = dataLimitMb / 1024;
  const rounded = Math.round(gigabytes * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} GB`;
}

export function matchTripPlans(options: TripMatchOptions): TripMatchResult {
  const usageProfile = getUsageProfile(options.usageProfileId);
  const durationDays = normalizeDuration(options.durationDays);
  const requiredDataMb = Math.ceil(usageProfile.dataPerDayMb * durationDays);
  const destination = options.destination.trim();
  const tripDestinations = options.tripDestinations?.length ? options.tripDestinations : FALLBACK_TRIP_DESTINATIONS;
  const destinationResolution = resolveTripDestination(getDestinationTerms(destination), tripDestinations);
  const destinationTerms = destinationResolution.terms;
  const destinationWords = getSearchWords(destination);
  const isMultiDestination = isMultiDestinationQuery(destination);
  const featuredOrder = new Map((options.highlightedProductIds ?? []).map((id, index) => [id, index]));
  const preferredPackageKeys = new Set(
    (destinationResolution.matchedDestination?.preferredPackageIds ?? []).map(normalizeKey).filter(Boolean),
  );
  const hasDestination = destinationTerms.length > 0 || destinationWords.length > 0;

  const scoredProducts = options.products
    .filter(isSellableProduct)
    .map((product) =>
      scoreProduct({
        product,
        durationDays,
        requiredDataMb,
        usageProfile,
        destinationTerms,
        destinationWords,
        hasDestination,
        featuredOrder,
        preferredPackageKeys,
      }),
    )
    .filter((product): product is ScoredProduct => Boolean(product));

  const rankedProducts = scoredProducts
    .filter((product) => !hasDestination || product.destinationScore > 0)
    .sort(compareScoredProducts);

  const primary = rankedProducts[0] ?? null;
  const cheapest = primary ? pickCheapestAlternative(rankedProducts, new Set([primary.product._id])) : null;
  const usedForMoreData = new Set([primary?.product._id, cheapest?.product._id].filter((id): id is string => Boolean(id)));
  const moreData = primary ? pickMoreDataAlternative(rankedProducts, usedForMoreData, primary.dataLimitMb) : null;

  return {
    primary,
    alternatives: {
      cheapest,
      moreData,
    },
    durationDays,
    requiredDataMb,
    usageProfile,
    destinationTerms,
    isMultiDestination,
    suggestedCountries: getSuggestedCountries(options.fallbackCountries ?? [], options.maxSuggestions ?? 5),
    matchedDestination: destinationResolution.matchedDestination,
  };
}

function normalizeDuration(durationDays: number): number {
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    return DEFAULT_TRIP_DURATION_DAYS;
  }

  return Math.round(durationDays);
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value: string | null | undefined): string {
  return normalize(value).replace(/\s+/g, "-");
}

function getDestinationTerms(destination: string): string[] {
  return destination
    .split(/\s*(?:\+|,|;|&|\band\b|\bthen\b|\bto\b)\s*/i)
    .map(normalize)
    .filter(Boolean);
}

function getSearchWords(destination: string): string[] {
  return normalize(destination)
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function resolveTripDestination(
  terms: string[],
  tripDestinations: readonly TripDestinationOption[],
): { terms: string[]; matchedDestination: TripDestinationOption | null } {
  const expandedTerms: string[] = [];
  const seen = new Set<string>();
  let matchedDestination: TripDestinationOption | null = null;

  const addTerm = (term: string) => {
    if (!term || seen.has(term)) {
      return;
    }

    seen.add(term);
    expandedTerms.push(term);
  };

  for (const term of terms) {
    addTerm(term);

    const matchingDestination = tripDestinations.find((destination) => {
      if (destination.active === false) {
        return false;
      }

      const destinationTerms = [
        destination.title,
        destination.slug,
        ...(destination.aliases ?? []),
        ...(destination.searchTerms ?? []),
      ].map(normalize);

      return destinationTerms.includes(term);
    });

    if (matchingDestination) {
      matchedDestination ??= matchingDestination;
      getDestinationCountryTerms(matchingDestination).forEach(addTerm);
      (matchingDestination.aliases ?? []).map(normalize).forEach(addTerm);
      (matchingDestination.searchTerms ?? []).map(normalize).forEach(addTerm);
    }
  }

  return { terms: expandedTerms, matchedDestination };
}

function getDestinationCountryTerms(destination: TripDestinationOption): string[] {
  if (!destination.country) {
    return [];
  }

  if (typeof destination.country === "string") {
    return [normalize(destination.country)];
  }

  return [normalize(destination.country.title), normalize(destination.country.slug)].filter(Boolean);
}

function isMultiDestinationQuery(destination: string): boolean {
  return /\+|,|;|&|\band\b|\bthen\b|\bto\b/i.test(destination);
}

function isSellableProduct(product: EsimProductSummary): boolean {
  const packageId = getPackageId(product);
  return Boolean(packageId && product.status === "active" && product.package?.isActive !== false);
}

function getPackageId(product: EsimProductSummary): string | null {
  const pkg = product.package;
  if (!pkg || pkg.isActive === false) {
    return null;
  }

  return pkg.externalId || pkg.id || null;
}

function getProductDataLimitMb(product: EsimProductSummary): number | null {
  if (typeof product.package?.dataLimitMb === "number") {
    return product.package.dataLimitMb;
  }

  if (typeof product.plan?.dataGB === "number" && product.plan.dataGB > 0) {
    return product.plan.dataGB * 1024;
  }

  return null;
}

function getProductValidityDays(product: EsimProductSummary): number | null {
  if (typeof product.package?.validityDays === "number") {
    return product.package.validityDays;
  }

  if (typeof product.plan?.validityDays === "number") {
    return product.plan.validityDays;
  }

  return null;
}

function getProductPriceAmount(product: EsimProductSummary): number | null {
  if (typeof product.price?.amount === "number") {
    return product.price.amount;
  }

  if (typeof product.priceUSD === "number" && product.priceUSD > 0) {
    return product.priceUSD;
  }

  if (typeof product.package?.priceCents === "number" && product.package.priceCents > 0) {
    return product.package.priceCents / 100;
  }

  return null;
}

function getProductPriceCurrency(product: EsimProductSummary): string {
  return product.price?.currency ?? product.package?.currency ?? "USD";
}

function getProviderName(product: EsimProductSummary): string | null {
  return product.provider?.title ?? product.package?.operator?.title ?? product.plan?.provider?.title ?? null;
}

function scoreProduct({
  product,
  durationDays,
  requiredDataMb,
  usageProfile,
  destinationTerms,
  destinationWords,
  hasDestination,
  featuredOrder,
  preferredPackageKeys,
}: {
  product: EsimProductSummary;
  durationDays: number;
  requiredDataMb: number;
  usageProfile: UsageProfile;
  destinationTerms: string[];
  destinationWords: string[];
  hasDestination: boolean;
  featuredOrder: Map<string, number>;
  preferredPackageKeys: Set<string>;
}): ScoredProduct | null {
  const packageId = getPackageId(product);
  if (!packageId) {
    return null;
  }

  const dataLimitMb = getProductDataLimitMb(product);
  const validityDays = getProductValidityDays(product);
  const priceAmount = getProductPriceAmount(product);
  const priceCurrency = getProductPriceCurrency(product);
  const providerName = getProviderName(product);
  const destinationScore = hasDestination ? getDestinationScore(product, destinationTerms, destinationWords) : 0;
  const dataScore = getDataScore(dataLimitMb, requiredDataMb);
  const validityScore = getValidityScore(validityDays, durationDays);
  const priceScore = getPriceScore(priceAmount);
  const featuredIndex = featuredOrder.get(product._id) ?? Number.MAX_SAFE_INTEGER;
  const featuredScore = featuredIndex === Number.MAX_SAFE_INTEGER ? 0 : hasDestination ? 75 : 900 - featuredIndex;
  const preferredPackageScore = getPreferredPackageScore(product, preferredPackageKeys);

  return {
    product,
    packageId,
    score: destinationScore + dataScore + validityScore + priceScore + featuredScore + preferredPackageScore,
    destinationScore,
    featuredIndex,
    fitReason: getFitReason({ dataLimitMb, validityDays, requiredDataMb, durationDays, usageProfile }),
    dataLimitMb,
    validityDays,
    priceAmount,
    priceCurrency,
    providerName,
  };
}

function getPreferredPackageScore(product: EsimProductSummary, preferredPackageKeys: Set<string>): number {
  if (preferredPackageKeys.size === 0) {
    return 0;
  }

  const packageKeys = [
    product.package?.id,
    product.package?.externalId,
    product.slugs?.plan,
  ]
    .map(normalizeKey)
    .filter(Boolean);

  return packageKeys.some((key) => preferredPackageKeys.has(key)) ? 420 : 0;
}

function getDestinationScore(
  product: EsimProductSummary,
  destinationTerms: string[],
  destinationWords: string[],
): number {
  const countryTitle = normalize(product.country?.title);
  const countrySlug = normalize(product.country?.slug);
  const productName = normalize(product.displayName);
  const packageTitle = normalize(product.package?.title ?? product.plan?.title);
  const providerName = normalize(getProviderName(product));
  const providerBadge = normalize(product.provider?.badge ?? product.providerBadge);
  const keywords = (product.keywords ?? []).map(normalize).filter(Boolean);

  let score = 0;

  for (const term of destinationTerms) {
    if (!term) continue;

    if (term === countryTitle || term === countrySlug) {
      score = Math.max(score, 650);
      continue;
    }

    if ((countryTitle && term.includes(countryTitle)) || (countryTitle && countryTitle.includes(term))) {
      score = Math.max(score, 500);
    }

    if (productName.includes(term) || packageTitle.includes(term)) {
      score = Math.max(score, 320);
    }

    if (providerName.includes(term) || providerBadge.includes(term)) {
      score = Math.max(score, 180);
    }

    if (keywords.some((keyword) => keyword === term || keyword.includes(term))) {
      score = Math.max(score, 220);
    }
  }

  for (const word of destinationWords) {
    if (!word) continue;

    if (countryTitle.split(" ").includes(word) || countrySlug.split(" ").includes(word)) {
      score = Math.max(score, 260);
    }

    if (productName.includes(word) || packageTitle.includes(word)) {
      score = Math.max(score, 140);
    }

    if (providerName.includes(word) || providerBadge.includes(word)) {
      score = Math.max(score, 95);
    }

    if (keywords.some((keyword) => keyword.includes(word))) {
      score = Math.max(score, 110);
    }
  }

  return score;
}

function getDataScore(dataLimitMb: number | null, requiredDataMb: number): number {
  if (typeof dataLimitMb !== "number" || dataLimitMb <= 0) {
    return 0;
  }

  if (dataLimitMb >= requiredDataMb) {
    const overageRatio = (dataLimitMb - requiredDataMb) / Math.max(requiredDataMb, 1);
    return 190 - Math.min(overageRatio * 70, 90);
  }

  return Math.max(-140, (dataLimitMb / Math.max(requiredDataMb, 1)) * 130 - 120);
}

function getValidityScore(validityDays: number | null, durationDays: number): number {
  if (typeof validityDays !== "number" || validityDays <= 0) {
    return 0;
  }

  if (validityDays >= durationDays) {
    return 190 - Math.min((validityDays - durationDays) * 4, 80);
  }

  return Math.max(-260, -65 * (durationDays - validityDays));
}

function getPriceScore(priceAmount: number | null): number {
  if (typeof priceAmount !== "number" || priceAmount <= 0) {
    return 0;
  }

  return Math.max(0, 160 - priceAmount * 3);
}

function getFitReason({
  dataLimitMb,
  validityDays,
  requiredDataMb,
  durationDays,
  usageProfile,
}: {
  dataLimitMb: number | null;
  validityDays: number | null;
  requiredDataMb: number;
  durationDays: number;
  usageProfile: UsageProfile;
}) {
  const hasEnoughValidity = typeof validityDays === "number" && validityDays >= durationDays;
  const hasEnoughData = typeof dataLimitMb === "number" && dataLimitMb >= requiredDataMb;

  if (hasEnoughValidity && hasEnoughData) {
    return `Covers ${durationDays} days of ${usageProfile.shortLabel.toLowerCase()} use`;
  }

  if (!hasEnoughValidity && hasEnoughData) {
    return "Best active match; consider a longer validity plan for this stay";
  }

  if (hasEnoughValidity && !hasEnoughData) {
    return "Good validity; choose more data if you expect heavier use";
  }

  return "Closest active match for this destination";
}

function compareScoredProducts(first: ScoredProduct, second: ScoredProduct): number {
  if (second.score !== first.score) {
    return second.score - first.score;
  }

  if (first.featuredIndex !== second.featuredIndex) {
    return first.featuredIndex - second.featuredIndex;
  }

  return (first.priceAmount ?? Number.MAX_SAFE_INTEGER) - (second.priceAmount ?? Number.MAX_SAFE_INTEGER);
}

function pickCheapestAlternative(products: ScoredProduct[], usedIds: Set<string>): TripRecommendation | null {
  return (
    [...products]
      .filter((product) => !usedIds.has(product.product._id))
      .sort((first, second) => {
        const priceDifference =
          (first.priceAmount ?? Number.MAX_SAFE_INTEGER) - (second.priceAmount ?? Number.MAX_SAFE_INTEGER);
        return priceDifference || second.score - first.score;
      })[0] ?? null
  );
}

function pickMoreDataAlternative(
  products: ScoredProduct[],
  usedIds: Set<string>,
  primaryDataLimitMb: number | null,
): TripRecommendation | null {
  const unusedProducts = products.filter((product) => !usedIds.has(product.product._id));
  const higherDataProducts =
    typeof primaryDataLimitMb === "number"
      ? unusedProducts.filter((product) => typeof product.dataLimitMb === "number" && product.dataLimitMb > primaryDataLimitMb)
      : unusedProducts;

  const candidates = higherDataProducts.length > 0 ? higherDataProducts : unusedProducts;

  return (
    [...candidates].sort((first, second) => {
      const dataDifference = (second.dataLimitMb ?? 0) - (first.dataLimitMb ?? 0);
      return dataDifference || (first.priceAmount ?? Number.MAX_SAFE_INTEGER) - (second.priceAmount ?? Number.MAX_SAFE_INTEGER);
    })[0] ?? null
  );
}

function getSuggestedCountries(countries: CountrySummary[], maxSuggestions: number): CountrySummary[] {
  const seen = new Set<string>();
  const suggestions: CountrySummary[] = [];

  for (const country of countries) {
    const key = country.slug || country.title;
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    suggestions.push(country);

    if (suggestions.length >= maxSuggestions) {
      break;
    }
  }

  return suggestions;
}
