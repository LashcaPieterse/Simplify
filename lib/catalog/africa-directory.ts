import type { ImageLike } from "../image";
import type { EsimProductSummary } from "../sanity.queries";

export type AfricaRegion = "southern" | "eastern" | "western" | "central" | "northern";
export type AfricaRegionFilter = "all" | AfricaRegion;

export type AfricaCountryListing = {
  id: string;
  title: string;
  slug: string;
  countryCode: string;
  region: AfricaRegion;
  flagImage?: ImageLike;
  minimumPrice: {
    amount: number;
    currency: string;
  };
};

export const AFRICA_REGION_TABS: ReadonlyArray<{
  id: AfricaRegionFilter;
  label: string;
}> = [
  { id: "all", label: "All Africa" },
  { id: "southern", label: "Southern Africa" },
  { id: "eastern", label: "East Africa" },
  { id: "western", label: "West Africa" },
  { id: "central", label: "Central Africa" },
  { id: "northern", label: "North Africa" },
];

const REGION_CODES: Record<AfricaRegion, readonly string[]> = {
  northern: ["DZ", "EG", "LY", "MR", "MA", "SD", "TN", "EH"],
  western: ["BJ", "BF", "CV", "CI", "GM", "GH", "GN", "GW", "LR", "ML", "NE", "NG", "SN", "SL", "TG"],
  central: ["BI", "CM", "CF", "TD", "CG", "CD", "GQ", "GA", "ST"],
  eastern: ["KM", "DJ", "ER", "ET", "KE", "MG", "MU", "RW", "SC", "SO", "SS", "TZ", "UG", "YT", "RE"],
  southern: ["AO", "BW", "SZ", "LS", "MW", "MZ", "NA", "ZA", "ZM", "ZW"],
};

const REGION_BY_COUNTRY_CODE = new Map<string, AfricaRegion>(
  Object.entries(REGION_CODES).flatMap(([region, codes]) =>
    codes.map((code) => [code, region as AfricaRegion] as const),
  ),
);

const REGION_BY_TERRITORY_SLUG: Record<string, AfricaRegion> = {
  "canary-islands": "northern",
  mayotte: "eastern",
  reunion: "eastern",
};

export function getAfricaRegion(
  countryCode: string | null | undefined,
  slug: string | null | undefined,
): AfricaRegion | null {
  const normalizedCode = (countryCode ?? "").trim().toUpperCase();
  const normalizedSlug = (slug ?? "").trim().toLowerCase();

  return REGION_BY_COUNTRY_CODE.get(normalizedCode) ?? REGION_BY_TERRITORY_SLUG[normalizedSlug] ?? null;
}

function isUsableListingProduct(product: EsimProductSummary): boolean {
  return (
    product.status === "active" &&
    product.package?.isActive === true &&
    product.price?.source === "airalo" &&
    typeof product.price.amount === "number" &&
    Number.isFinite(product.price.amount) &&
    product.price.amount > 0
  );
}

export function buildAfricaCountryDirectory(
  products: EsimProductSummary[],
): AfricaCountryListing[] {
  const listings = new Map<string, AfricaCountryListing>();

  for (const product of products) {
    if (!isUsableListingProduct(product) || !product.country) {
      continue;
    }

    const { country } = product;
    const region = getAfricaRegion(country.countryCode, country.slug);
    if (!region || !country.slug || !country.countryCode || !product.price) {
      continue;
    }

    const currency = (product.price.currency || "USD").toUpperCase();
    const key = country.slug.toLowerCase();
    const current = listings.get(key);
    const candidate: AfricaCountryListing = {
      id: country._id,
      title: country.title,
      slug: country.slug,
      countryCode: country.countryCode.toUpperCase(),
      region,
      flagImage: country.coverImage,
      minimumPrice: {
        amount: product.price.amount,
        currency,
      },
    };

    if (
      !current ||
      (currency === current.minimumPrice.currency && product.price.amount < current.minimumPrice.amount) ||
      (currency === "USD" && current.minimumPrice.currency !== "USD")
    ) {
      listings.set(key, candidate);
    }
  }

  return Array.from(listings.values()).sort((left, right) =>
    left.title.localeCompare(right.title, "en", { sensitivity: "base" }),
  );
}
