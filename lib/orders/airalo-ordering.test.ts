import assert from "node:assert/strict";
import test from "node:test";

import { resolveRequiredAsyncWebhookUrl } from "./airalo-ordering";

const WEBHOOK_ENV_KEYS = [
  "AIRALO_ASYNC_WEBHOOK_URL",
  "AIRALO_ASYNC_WEBHOOK_GLOBAL_OPT_IN",
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
      NEXT_PUBLIC_APP_URL: "https://simplify.example.com",
    },
    () => {
      assert.equal(
        resolveRequiredAsyncWebhookUrl({}),
        "https://hooks.example.com/airalo",
      );
    },
  );
});

test("resolveRequiredAsyncWebhookUrl derives the Airalo webhook from the public app URL", () => {
  withWebhookEnv(
    {
      NEXT_PUBLIC_APP_URL: "https://simplify.example.com/account",
    },
    () => {
      assert.equal(
        resolveRequiredAsyncWebhookUrl({}),
        "https://simplify.example.com/api/airalo/webhooks",
      );
    },
  );
});

test("resolveRequiredAsyncWebhookUrl derives the Airalo webhook from Vercel URL", () => {
  withWebhookEnv(
    {
      VERCEL_URL: "simplify-git-main-example.vercel.app",
    },
    () => {
      assert.equal(
        resolveRequiredAsyncWebhookUrl({}),
        "https://simplify-git-main-example.vercel.app/api/airalo/webhooks",
      );
    },
  );
});

test("resolveRequiredAsyncWebhookUrl skips per-request URLs when global opt-in is set", () => {
  withWebhookEnv(
    {
      AIRALO_ASYNC_WEBHOOK_GLOBAL_OPT_IN: "true",
      NEXT_PUBLIC_APP_URL: "https://simplify.example.com",
    },
    () => {
      assert.equal(resolveRequiredAsyncWebhookUrl({}), null);
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
