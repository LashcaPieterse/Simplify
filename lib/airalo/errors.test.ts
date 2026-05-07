import assert from "node:assert/strict";
import test from "node:test";

import { classifyAiraloError, extractAiraloBusinessError } from "./errors";

test("extractAiraloBusinessError reads code/reason/message from meta", () => {
  const parsed = extractAiraloBusinessError({
    meta: {
      code: 13,
      reason: "The requested operator is currently undergoing maintenance.",
      message: "Try again later.",
    },
  });

  assert.deepEqual(parsed, {
    code: 13,
    reason: "The requested operator is currently undergoing maintenance.",
    message: "Try again later.",
  });
});

test("classifyAiraloError marks code 13 as retriable maintenance", () => {
  const classified = classifyAiraloError({
    status: 422,
    body: { meta: { code: 13, reason: "maintenance" } },
  });

  assert.equal(classified.category, "operator_maintenance");
  assert.equal(classified.retriable, true);
  assert.equal(classified.code, 13);
});

test("classifyAiraloError marks code 14 as non-retriable checksum failure", () => {
  const classified = classifyAiraloError({
    status: 422,
    body: { meta: { code: 14, reason: "Invalid checksum" } },
  });

  assert.equal(classified.category, "checksum_failed");
  assert.equal(classified.retriable, false);
  assert.equal(classified.code, 14);
});

test("classifyAiraloError marks 429 as rate-limited retriable", () => {
  const classified = classifyAiraloError({
    status: 429,
    body: { meta: { message: "Too Many Attempts" } },
  });

  assert.equal(classified.category, "rate_limited");
  assert.equal(classified.retriable, true);
});

test("classifyAiraloError marks 5xx as server_error retriable", () => {
  const classified = classifyAiraloError({
    status: 503,
    body: { meta: { message: "Service Unavailable" } },
  });

  assert.equal(classified.category, "server_error");
  assert.equal(classified.retriable, true);
});
