import assert from "node:assert/strict";
import test from "node:test";

import { mapAuditResultToLegacySyncResult, mergeAiraloCountryTrees } from "./sync-job";

test("mergeAiraloCountryTrees merges paginated country/operator trees without duplicate packages", () => {
  const merged = mergeAiraloCountryTrees([
    [
      {
        country_code: "US",
        title: "United States",
        operators: [
          {
            id: 10,
            operator_code: "att",
            title: "AT&T",
            packages: [{ id: 1, title: "US 1GB" }, { id: 2, title: "US 2GB" }],
          },
        ],
      },
    ],
    [
      {
        country_code: "US",
        title: "United States",
        operators: [
          {
            id: 10,
            operator_code: "att",
            title: "AT&T",
            packages: [{ id: 2, title: "US 2GB" }, { id: 3, title: "US 3GB" }],
          },
        ],
      },
    ],
  ]);

  assert.equal(merged.length, 1);
  const country = merged[0];
  assert.ok(country);
  assert.equal(country.operators?.length, 1);
  const operator = country.operators?.[0];
  assert.ok(operator);
  assert.equal(operator.packages?.length, 3);
});

test("mapAuditResultToLegacySyncResult returns the package summary unchanged", () => {
  const legacy = mapAuditResultToLegacySyncResult({
    packages: { total: 12, created: 4, updated: 5, unchanged: 3, deactivated: 0 },
  });

  assert.deepEqual(legacy, {
    total: 12,
    created: 4,
    updated: 5,
    unchanged: 3,
    deactivated: 0,
  });
});
