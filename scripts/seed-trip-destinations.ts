import { createClient } from "@sanity/client";

import { FALLBACK_TRIP_DESTINATIONS } from "../lib/esim/trip-matcher";

const projectId = process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_READ_TOKEN;
const apiVersion = process.env.SANITY_API_VERSION || "2025-01-01";

if (!projectId || !dataset || !token) {
  console.error("Missing SANITY_PROJECT_ID, SANITY_DATASET, or SANITY_READ_TOKEN");
  process.exit(1);
}

const sanity = createClient({
  projectId,
  dataset,
  token,
  apiVersion,
  useCdn: false,
});

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function getCountryTitle(country: (typeof FALLBACK_TRIP_DESTINATIONS)[number]["country"]): string | null {
  if (!country) {
    return null;
  }

  return typeof country === "string" ? country : country.title;
}

async function findCountryRef(countryTitle: string | null): Promise<string | null> {
  if (!countryTitle) {
    return null;
  }

  const countrySlug = slugify(countryTitle);
  return sanity.fetch<string | null>(
    '*[_type == "catalogCountry" && (title == $countryTitle || slug.current == $countrySlug)][0]._id',
    { countryTitle, countrySlug },
  );
}

async function main() {
  const documents = [];

  for (const [index, destination] of FALLBACK_TRIP_DESTINATIONS.entries()) {
    const countryTitle = getCountryTitle(destination.country);
    const countryRef = await findCountryRef(countryTitle);

    if (!countryRef) {
      console.warn(`[trip-destinations] Missing catalogCountry for ${destination.title} (${countryTitle ?? "unknown country"})`);
    }

    documents.push({
      _id: `trip-destination-${destination.slug}`,
      _type: "tripDestination",
      title: destination.title,
      slug: { _type: "slug", current: destination.slug },
      destinationType: destination.destinationType ?? "city",
      country: countryRef ? { _type: "reference", _ref: countryRef } : null,
      aliases: destination.aliases ?? [],
      searchTerms: destination.searchTerms ?? [],
      active: Boolean(countryRef),
      featured: true,
      sortOrder: index + 1,
      preferredPackages: [],
    });
  }

  await sanity.mutate(documents.map((document) => ({ createOrReplace: document })), {
    returnIds: false,
    visibility: "async",
  });

  console.info(`[trip-destinations] Upserted ${documents.length} trip destinations`);
}

main().catch((error) => {
  console.error("[trip-destinations] Failed to seed trip destinations", error);
  process.exit(1);
});
