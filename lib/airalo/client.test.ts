import assert from "node:assert/strict";
import test from "node:test";

import { AiraloClient, AiraloError } from "./client";
import type { AiraloClientOptions } from "./client";
import type { TokenCache, TokenCacheRecord } from "./token-cache";

const RELAXED_TEST_THROTTLING: AiraloClientOptions["endpointThrottling"] = {
  tokenPerMinute: 10_000,
  packagesPerMinutePerToken: 10_000,
  simUsagePerMinutePerIccid: 10_000,
  simUsagePerSecondPerClient: 10_000,
  simPackagesPerMinutePerIccid: 10_000,
};

function createTestClient(options: AiraloClientOptions): AiraloClient {
  return new AiraloClient({
    ...options,
    endpointThrottling: {
      ...RELAXED_TEST_THROTTLING,
      ...options.endpointThrottling,
    },
  });
}

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

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  const packages = await client.getPackages();

  assert.equal(packageCalls, 2, "should retry the packages request exactly once");
  assert.deepEqual(packages, []);
  assert.equal(tokenCache.clearCount, 2, "should clear once on auth failure and once for forced refresh");
  assert.deepEqual(authHeaders, ["Bearer stale-token", "Bearer fresh-token"]);
});

test("AiraloClient reuses a cached token for /packages requests", async () => {
  const tokenCache = new MockTokenCache({
    token: "cached-token",
    expiresAt: Date.now() + 60_000,
    tokenType: "Bearer",
  });
  let tokenCalls = 0;
  let packageCalls = 0;
  let capturedAuthHeader: string | null = null;

  const fetchImplementation: typeof fetch = async (url, init) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.endsWith("/token")) {
      tokenCalls += 1;
      return jsonResponse(
        { data: { access_token: "fresh-token", expires_in: 3600, token_type: "bearer" } },
        { status: 200 },
      );
    }

    if (target.includes("packages")) {
      packageCalls += 1;
      capturedAuthHeader = authHeader(init);
      return jsonResponse({ data: [] }, { status: 200 });
    }

    throw new Error(`Unexpected URL ${target}`);
  };

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  await client.getPackages();

  assert.equal(packageCalls, 1);
  assert.equal(tokenCalls, 0, "should not hit /token when a valid cached token exists");
  assert.equal(capturedAuthHeader, "Bearer cached-token");
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

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  await client.getPackages();

  assert.equal(capturedAuthHeader, "Token fresh-token");
});

test("AiraloClient normalizes bearer token_type casing", async () => {
  const tokenCache = new MockTokenCache();
  let capturedAuthHeader: string | null = null;

  const fetchImplementation: typeof fetch = async (url, init) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.endsWith("/token")) {
      return jsonResponse(
        { data: { access_token: "fresh-token", expires_in: 3600, token_type: "bearer" } },
        { status: 200 },
      );
    }

    if (target.includes("packages")) {
      capturedAuthHeader = authHeader(init);
      return jsonResponse({ data: [] }, { status: 200 });
    }

    throw new Error(`Unexpected URL ${target}`);
  };

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  await client.getPackages();

  assert.equal(capturedAuthHeader, "Bearer fresh-token");
});

test("AiraloClient retries with alternate bearer casing after a second 401", async () => {
  const tokenCache = new MockTokenCache({
    token: "stale-token",
    expiresAt: Date.now() + 60_000,
  });
  const authHeaders: Array<string | null> = [];
  let packageCalls = 0;

  const fetchImplementation: typeof fetch = async (url, init) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.includes("packages")) {
      packageCalls++;
      const header = authHeader(init);
      authHeaders.push(header);

      if (packageCalls === 1) {
        return jsonResponse({ error: "unauthorized-stale" }, { status: 401 });
      }

      if (packageCalls === 2) {
        return jsonResponse({ error: "unauthorized-casing" }, { status: 401 });
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

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  const packages = await client.getPackages();

  assert.deepEqual(packages, []);
  assert.equal(packageCalls, 3, "should attempt stale token, refreshed token, then alternate casing");
  assert.equal(tokenCache.clearCount, 3, "should clear on auth failure and before each forced refresh");
  assert.deepEqual(authHeaders, [
    "Bearer stale-token",
    "Bearer fresh-token",
    "Bearer fresh-token",
  ]);
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

  const client = createTestClient({
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

  assert.equal(packageCalls, 4, "should stop after stale token retry, alternate casing retry, and final retry");
  assert.equal(tokenCache.clearCount, 5, "should clear on auth retries and before each forced refresh");
});

test("AiraloClient retries retriable 422 maintenance errors", async () => {
  const tokenCache = new MockTokenCache({
    token: "cached-token",
    expiresAt: Date.now() + 60_000,
    tokenType: "Bearer",
  });
  let packageCalls = 0;

  const fetchImplementation: typeof fetch = async (url) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.includes("packages")) {
      packageCalls += 1;
      if (packageCalls === 1) {
        return jsonResponse(
          {
            meta: {
              code: 13,
              reason:
                "The requested operator is currently undergoing maintenance. Please try again later.",
            },
          },
          { status: 422 },
        );
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

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  const packages = await client.getPackages();
  assert.deepEqual(packages, []);
  assert.equal(packageCalls, 2, "should retry after a retriable 422 maintenance error");
});

test("AiraloClient does not retry non-retriable 422 checksum errors", async () => {
  const tokenCache = new MockTokenCache({
    token: "cached-token",
    expiresAt: Date.now() + 60_000,
    tokenType: "Bearer",
  });
  let packageCalls = 0;

  const fetchImplementation: typeof fetch = async (url) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.includes("packages")) {
      packageCalls += 1;
      return jsonResponse(
        {
          meta: {
            code: 14,
            reason: "Invalid checksum: iccid mismatch",
          },
        },
        { status: 422 },
      );
    }

    if (target.endsWith("/token")) {
      return jsonResponse(
        { data: { access_token: "fresh-token", expires_in: 3600, token_type: "bearer" } },
        { status: 200 },
      );
    }

    throw new Error(`Unexpected URL ${target}`);
  };

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  await assert.rejects(client.getPackages(), (error: unknown) => {
    assert(error instanceof AiraloError);
    assert.equal(error.details.status, 422);
    assert.equal(error.details.code, 14);
    assert.equal(error.details.category, "checksum_failed");
    assert.equal(error.details.retriable, false);
    return true;
  });

  assert.equal(packageCalls, 1, "should not retry non-retriable 422 errors");
});

test("AiraloClient uses include=topup for package requests", async () => {
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

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  await client.getPackages({
    includeTopUp: true,
    include: ["topup", "topup"],
  });

  assert(requestedUrl, "packages request should have been issued");
  const url = new URL(requestedUrl!);
  assert.equal(url.searchParams.get("include"), "topup");
});

test("AiraloClient rejects unsupported include values for /packages", async () => {
  const tokenCache = new MockTokenCache();

  const fetchImplementation: typeof fetch = async (url) => {
    const target = typeof url === "string" ? url : url.toString();

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

    if (target.includes("packages")) {
      return jsonResponse({ data: [] }, { status: 200 });
    }

    throw new Error(`Unexpected URL ${target}`);
  };

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  await assert.rejects(
    client.getPackages({
      include: ["voice" as unknown as "topup"],
    }),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /Invalid include value "voice"/);
      return true;
    },
  );
});

test("AiraloClient serializes filter[type] and filter[country]", async () => {
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

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  await client.getPackages({
    filter: { type: "local", country: "US" },
    limit: 50,
    page: 2,
  });

  assert(requestedUrl, "packages request should have been issued");
  const url = new URL(requestedUrl!);
  assert.equal(url.searchParams.get("filter[type]"), "local");
  assert.equal(url.searchParams.get("filter[country]"), "US");
  assert.equal(url.searchParams.get("limit"), "50");
  assert.equal(url.searchParams.get("page"), "2");
});

test("AiraloClient getPackagesTreePageRaw returns parsed countries and preserves raw payload", async () => {
  const tokenCache = new MockTokenCache();
  const rawResponse = {
    data: {
      countries: [
        {
          country_code: "US",
          title: "United States",
          operators: [
            {
              id: 11,
              operator_code: "att",
              packages: [{ id: 1001, title: "US 1GB", price: 5 }],
            },
          ],
        },
      ],
    },
    meta: { page: 1 },
  };

  const fetchImplementation: typeof fetch = async (url) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.includes("packages")) {
      return jsonResponse(rawResponse, { status: 200 });
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

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  const page = await client.getPackagesTreePageRaw({ limit: 100, page: 1, includeTopUp: true });
  assert.equal(page.countries.length, 1);
  assert.equal(page.countries[0]?.country_code, "US");
  assert.deepEqual(page.rawResponse, rawResponse);
});

test("AiraloClient getPackagesTreePageRaw supports root-level country arrays", async () => {
  const tokenCache = new MockTokenCache();

  const fetchImplementation: typeof fetch = async (url) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.includes("packages")) {
      return jsonResponse(
        [
          {
            country_code: "ZA",
            title: "South Africa",
            operators: [{ id: 22, operator_code: "mtn", packages: [{ id: 3001, title: "ZA 2GB" }] }],
          },
        ],
        { status: 200 },
      );
    }

    if (target.endsWith("/token")) {
      return jsonResponse(
        { data: { access_token: "fresh-token", expires_in: 3600, token_type: "bearer" } },
        { status: 200 },
      );
    }

    throw new Error(`Unexpected URL ${target}`);
  };

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  const page = await client.getPackagesTreePageRaw();
  assert.equal(page.countries.length, 1);
  assert.equal(page.countries[0]?.country_code, "ZA");
});

test("AiraloClient getPackagesTreePageRaw supports indexed country objects", async () => {
  const tokenCache = new MockTokenCache();

  const fetchImplementation: typeof fetch = async (url) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.includes("packages")) {
      return jsonResponse(
        {
          data: {
            "12": {
              country_code: "KE",
              title: "Kenya",
              operators: [
                {
                  id: 31,
                  operator_code: "safaricom",
                  packages: [{ id: "ke-1gb", title: "KE 1GB", price: 5 }],
                },
              ],
            },
          },
        },
        { status: 200 },
      );
    }

    if (target.endsWith("/token")) {
      return jsonResponse(
        { data: { access_token: "fresh-token", expires_in: 3600, token_type: "bearer" } },
        { status: 200 },
      );
    }

    throw new Error(`Unexpected URL ${target}`);
  };

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  const page = await client.getPackagesTreePageRaw({ page: 2, limit: 100 });
  assert.equal(page.countries.length, 1);
  assert.equal(page.countries[0]?.country_code, "KE");
});

test("AiraloClient getPackages flattens indexed country objects without dropping packages", async () => {
  const tokenCache = new MockTokenCache();

  const fetchImplementation: typeof fetch = async (url) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.includes("packages")) {
      return jsonResponse(
        {
          data: {
            "4": {
              country_code: "NG",
              title: "Nigeria",
              operators: [
                {
                  id: 41,
                  operator_code: "mtn-ng",
                  packages: [
                    { id: "ng-1gb", title: "NG 1GB", price: 3, day: 7, data: "1 GB" },
                    { id: "ng-3gb", title: "NG 3GB", price: 8, day: 30, data: "3 GB" },
                  ],
                },
              ],
            },
          },
        },
        { status: 200 },
      );
    }

    if (target.endsWith("/token")) {
      return jsonResponse(
        { data: { access_token: "fresh-token", expires_in: 3600, token_type: "bearer" } },
        { status: 200 },
      );
    }

    throw new Error(`Unexpected URL ${target}`);
  };

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  const packages = await client.getPackages({ page: 2, limit: 100 });
  assert.equal(packages.length, 2);
  assert.equal(packages[0]?.id, "ng-1gb");
  assert.equal(packages[1]?.id, "ng-3gb");
});

test("AiraloClient getPackages throws on invalid package payload shape", async () => {
  const tokenCache = new MockTokenCache();

  const fetchImplementation: typeof fetch = async (url) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.includes("packages")) {
      return jsonResponse({ data: { unexpected: "shape" } }, { status: 200 });
    }

    if (target.endsWith("/token")) {
      return jsonResponse(
        { data: { access_token: "fresh-token", expires_in: 3600, token_type: "bearer" } },
        { status: 200 },
      );
    }

    throw new Error(`Unexpected URL ${target}`);
  };

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  await assert.rejects(client.getPackages(), (error: unknown) => {
    assert(error instanceof Error);
    assert.match(error.message, /Invalid input|Unexpected Airalo response shape/);
    return true;
  });
});

test("AiraloClient getPackagesResponse validates documented list-packages payload", async () => {
  const tokenCache = new MockTokenCache();

  const fetchImplementation: typeof fetch = async (url) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.includes("packages")) {
      return jsonResponse(
        {
          data: [
            {
              country_code: "US",
              title: "United States",
              operators: [
                {
                  id: 12,
                  operator_code: "att",
                  packages: [{ id: "us-1gb", title: "US 1GB", price: 5 }],
                },
              ],
            },
          ],
          links: {
            first: "https://partners-api.airalo.com/v2/packages?page=1",
            last: "https://partners-api.airalo.com/v2/packages?page=1",
            prev: null,
            next: null,
          },
          meta: {
            message: "success",
            current_page: 1,
            last_page: 1,
            path: "https://partners-api.airalo.com/v2/packages",
            per_page: "100",
            total: 1,
          },
          pricing: {
            discount_percentage: 0,
            model: "default",
          },
        },
        { status: 200 },
      );
    }

    if (target.endsWith("/token")) {
      return jsonResponse(
        { data: { access_token: "fresh-token", expires_in: 3600, token_type: "bearer" } },
        { status: 200 },
      );
    }

    throw new Error(`Unexpected URL ${target}`);
  };

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  const response = await client.getPackagesResponse({ limit: 100, page: 1 });
  assert.equal(Array.isArray(response.data), true);
  assert.equal(response.meta?.current_page, 1);
  assert.equal(response.pricing?.model, "default");
});





test("AiraloClient retries package sync with client credentials after auth-rejected 401", async () => {
  const tokenCache = new MockTokenCache({
    token: "stale-token",
    expiresAt: Date.now() + 60_000,
  });
  const requestedUrls: string[] = [];
  const packageRequestCronHeaders: Array<string | null> = [];
  let packageCalls = 0;

  const fetchImplementation: typeof fetch = async (url, init) => {
    const target = typeof url === "string" ? url : url.toString();

    if (target.includes("packages")) {
      packageCalls += 1;
      requestedUrls.push(target);
      const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);
      packageRequestCronHeaders.push(headers.get("x-airalo-sync-key"));

      if (packageCalls === 1) {
        return jsonResponse(
          {
            data: [],
            meta: {
              message:
                "Authentication failed. This could be due to an expired token, please generate a new token. If the issue persists, verify your client_id and client_secret are correct.",
            },
          },
          { status: 401 },
        );
      }

      return jsonResponse({ data: [] }, { status: 200 });
    }

    if (target.endsWith("/token")) {
      return jsonResponse(
        { data: { access_token: "fresh-token", expires_in: 3600, token_type: "Bearer" } },
        { status: 200 },
      );
    }

    throw new Error(`Unexpected URL ${target}`);
  };

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
  });

  await client.getPackages({ limit: 100, page: 1 });

  assert.equal(packageCalls, 2);
  const first = new URL(requestedUrls[0]!);
  const second = new URL(requestedUrls[1]!);
  assert.equal(first.searchParams.get("client_id"), null);
  assert.equal(first.searchParams.get("client_secret"), null);
  assert.equal(second.searchParams.get("client_id"), "client-id");
  assert.equal(second.searchParams.get("client_secret"), "client-secret");
  assert.equal(first.searchParams.get("page"), "1");
  assert.equal(first.searchParams.get("limit"), "100");
  assert.equal(second.searchParams.get("page"), "1");
  assert.equal(second.searchParams.get("limit"), "100");
  assert.deepEqual(packageRequestCronHeaders, [null, null]);
});

test("AiraloClient can include client credentials on package requests when enabled", async () => {
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
        { data: { access_token: "fresh-token", expires_in: 3600, token_type: "Bearer" } },
        { status: 200 },
      );
    }

    throw new Error(`Unexpected URL ${target}`);
  };

  const client = createTestClient({
    clientId: "client-id",
    clientSecret: "client-secret",
    baseUrl: "https://example.com/api/",
    fetchImplementation,
    tokenCache,
    sendClientCredentialsWithPackages: true,
  });

  await client.getPackages({ limit: 1, page: 1 });

  assert(requestedUrl, "packages request should have been issued");
  const url = new URL(requestedUrl!);
  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("client_secret"), "client-secret");
});
const hasLiveAiraloCredentials = Boolean(
  process.env.AIRALO_CLIENT_ID && process.env.AIRALO_CLIENT_SECRET,
);

test(
  "AiraloClient fetches packages from the live API when env vars are configured",
  { skip: !hasLiveAiraloCredentials },
  async () => {
    const clientId = process.env.AIRALO_CLIENT_ID;
    const clientSecret = process.env.AIRALO_CLIENT_SECRET;

    assert.ok(clientId, "AIRALO_CLIENT_ID must be set for live Airalo API tests");
    assert.ok(clientSecret, "AIRALO_CLIENT_SECRET must be set for live Airalo API tests");

    const client = createTestClient({
      clientId,
      clientSecret,
    });

    const packages = await client.getPackages({ limit: 1 });

    assert.ok(Array.isArray(packages));
    assert.ok(packages.length > 0, "live Airalo API should return at least one package");
    assert.ok(packages[0]?.id, "returned package should include an id");
  },
);


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

  const client = createTestClient({
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
