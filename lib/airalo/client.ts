import type { ZodType, ZodTypeDef } from "zod";
import {
  OrderResponseSchema,
  PackagesResponseSchema,
  SubmitOrderAsyncResponseSchema,
  SimInstallationInstructionsResponseSchema,
  SimResponseSchema,
  TokenResponseSchema,
  UsageResponseSchema,
  WebhookPayloadSchema,
} from "./schemas";
import {
  MemoryTokenCache,
  type TokenCache,
  type TokenCacheRecord,
} from "./token-cache";
import { recordTokenRefresh } from "../observability/metrics";

import type {
  InstallationInstructions,
  Order,
  OrderResponse,
  Package,
  PackagesResponse,
  type Sim,
  type SimResponse,
  SimInstallationInstructionsResponse,
  SubmitOrderAsyncAck,
  SubmitOrderAsyncResponse,
  Usage,
  UsageResponse,
  WebhookPayload,
} from "./schemas";

export interface AiraloClientOptions {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
  tokenCache?: TokenCache;
  tokenExpiryBufferSeconds?: number;
  rateLimitRetry?: Partial<RateLimitRetryPolicy>;
}

type FormValue = string | number | boolean | null | undefined;
type FormValueOrArray = FormValue | FormValue[];

interface AdditionalOrderFields {
  [key: string]: FormValueOrArray;
}

export interface CreateOrderPayload extends AdditionalOrderFields {
  package_id: string;
  quantity?: FormValue;
  type?: FormValue;
  description?: FormValue;
  brand_settings_name?: FormValue;
  to_email?: FormValue;
  "sharing_option[]"?: FormValue[];
  "copy_address[]"?: FormValue[];
}

type QueryParamValue = string | number | boolean | null | undefined;

export type PackageTypeFilter = "local" | "global";

export interface GetPackagesFilters {
  type?: PackageTypeFilter;
  country?: string;
}

export interface GetPackagesOptions {
  filter?: GetPackagesFilters;
  includeTopUp?: boolean;
  include?: string | string[];
  limit?: number;
  page?: number;
  extraParams?: Record<string, QueryParamValue>;
}

function normalizePackagesData(
  data: PackagesResponse["data"],
): Package[] {
  if (Array.isArray(data)) {
    return data;
  }

  return Object.values(data).flatMap((packages) => packages);
}

export interface GetUsageOptions {
  iccid?: string;
  orderId?: string;
}

export interface GetSimOptions {
  include?: string | string[];
}

interface AiraloRequestOptions<T> {
  path: string;
  schema: ZodType<T, ZodTypeDef, unknown>;
  init?: RequestInit;
  requiresAuth?: boolean;
}

export interface AiraloErrorDetails {
  status: number;
  statusText: string;
  body?: unknown;
}

export class AiraloError extends Error {
  readonly details: AiraloErrorDetails;

  constructor(message: string, details: AiraloErrorDetails) {
    super(message);
    this.name = "AiraloError";
    this.details = details;
  }
}

const DEFAULT_BASE_URL = "https://partners.airalo.com/api/v2";
const DEFAULT_TOKEN_BUFFER_SECONDS = 30;
const DEFAULT_RATE_LIMIT_RETRY_POLICY: RateLimitRetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
};

interface RateLimitRetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export class AiraloClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly tokenCache: TokenCache;
  private readonly tokenExpiryBufferSeconds: number;
  private readonly rateLimitRetryPolicy: RateLimitRetryPolicy;

  private inFlightTokenRequest: Promise<string> | null = null;

  constructor(options: AiraloClientOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchImplementation ?? fetch;
    this.tokenCache = options.tokenCache ?? new MemoryTokenCache();
    this.tokenExpiryBufferSeconds =
      options.tokenExpiryBufferSeconds ?? DEFAULT_TOKEN_BUFFER_SECONDS;
    this.rateLimitRetryPolicy = {
      ...DEFAULT_RATE_LIMIT_RETRY_POLICY,
      ...options.rateLimitRetry,
    };
  }

  async getPackagesResponse(
    options: GetPackagesOptions = {},
  ): Promise<PackagesResponse> {
    const searchParams = new URLSearchParams();
    this.applyPackageFilters(searchParams, options.filter);

    const includeParam = this.resolvePackageIncludes(options);
    if (includeParam) {
      searchParams.set("include", includeParam);
    }

    if (options.limit !== undefined && options.limit !== null) {
      searchParams.set("limit", String(options.limit));
    }

    if (options.page !== undefined && options.page !== null) {
      searchParams.set("page", String(options.page));
    }

    if (options.extraParams) {
      Object.entries(options.extraParams).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          return;
        }

        searchParams.set(key, String(value));
      });
    }

    const path = `/packages${searchParams.size ? `?${searchParams.toString()}` : ""}`;

    return this.request({
      path,
      schema: PackagesResponseSchema,
    });
  }

  private applyPackageFilters(
    searchParams: URLSearchParams,
    filters: GetPackagesFilters | undefined,
  ): void {
    if (!filters) {
      return;
    }

    if (filters.type) {
      searchParams.set("filter[type]", filters.type);
    }

    if (filters.country) {
      searchParams.set("filter[country]", filters.country);
    }
  }

  private resolvePackageIncludes(options: GetPackagesOptions): string | null {
    const includes: string[] = [];
    const addInclude = (value: string | undefined | null): void => {
      const normalized = value?.trim();
      if (!normalized) {
        return;
      }

      if (!includes.includes(normalized)) {
        includes.push(normalized);
      }
    };

    if (Array.isArray(options.include)) {
      options.include.forEach(addInclude);
    } else if (typeof options.include === "string") {
      addInclude(options.include);
    }

    if (options.includeTopUp) {
      addInclude("top-up");
    }

    if (includes.length === 0) {
      return null;
    }

    return includes.join(",");
  }

  private formatIncludeParam(include?: string | string[] | null): string | null {
    if (!include) {
      return null;
    }

    const includes: string[] = [];
    const addInclude = (value: string | undefined | null): void => {
      const normalized = value?.trim();
      if (!normalized) {
        return;
      }

      if (!includes.includes(normalized)) {
        includes.push(normalized);
      }
    };

    if (Array.isArray(include)) {
      include.forEach(addInclude);
    } else if (typeof include === "string") {
      include.split(",").forEach((segment) => addInclude(segment));
    }

    if (includes.length === 0) {
      return null;
    }

    return includes.join(",");
  }

  async getPackages(options: GetPackagesOptions = {}): Promise<Package[]> {
    const response = await this.getPackagesResponse(options);
    return normalizePackagesData(response.data);
  }

  async getOrderResponseById(orderId: string): Promise<OrderResponse> {
    if (!orderId) {
      throw new Error("An Airalo order ID is required to fetch order details.");
    }

    return this.request({
      path: `/orders/${encodeURIComponent(orderId)}`,
      schema: OrderResponseSchema,
    });
  }

  async getOrderById(orderId: string): Promise<Order> {
    const response = await this.getOrderResponseById(orderId);
    return response.data;
  }

  async createOrderResponse(payload: CreateOrderPayload): Promise<OrderResponse> {
    const body = this.buildMultipartPayload(payload);
    return this.request({
      path: "/orders",
      schema: OrderResponseSchema,
      init: {
        method: "POST",
        body,
      },
    });
  }

  async createOrder(payload: CreateOrderPayload): Promise<Order> {
    const response = await this.createOrderResponse(payload);
    return response.data;
  }

  async createOrderAsyncResponse(payload: CreateOrderPayload): Promise<SubmitOrderAsyncResponse> {
    const body = this.buildMultipartPayload(payload);

    return this.request({
      path: "/orders-async",
      schema: SubmitOrderAsyncResponseSchema,
      init: {
        method: "POST",
        body,
      },
    });
  }

  async createOrderAsync(payload: CreateOrderPayload): Promise<SubmitOrderAsyncAck> {
    const response = await this.createOrderAsyncResponse(payload);
    return response.data;
  }

  async getUsageResponse({
    iccid,
    orderId,
  }: GetUsageOptions): Promise<UsageResponse> {
    const identifier = iccid ?? orderId;

    if (!identifier) {
      throw new Error(
        "An ICCID or order ID is required to request usage information.",
      );
    }

    return this.request({
      path: `/orders/${encodeURIComponent(identifier)}/usage`,
      schema: UsageResponseSchema,
    });
  }

  async getUsage(options: GetUsageOptions): Promise<Usage> {
    const response = await this.getUsageResponse(options);
    return response.data;
  }

  async getSimUsageResponse(iccid: string): Promise<UsageResponse> {
    if (!iccid) {
      throw new Error("An ICCID is required to request SIM usage information.");
    }

    return this.request({
      path: `/sims/${encodeURIComponent(iccid)}/usage`,
      schema: UsageResponseSchema,
    });
  }

  async getSimUsage(iccid: string): Promise<Usage> {
    const response = await this.getSimUsageResponse(iccid);
    return response.data;
  }

  async getSimPackagesResponse(iccid: string): Promise<PackagesResponse> {
    if (!iccid) {
      throw new Error("An ICCID is required to request SIM packages.");
    }

    return this.request({
      path: `/sims/${encodeURIComponent(iccid)}/packages`,
      schema: PackagesResponseSchema,
    });
  }

  async getSimPackages(iccid: string): Promise<Package[]> {
    const response = await this.getSimPackagesResponse(iccid);
    return normalizePackagesData(response.data);
  }

  async getSimInstallationInstructionsResponse(
    iccid: string,
    options: { acceptLanguage?: string } = {},
  ): Promise<SimInstallationInstructionsResponse> {
    if (!iccid) {
      throw new Error("An ICCID is required to request installation instructions.");
    }

    const languageHint = options.acceptLanguage?.trim();
    const headers: Record<string, string> = {
      "Accept-Language": languageHint && languageHint.length > 0 ? languageHint : "en",
    };

    return this.request({
      path: `/sims/${encodeURIComponent(iccid)}/instructions`,
      schema: SimInstallationInstructionsResponseSchema,
      init: {
        headers,
      },
    });
  }

  async getSimInstallationInstructions(
    iccid: string,
    options: { acceptLanguage?: string } = {},
  ): Promise<InstallationInstructions> {
    const response = await this.getSimInstallationInstructionsResponse(iccid, options);
    return response.data.instructions;
  }

  async getSimResponse(iccid: string, options: GetSimOptions = {}): Promise<SimResponse> {
    if (!iccid) {
      throw new Error("A SIM ICCID is required to fetch SIM details.");
    }

    const searchParams = new URLSearchParams();
    const includeParam = this.formatIncludeParam(options.include);
    if (includeParam) {
      searchParams.set("include", includeParam);
    }

    const query = searchParams.toString();
    const path = `/sims/${encodeURIComponent(iccid)}${query ? `?${query}` : ""}`;

    return this.request({
      path,
      schema: SimResponseSchema,
    });
  }

  async getSim(iccid: string, options: GetSimOptions = {}): Promise<Sim> {
    const response = await this.getSimResponse(iccid, options);
    return response.data;
  }

  async clearCachedToken(): Promise<void> {
    await this.tokenCache.clear();
  }

  parseWebhookPayload(payload: unknown): WebhookPayload {
    return WebhookPayloadSchema.parse(payload);
  }

  private buildMultipartPayload(payload: CreateOrderPayload): FormData {
    const form = new FormData();

    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry === undefined || entry === null) {
            return;
          }

          form.append(key, this.stringifyFormValue(entry));
        });
        return;
      }

      form.set(key, this.stringifyFormValue(value));
    });

    return form;
  }

  private stringifyFormValue(value: FormValue): string {
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }

    return String(value);
  }

  private async request<T>({
    path,
    schema,
    init,
    requiresAuth = true,
  }: AiraloRequestOptions<T>): Promise<T> {
    const url = this.resolveUrl(path);
    const maxAuthAttempts = requiresAuth ? 2 : 1;

    for (let attempt = 1; attempt <= maxAuthAttempts; attempt++) {
      const response = await this.executeWithRateLimitRetry(async () => {
        const headers = await this.buildHeaders(init?.headers, requiresAuth);
        const initWithDefaults: RequestInit = {
          method: "GET",
          ...init,
          headers,
        };

        return this.fetchFn(url, initWithDefaults);
      });

      if (response.ok) {
        const parsedBody = await this.parseJson(response);
        return schema.parse(parsedBody);
      }

      const isUnauthorized = requiresAuth && response.status === 401;
      const shouldRetry = isUnauthorized && attempt < maxAuthAttempts;

      if (shouldRetry) {
        await this.clearCachedToken();
        continue;
      }

      throw await this.buildAiraloError(url, response);
    }

    throw new Error(`Failed to complete request to ${url}`);
  }

  private async buildHeaders(
    headers: RequestInit["headers"],
    requiresAuth: boolean,
  ): Promise<Headers> {
    const resolvedHeaders = new Headers(headers);

    if (!resolvedHeaders.has("Accept")) {
      resolvedHeaders.set("Accept", "application/json");
    }

    if (requiresAuth && !resolvedHeaders.has("Authorization")) {
      const token = await this.getAccessToken();
      resolvedHeaders.set("Authorization", `Bearer ${token}`);
    }

    return resolvedHeaders;
  }

  private async buildAiraloError(url: string, response: Response): Promise<AiraloError> {
    const bodyText = await response.text();
    let body: unknown = bodyText;
    try {
      body = JSON.parse(bodyText);
    } catch {
      // keep the raw text when JSON parsing fails
    }

    return new AiraloError(`Request to ${url} failed with status ${response.status}`, {
      status: response.status,
      statusText: response.statusText,
      body,
    });
  }

  private async getAccessToken(): Promise<string> {
    const cached = await this.tokenCache.get();
    if (cached && !this.isExpired(cached.expiresAt)) {
      return cached.token;
    }

    if (!this.inFlightTokenRequest) {
      this.inFlightTokenRequest = this.requestAccessToken();
    }

    try {
      const token = await this.inFlightTokenRequest;
      return token;
    } finally {
      this.inFlightTokenRequest = null;
    }
  }

  private async requestAccessToken(): Promise<string> {
    const formData = new FormData();
    formData.set("client_id", this.clientId);
    formData.set("client_secret", this.clientSecret);
    formData.set("grant_type", "client_credentials");

    const response = await this.executeWithRateLimitRetry(() =>
      this.fetchFn(`${this.baseUrl}/token`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: formData,
      }),
    );

    if (!response.ok) {
      const bodyText = await response.text();
      let body: unknown = bodyText;
      try {
        body = JSON.parse(bodyText);
      } catch {
        // keep as text when parsing fails
      }

      throw new AiraloError(
        `Token request failed with status ${response.status}`,
        {
          status: response.status,
          statusText: response.statusText,
          body,
        },
      );
    }

    const json = await this.parseJson(response);
    const parsed = TokenResponseSchema.parse(json);

    const remainingSeconds = Math.max(
      parsed.data.expires_in - this.tokenExpiryBufferSeconds,
      0,
    );

    const expiresAt = Date.now() + remainingSeconds * 1000;

    const record: TokenCacheRecord = {
      token: parsed.data.access_token,
      expiresAt,
    };

    await this.tokenCache.set(record);
    recordTokenRefresh("airalo_client");

    return record.token;
  }

  private isExpired(expiresAt: number): boolean {
    return Date.now() >= expiresAt;
  }

  private resolveUrl(path: string): string {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }

    return `${this.baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path.replace(/^\//, "")}`;
  }

  private async parseJson(response: Response): Promise<unknown> {
    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch {
      throw new AiraloError("Failed to parse JSON response", {
        status: response.status,
        statusText: response.statusText,
        body: text,
      });
    }
  }

  private async executeWithRateLimitRetry(
    makeRequest: () => Promise<Response>,
  ): Promise<Response> {
    const maxAttempts = this.rateLimitRetryPolicy.maxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await makeRequest();

      if (response.status !== 429) {
        return response;
      }

      if (attempt === maxAttempts) {
        return response;
      }

      const delayMs = this.calculateRetryDelay(attempt, response.headers);
      await this.delay(delayMs);
    }

    // Fallback, though loop should always return.
    return makeRequest();
  }

  private calculateRetryDelay(attempt: number, headers: Headers): number {
    const backoffDelay = Math.min(
      this.rateLimitRetryPolicy.baseDelayMs * 2 ** (attempt - 1),
      this.rateLimitRetryPolicy.maxDelayMs,
    );

    const retryAfterMs = this.parseRetryAfter(headers.get("Retry-After"));
    const requiredDelay = retryAfterMs ?? 0;

    return Math.max(backoffDelay, requiredDelay);
  }

  private parseRetryAfter(value: string | null): number | null {
    if (!value) {
      return null;
    }

    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) {
      return Math.max(0, asNumber) * 1000;
    }

    const asDate = Date.parse(value);
    if (!Number.isNaN(asDate)) {
      const delayMs = asDate - Date.now();
      return delayMs > 0 ? delayMs : 0;
    }

    return null;
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const defaultTokenCache = new MemoryTokenCache();

export { MemoryTokenCache } from "./token-cache";
export type { TokenCache, TokenCacheRecord } from "./token-cache";

export const defaultAiraloClientFactory = (options: AiraloClientOptions): AiraloClient =>
  new AiraloClient(options);

export const parseAiraloWebhookPayload = (payload: unknown): WebhookPayload =>
  WebhookPayloadSchema.parse(payload);

export type {
  Order,
  OrderResponse,
  Package,
  PackagesResponse,
  SubmitOrderAsyncAck,
  SubmitOrderAsyncResponse,
  TokenPayload,
  TokenResponse,
  Usage,
  UsageResponse,
  WebhookPayload,
} from "./schemas";
