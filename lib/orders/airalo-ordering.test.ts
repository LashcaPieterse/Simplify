import assert from "node:assert/strict";
import test from "node:test";

import { resolveRequiredAsyncWebhookUrl, submitAiraloOrder } from "./airalo-ordering";
import { AiraloError, type AiraloClient } from "../airalo/client";

const WEBHOOK_ENV_KEYS = [
  "AIRALO_ASYNC_WEBHOOK_URL",
  "AIRALO_WEBHOOK_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
] as const;

test("async-to-sync fallback is limited to an explicit webhook precondition rejection", async (t) => {
  for (const [name, status, body, syncCallsExpected] of [
    ["documented missing opt-in", 422, { reason: "User is not opted in and no webhook URL provided." }, 1],
    ["ambiguous server error", 500, { reason: "webhook URL unavailable" }, 0],
    ["unexpected business error", 422, { code: 53, reason: "User is not opted in" }, 0],
    ["other webhook error", 422, { reason: "Invalid webhook URL" }, 0],
  ] as const) {
    await t.test(name, async () => {
      let asyncCalls = 0;
      let syncCalls = 0;
      const call = () => submitAiraloOrder({
        airalo: {
          createOrderAsyncResponse: async () => {
            asyncCalls++;
            throw new AiraloError("Supplier rejection", { status, statusText: "Error", body });
          },
          createOrderResponse: async () => {
            syncCalls++;
            return { data: { id: "supplier-order" } };
          },
        } as unknown as AiraloClient,
        pkg: { id: "package", airaloPackageId: "supplier-package", title: "Test" },
        payload: { package_id: "supplier-package", quantity: "1" },
        submissionMode: "async", asyncWebhookUrl: "https://hooks.example.com/airalo",
      });
      if (syncCallsExpected) assert.equal((await call()).resolvedSubmissionMode, "sync");
      else await assert.rejects(call);
      assert.equal(asyncCalls, 1);
      assert.equal(syncCalls, syncCallsExpected);
    });
  }
});

function withWebhookEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const original = new Map(
    WEBHOOK_ENV_KEYS.map((key) => [key, process.env[key]] as const),
  );

  for (const key of WEBHOOK_ENV_KEYS) {
    delete process.env[key];
  }

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return fn();
  } finally {
    for (const key of WEBHOOK_ENV_KEYS) {
      const value = original.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("resolveRequiredAsyncWebhookUrl prefers the explicit async webhook URL", () => {
  withWebhookEnv(
    {
      AIRALO_ASYNC_WEBHOOK_URL: "https://hooks.example.com/airalo",
      AIRALO_WEBHOOK_SECRET: "webhook-secret",
      NEXT_PUBLIC_APP_URL: "https://sim-africa.example.com",
    },
    () => {
      assert.equal(
        resolveRequiredAsyncWebhookUrl({}),
        "https://hooks.example.com/airalo?airalo_webhook_secret=webhook-secret",
      );
    },
  );
});

test("resolveRequiredAsyncWebhookUrl derives the Airalo webhook from the public app URL", () => {
  withWebhookEnv(
    {
      AIRALO_WEBHOOK_SECRET: "webhook-secret",
      NEXT_PUBLIC_APP_URL: "https://sim-africa.example.com/account",
    },
    () => {
      assert.equal(
        resolveRequiredAsyncWebhookUrl({}),
        "https://sim-africa.example.com/api/airalo/webhooks?airalo_webhook_secret=webhook-secret",
      );
    },
  );
});

test("resolveRequiredAsyncWebhookUrl appends the shared webhook secret when configured", () => {
  withWebhookEnv(
    {
      AIRALO_ASYNC_WEBHOOK_URL: "https://hooks.example.com/airalo?source=airalo",
      AIRALO_WEBHOOK_SECRET: "webhook-secret",
    },
    () => {
      assert.equal(
        resolveRequiredAsyncWebhookUrl({}),
        "https://hooks.example.com/airalo?source=airalo&airalo_webhook_secret=webhook-secret",
      );
    },
  );
});

test("resolveRequiredAsyncWebhookUrl derives the Airalo webhook from Vercel URL", () => {
  withWebhookEnv(
    {
      AIRALO_WEBHOOK_SECRET: "webhook-secret",
      VERCEL_URL: "sim-africa-git-main-example.vercel.app",
    },
    () => {
      assert.equal(
        resolveRequiredAsyncWebhookUrl({}),
        "https://sim-africa-git-main-example.vercel.app/api/airalo/webhooks?airalo_webhook_secret=webhook-secret",
      );
    },
  );
});

test("resolveRequiredAsyncWebhookUrl requires the Airalo webhook secret", () => {
  withWebhookEnv(
    {
      AIRALO_ASYNC_WEBHOOK_URL: "https://hooks.example.com/airalo",
    },
    () => {
      assert.throws(
        () => resolveRequiredAsyncWebhookUrl({}),
        /AIRALO_WEBHOOK_SECRET must be configured/,
      );
    },
  );
});

test("resolveRequiredAsyncWebhookUrl does not derive localhost webhook URLs", () => {
  withWebhookEnv(
    {
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    },
    () => {
      assert.throws(
        () => resolveRequiredAsyncWebhookUrl({}),
        /AIRALO_ASYNC_WEBHOOK_URL must be configured/,
      );
    },
  );
});

test("resolveRequiredAsyncWebhookUrl does not derive private network webhook URLs", () => {
  withWebhookEnv(
    {
      NEXT_PUBLIC_APP_URL: "http://192.168.1.10:3000",
    },
    () => {
      assert.throws(
        () => resolveRequiredAsyncWebhookUrl({}),
        /AIRALO_ASYNC_WEBHOOK_URL must be configured/,
      );
    },
  );
});
