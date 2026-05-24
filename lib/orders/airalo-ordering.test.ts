import assert from "node:assert/strict";
import test from "node:test";

import { resolveRequiredAsyncWebhookUrl } from "./airalo-ordering";

const WEBHOOK_ENV_KEYS = [
  "AIRALO_ASYNC_WEBHOOK_URL",
  "AIRALO_WEBHOOK_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
] as const;

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
      NEXT_PUBLIC_APP_URL: "https://simplify.example.com",
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
      NEXT_PUBLIC_APP_URL: "https://simplify.example.com/account",
    },
    () => {
      assert.equal(
        resolveRequiredAsyncWebhookUrl({}),
        "https://simplify.example.com/api/airalo/webhooks?airalo_webhook_secret=webhook-secret",
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
      VERCEL_URL: "simplify-git-main-example.vercel.app",
    },
    () => {
      assert.equal(
        resolveRequiredAsyncWebhookUrl({}),
        "https://simplify-git-main-example.vercel.app/api/airalo/webhooks?airalo_webhook_secret=webhook-secret",
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
