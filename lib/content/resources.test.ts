import assert from "node:assert/strict";
import test from "node:test";

import { isCurrentResource } from "./resources";

test("evergreen resources remain publishable", () => {
  assert.equal(isCurrentResource({ title: "Pre-flight eSIM checklist", slug: "pre-flight-esim-checklist" }, 2026), true);
});

test("year-stamped travel guides are hidden after their named year", () => {
  assert.equal(isCurrentResource({ title: "2024 coverage guide", slug: "2024-coverage-guide" }, 2026), false);
  assert.equal(isCurrentResource({ title: "2026 coverage guide", slug: "2026-coverage-guide" }, 2026), true);
});
