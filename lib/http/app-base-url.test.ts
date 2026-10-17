import assert from "node:assert/strict";
import test from "node:test";

import { resolveAppBaseUrl } from "./app-base-url";

test("configured application URL anchors payment callbacks", () => {
  assert.equal(
    resolveAppBaseUrl({
      requestUrl: "https://attacker.example/api/checkouts",
      configuredUrl: "https://sim.africa/storefront/",
      nodeEnv: "production",
    }),
    "https://sim.africa",
  );
});

test("production checkout fails closed without a configured application URL", () => {
  assert.throws(
    () =>
      resolveAppBaseUrl({
        requestUrl: "https://attacker.example/api/checkouts",
        nodeEnv: "production",
      }),
    /must be configured/,
  );
});

test("development can use the server request URL", () => {
  assert.equal(
    resolveAppBaseUrl({
      requestUrl: "http://localhost:3000/api/checkouts?test=1",
      nodeEnv: "development",
    }),
    "http://localhost:3000",
  );
});

test("application URLs reject non-HTTP schemes and credentials", () => {
  assert.throws(
    () =>
      resolveAppBaseUrl({
        requestUrl: "http://localhost:3000/api/checkouts",
        configuredUrl: "javascript:alert(1)",
      }),
    /HTTP or HTTPS/,
  );
  assert.throws(
    () =>
      resolveAppBaseUrl({
        requestUrl: "http://localhost:3000/api/checkouts",
        configuredUrl: "https://user:password@sim.africa",
      }),
    /must not include credentials/,
  );
});
