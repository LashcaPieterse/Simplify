import assert from "node:assert/strict";
import test from "node:test";

import type { EsimProductSummary } from "../sanity.queries";
import { buildAfricaCountryDirectory, getAfricaRegion } from "./africa-directory";

type ProductOverrides = {
  id: string;
  title: string;
  slug: string;
  countryCode: string;
  price: number;
  status?: EsimProductSummary["status"];
  packageActive?: boolean;
};

function makeProduct({
  id,
  title,
  slug,
  countryCode,
  price,
  status = "active",
  packageActive = true,
}: ProductOverrides): EsimProductSummary {
  return {
    _id: `product-${id}`,
    displayName: `${title} eSIM`,
    slug: `product-${slug}-${id}`,
    priceUSD: price,
    shortDescription: `${title} package`,
    status,
    country: {
      _id: `country-${slug}`,
      title,
      slug,
      countryCode,
      coverImage: { url: `https://example.com/${countryCode.toLowerCase()}.png` },
    },
    price: {
      amount: price,
      currency: "USD",
      source: "airalo",
    },
    package: {
      id: `package-${id}`,
      externalId: `package-${id}`,
      currency: "USD",
      priceCents: price * 100,
      isActive: packageActive,
    },
  };
}

test("getAfricaRegion uses AU-aligned regions and assigns supported territories", () => {
  assert.equal(getAfricaRegion("ZA", "south-africa"), "southern");
  assert.equal(getAfricaRegion("KE", "kenya"), "eastern");
  assert.equal(getAfricaRegion("GH", "ghana"), "western");
  assert.equal(getAfricaRegion("CD", "democratic-republic-of-the-congo"), "central");
  assert.equal(getAfricaRegion("MA", "morocco"), "northern");
  assert.equal(getAfricaRegion("ES-XCI", "canary-islands"), "northern");
  assert.equal(getAfricaRegion("YT", "mayotte"), "eastern");
  assert.equal(getAfricaRegion("RE", "reunion"), "eastern");
});

test("getAfricaRegion excludes regional and global pseudo-destinations", () => {
  assert.equal(getAfricaRegion("AIRALO-AFRICA", "africa"), null);
  assert.equal(getAfricaRegion("AIRALO-MENA", "middle-east-and-north-africa"), null);
  assert.equal(getAfricaRegion("AIRALO-WORLD", "discover-global"), null);
});

test("buildAfricaCountryDirectory sorts countries and chooses the lowest positive live price", () => {
  const directory = buildAfricaCountryDirectory([
    makeProduct({ id: "za-high", title: "South Africa", slug: "south-africa", countryCode: "ZA", price: 12 }),
    makeProduct({ id: "mg-zero", title: "Madagascar", slug: "madagascar", countryCode: "MG", price: 0 }),
    makeProduct({ id: "za-low", title: "South Africa", slug: "south-africa", countryCode: "ZA", price: 4.5 }),
    makeProduct({ id: "mg-valid", title: "Madagascar", slug: "madagascar", countryCode: "MG", price: 7 }),
    makeProduct({ id: "ke", title: "Kenya", slug: "kenya", countryCode: "KE", price: 8 }),
  ]);

  assert.deepEqual(directory.map((country) => country.title), ["Kenya", "Madagascar", "South Africa"]);
  assert.equal(directory.find((country) => country.slug === "madagascar")?.minimumPrice.amount, 7);
  assert.equal(directory.find((country) => country.slug === "south-africa")?.minimumPrice.amount, 4.5);
});

test("buildAfricaCountryDirectory ignores inactive, archived, and non-country products", () => {
  const directory = buildAfricaCountryDirectory([
    makeProduct({ id: "inactive", title: "Kenya", slug: "kenya", countryCode: "KE", price: 8, packageActive: false }),
    makeProduct({ id: "archived", title: "Ghana", slug: "ghana", countryCode: "GH", price: 5, status: "archived" }),
    makeProduct({ id: "route", title: "Africa Safari", slug: "africa-safari", countryCode: "AIRALO-AFRICA-SAFARI", price: 6 }),
  ]);

  assert.deepEqual(directory, []);
});
