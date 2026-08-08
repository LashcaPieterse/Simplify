import assert from "node:assert/strict";
import test from "node:test";

import { isProductionBuildPhase } from "./build-phase";

test("isProductionBuildPhase detects Next production builds", () => {
  assert.equal(
    isProductionBuildPhase({
      NEXT_PHASE: "phase-production-build",
      NODE_ENV: "production",
    }),
    true,
  );
});

test("isProductionBuildPhase detects npm build lifecycle", () => {
  assert.equal(
    isProductionBuildPhase({
      npm_lifecycle_event: "build",
      NODE_ENV: "production",
    }),
    true,
  );
});

test("isProductionBuildPhase does not treat production runtime as build time", () => {
  assert.equal(isProductionBuildPhase({ NODE_ENV: "production" }), false);
});
