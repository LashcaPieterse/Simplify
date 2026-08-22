import assert from "node:assert/strict";
import test from "node:test";

import { isPrimaryPackageCandidate } from "./sync-catalog";

test("primary catalog package must be an active sim with a positive selling price", () => {
  assert.equal(isPrimaryPackageCandidate({ type: "sim", state: { isActive: true, sellingPriceCents: 700 } }), true);
  assert.equal(isPrimaryPackageCandidate({ type: "sim", state: { isActive: true, sellingPriceCents: 0 } }), false);
  assert.equal(isPrimaryPackageCandidate({ type: "sim", state: { isActive: false, sellingPriceCents: 700 } }), false);
  assert.equal(isPrimaryPackageCandidate({ type: "topup", state: { isActive: true, sellingPriceCents: 700 } }), false);
  assert.equal(isPrimaryPackageCandidate({ type: "sim", state: { isActive: true, sellingPriceCents: null } }), false);
});
