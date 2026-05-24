import assert from "node:assert/strict";
import test from "node:test";

import {
  authenticateAiraloWebhookRequest,
  readAiraloWebhookUrlSecret,
} from "./webhook-auth";
import { HEAD } from "../../app/api/airalo/webhooks/route";

test("authenticateAiraloWebhookRequest accepts the Airalo URL secret", () => {
  const result = authenticateAiraloWebhookRequest({
    requestUrl:
      "https://simplify.example.com/api/airalo/webhooks?airalo_webhook_secret=secret-123",
    secret: "secret-123",
  });

  assert.deepEqual(result, {
    valid: true,
    method: "url_secret",
    hasUrlSecret: true,
  });
});

test("authenticateAiraloWebhookRequest accepts the compatibility URL secret alias", () => {
  assert.equal(
    readAiraloWebhookUrlSecret(
      "https://simplify.example.com/api/airalo/webhooks?webhook_secret=secret-123",
    ),
    "secret-123",
  );
});

test("authenticateAiraloWebhookRequest rejects missing and incorrect URL secrets", () => {
  assert.deepEqual(
    authenticateAiraloWebhookRequest({
      requestUrl: "https://simplify.example.com/api/airalo/webhooks",
      secret: "secret-123",
    }),
    {
      valid: false,
      method: null,
      hasUrlSecret: false,
    },
  );

  assert.deepEqual(
    authenticateAiraloWebhookRequest({
      requestUrl:
        "https://simplify.example.com/api/airalo/webhooks?airalo_webhook_secret=wrong",
      secret: "secret-123",
    }),
    {
      valid: false,
      method: null,
      hasUrlSecret: true,
    },
  );
});

test("authenticateAiraloWebhookRequest does not require a signature header", () => {
  const result = authenticateAiraloWebhookRequest({
    requestUrl:
      "https://simplify.example.com/api/airalo/webhooks?airalo_webhook_secret=secret-123",
    secret: "secret-123",
  });

  assert.equal(result.valid, true);
  assert.equal(result.method, "url_secret");
});

test("Airalo webhook HEAD liveness check returns 200", async () => {
  const response = await HEAD();

  assert.equal(response.status, 200);
});
