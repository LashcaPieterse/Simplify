import assert from "node:assert/strict";
import test from "node:test";

import { citySearchTermsForCountry } from "./destination-search";

test("destination aliases include useful cities and common spelling variants", () => {
  assert(citySearchTermsForCountry("tanzania").includes("Zanzibar"));
  assert(citySearchTermsForCountry("tanzania").includes("Tansania"));
  assert(citySearchTermsForCountry("morocco").includes("Marrakesh"));
  assert(citySearchTermsForCountry("mauritius").includes("Mauritious"));
});

test("destination aliases return a new empty list for unknown countries", () => {
  const first = citySearchTermsForCountry("unknown");
  first.push("mutated");
  assert.deepEqual(citySearchTermsForCountry("unknown"), []);
});
