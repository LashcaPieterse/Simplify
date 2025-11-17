import assert from "node:assert/strict";
import test from "node:test";

import { AiraloClient, AiraloError } from "./client";
import type { TokenCache, TokenCacheRecord } from "./token-cache";

class MockTokenCache implements TokenCache {
  private record: TokenCacheRecord | null;
  public clearCount = 0;

  constructor(initialRecord: TokenCacheRecord | null = null) {
    this.record = initialRecord;
  }

  async get(): Promise<TokenCacheRecord | null> {
    return this.record;
  }

  async set(record: TokenCacheRecord): Promise<void> {
    this.record = record;
  }

  async clear(): Promise<void> {
    this.record = null;
    this.clearCount++;
  }
}

function jsonResponse(body: unknown, init: ResponseInit): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return new Response(JSON.stringify(body), { ...init, headers });
}

function authHeader(init?: RequestInit): string | null {
  if (!init?.headers) {
    return null;
  }

  const headers = init.headers instanceof Headers ? init.headers : new Headers(init.headers);
  return headers.get("Authorization");
}

test("AiraloClient clears the cached token and retries once after a 401", async () => {
  const tokenCache = new MockTokenCache({
    token: "stale-token",
    expiresAt: Date.now() + 60_000,
  });
  const authHeaders: Array<string | null> = [];
  let packageCalls = 0;

  const fetchImplementation: typeof fetch = async (url, init) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.includes("packages")) {
      authHeaders.push(authHeader(init));
      packageCalls++;

      if (packageCalls === 1) {
        return jsonResponse({ error: "unauthorized" }, { status: 401 });
      }

      return jsonResponse({ data: [] }, { status: 200 });
    }

    if (target.endsWith("/token")) {
      return jsonResponse(
        { data: { access_token: "fresh-token", expires_in: 3600, token_type: "bearer" } },
        { status: 200 },
      );
    }

    throw new Error(`Unexpected URL ${target}`);
  };

  const client = new AiraloClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  const packages = await client.getPackages();

  assert.equal(packageCalls, 2, "should retry the packages request exactly once");
  assert.deepEqual(packages, []);
  assert.equal(tokenCache.clearCount, 1, "should purge the cached token once");
  assert.deepEqual(authHeaders, ["Bearer stale-token", "Bearer fresh-token"]);
});

test("AiraloClient surfaces an AiraloError when retries are exhausted", async () => {
  const tokenCache = new MockTokenCache({
    token: "expired-token",
    expiresAt: Date.now() + 60_000,
  });
  let packageCalls = 0;

  const fetchImplementation: typeof fetch = async (url) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.includes("packages")) {
      packageCalls++;
      return jsonResponse({ error: "still unauthorized" }, { status: 401 });
    }

    if (target.endsWith("/token")) {
      return jsonResponse(
        {
          data: {
            access_token: `refreshed-${packageCalls}`,
            expires_in: 3600,
            token_type: "bearer",
          },
        },
        { status: 200 },
      );
    }

    throw new Error(`Unexpected URL ${target}`);
  };

  const client = new AiraloClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  await assert.rejects(client.getPackages(), (error: unknown) => {
    assert(error instanceof AiraloError);
    assert.equal(error.details.status, 401);
    return true;
  });

  assert.equal(packageCalls, 2, "should stop after a single retry");
  assert.equal(tokenCache.clearCount, 1, "should only purge the cached token once");
});
