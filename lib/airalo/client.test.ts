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
  assert.deepEqual(authHeaders, ["Bearer stale-token", "bearer fresh-token"]);
});

test("AiraloClient honors the token_type returned by the token endpoint", async () => {
  const tokenCache = new MockTokenCache();
  let capturedAuthHeader: string | null = null;

  const fetchImplementation: typeof fetch = async (url, init) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.endsWith("/token")) {
      return jsonResponse(
        { data: { access_token: "fresh-token", expires_in: 3600, token_type: "Token" } },
        { status: 200 },
      );
    }

    if (target.includes("packages")) {
      capturedAuthHeader = authHeader(init);
      return jsonResponse({ data: [] }, { status: 200 });
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

  await client.getPackages();

  assert.equal(capturedAuthHeader, "Token fresh-token");
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

test("AiraloClient merges include parameters for package requests", async () => {
  const tokenCache = new MockTokenCache();
  let requestedUrl: string | null = null;

  const fetchImplementation: typeof fetch = async (url) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.includes("packages")) {
      requestedUrl = target;
      return jsonResponse({ data: [] }, { status: 200 });
    }

    if (target.endsWith("/token")) {
      return jsonResponse(
        {
          data: {
            access_token: "fresh-token",
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

  await client.getPackages({
    includeTopUp: true,
    include: ["voice", "sms", "voice", ""],
  });

  assert(requestedUrl, "packages request should have been issued");
  const url = new URL(requestedUrl!);
  assert.equal(url.searchParams.get("include"), "voice,sms,top-up");
});

test("AiraloClient fetches packages from the live API when env vars are configured", async () => {
  const clientId = process.env.AIRALO_CLIENT_ID;
  const clientSecret = process.env.AIRALO_CLIENT_SECRET;

  assert.ok(clientId, "AIRALO_CLIENT_ID must be set for live Airalo API tests");
  assert.ok(clientSecret, "AIRALO_CLIENT_SECRET must be set for live Airalo API tests");

  const client = new AiraloClient({
    clientId,
    clientSecret,
  });

  const packages = await client.getPackages({ limit: 1 });

  assert.ok(Array.isArray(packages));
  assert.ok(packages.length > 0, "live Airalo API should return at least one package");
  assert.ok(packages[0]?.id, "returned package should include an id");
});


test("AiraloClient sends OAuth token requests as form-urlencoded", async () => {
  const tokenCache = new MockTokenCache();
  let tokenContentType: string | null = null;
  let tokenBody = "";

  const fetchImplementation: typeof fetch = async (url, init) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.endsWith("/token")) {
      const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);
      tokenContentType = headers.get("Content-Type");
      tokenBody = init?.body instanceof URLSearchParams ? init.body.toString() : String(init?.body ?? "");
      return jsonResponse(
        { data: { access_token: "fresh-token", expires_in: 3600, token_type: "bearer" } },
        { status: 200 },
      );
    }

    if (target.includes("packages")) {
      return jsonResponse({ data: [] }, { status: 200 });
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

  await client.getPackages();

  assert.equal(tokenContentType, "application/x-www-form-urlencoded");
  assert.equal(
    tokenBody,
    "client_id=client-id&client_secret=client-secret&grant_type=client_credentials",
  );
});
