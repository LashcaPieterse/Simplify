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
  Order,
  OrderResponse,
  Package,
  PackagesResponse,
  Sim,
  SimInstallationInstructionsPayload,
  SimResponse,
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
  sendClientCredentialsWithPackages?: boolean;
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

export interface AiraloPackagePriceMap {
  [currency: string]: number | string | null | undefined;
}

export interface AiraloPackageNode {
  id?: number | string;
  slug?: string;
  title?: string;
  name?: string;
  price?: number;
  day?: number;
  data?: string;
  amount?: number | string;
  is_unlimited?: boolean;
  isUnlimited?: boolean;
  currency?: string;
  validity?: number;
  short_info?: string;
  qr_installation?: string;
  manual_installation?: string;
  is_fair_usage_policy?: boolean;
  fair_usage_policy?: string;
  image?: { url?: string | null } | null;
  prices?: {
    net_price?: AiraloPackagePriceMap;
    recommended_retail_price?: AiraloPackagePriceMap;
  } | null;
  [key: string]: unknown;
}

export interface AiraloOperatorNode {
  id?: number | string;
  operator_code?: string;
  title?: string;
  name?: string;
  packages?: AiraloPackageNode[];
  [key: string]: unknown;
}

export interface AiraloCountryNode {
  country_code?: string;
  slug?: string;
  title?: string;
  region?: string | null;
  image?: { url?: string | null } | null;
  operators?: AiraloOperatorNode[];
  [key: string]: unknown;
}

type PackagesRawResponse = { data?: unknown };

function isCountryTree(data: unknown): data is AiraloCountryNode[] {
  return (
    Array.isArray(data) &&
    data.every((country) => country !== null && typeof country === "object")
  );
}

function normalizePackagesData(data: unknown): Package[] {
  // New API shape: array of countries, each with operators[].packages[]
  if (isCountryTree(data)) {
    const flattened: Package[] = [];
    for (const country of data) {
      const destination = country.country_code ?? country.slug ?? country.title ?? "unknown";
      const destinationName = country.title ?? country.slug ?? destination;
      for (const operator of country.operators ?? []) {
        for (const pkg of operator.packages ?? []) {
          const netPrices =
            pkg?.prices?.net_price && typeof pkg.prices.net_price === "object"
              ? Object.fromEntries(
                  Object.entries(pkg.prices.net_price).map(([currency, amount]) => [
                    currency,
                    { amount: typeof amount === "number" ? amount : Number(amount) },
                  ]),
                )
              : undefined;

          const rrps =
            pkg?.prices?.recommended_retail_price && typeof pkg.prices.recommended_retail_price === "object"
              ? Object.fromEntries(
                  Object.entries(pkg.prices.recommended_retail_price).map(([currency, amount]) => [
                    currency,
                    { amount: typeof amount === "number" ? amount : Number(amount) },
                  ]),
                )
              : undefined;

          flattened.push({
            id: String(pkg?.id ?? pkg?.slug ?? pkg?.title ?? destination),
            name: pkg?.title ?? pkg?.name ?? "Unknown",
            destination,
            destination_name: destinationName,
            region: country.region ?? country.title ?? undefined,
            currency: (pkg as Record<string, unknown>).currency?.toString() ?? "USD",
            price: typeof pkg?.price === "number" ? pkg.price : undefined,
            validity: typeof pkg?.day === "number" ? pkg.day : undefined,
            data_amount: pkg?.data ?? (pkg?.is_unlimited ? "Unlimited" : pkg?.amount ? String(pkg.amount) : undefined),
            is_unlimited: Boolean(pkg?.is_unlimited),
            net_prices: netPrices,
            recommended_retail_prices: rrps,
            sku: pkg?.id ? String(pkg.id) : undefined,
            status: (pkg as Record<string, unknown>).status?.toString(),
            sim_type: (pkg as Record<string, unknown>).sim_type?.toString(),
            is_rechargeable: Boolean((pkg as Record<string, unknown>).is_rechargeable ?? false),
            network_types: Array.isArray((pkg as Record<string, unknown>).network_types)
              ? ((pkg as Record<string, unknown>).network_types as unknown[]).map((n) => n?.toString?.() ?? "")
              : undefined,
            voice:
              typeof (pkg as Record<string, unknown>).voice === "number"
                ? Number((pkg as Record<string, unknown>).voice)
                : undefined,
            sms:
              typeof (pkg as Record<string, unknown>).sms === "number"
                ? Number((pkg as Record<string, unknown>).sms)
                : undefined,
            apn: (pkg as Record<string, unknown>).apn?.toString(),
            qr_code_data: (pkg as Record<string, unknown>).qr_code_data?.toString(),
            qr_code_url: (pkg as Record<string, unknown>).qr_code_url?.toString(),
            smdp_address: (pkg as Record<string, unknown>).smdp_address?.toString(),
            iccid: (pkg as Record<string, unknown>).iccid?.toString(),
            activation_code: (pkg as Record<string, unknown>).activation_code?.toString(),
            top_up_parent_package_id: (pkg as Record<string, unknown>).top_up_parent_package_id
              ? (pkg as Record<string, unknown>).top_up_parent_package_id!.toString()
              : undefined,
          });
        }
      }
    }
    return flattened;
  }

  // Legacy shapes: array of packages or index map
  try {
    const response = PackagesResponseSchema.parse({ data });
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return Object.values(response.data).flatMap((packages) => packages);
  } catch {
    return [];
  }
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

interface AiraloUnauthorizedDetails {
  metaMessage?: string;
  metaCode?: string | number;
  meta?: Record<string, unknown>;
  bodySnippet?: string;
  authRejected?: boolean;
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

// Allow overriding the Airalo API host via env if the default ever changes.
// Docs currently reference /v2/token (no /api prefix).
const DEFAULT_BASE_URL =
  process.env.AIRALO_BASE_URL ?? "https://partners-api.airalo.com/v2";
// Pad token expiry to avoid using near-expired tokens; Airalo issues short-lived tokens.
const DEFAULT_TOKEN_BUFFER_SECONDS = 60;
const DEFAULT_RATE_LIMIT_RETRY_POLICY: RateLimitRetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
};

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(/\/+$/, "");
}

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
  private readonly sendClientCredentialsWithPackages: boolean;

  private inFlightTokenRequest: Promise<string> | null = null;
  private tokenType = "Bearer";

  constructor(options: AiraloClientOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.fetchFn = options.fetchImplementation ?? fetch;
    this.tokenCache = options.tokenCache ?? new MemoryTokenCache();
    this.tokenExpiryBufferSeconds =
      options.tokenExpiryBufferSeconds ?? DEFAULT_TOKEN_BUFFER_SECONDS;
    this.rateLimitRetryPolicy = {
      ...DEFAULT_RATE_LIMIT_RETRY_POLICY,
      ...options.rateLimitRetry,
    };
    this.sendClientCredentialsWithPackages =
      options.sendClientCredentialsWithPackages ??
      process.env.AIRALO_PACKAGES_SEND_CREDENTIALS === "true";
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

    if (this.sendClientCredentialsWithPackages) {
      // Some Airalo partner configurations still require client credentials on package browse
      // requests in addition to bearer tokens (common in Postman collections using form-data).
      // We send them as query params because GET request bodies are not consistently honored.
      searchParams.set("client_id", this.clientId);
      searchParams.set("client_secret", this.clientSecret);
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
    const raw = await this.fetchPackagesRaw(options);
    return normalizePackagesData(raw?.data);
  }

  /**
   * Fetch packages while preserving the raw country/operator/package hierarchy.
   */
  async getPackagesTree(options: GetPackagesOptions = {}): Promise<AiraloCountryNode[]> {
    const raw = await this.fetchPackagesRaw(options);
    const data = raw?.data;
    if (isCountryTree(data)) {
      return data;
    }

    if (data && typeof data === "object") {
      const nestedCountries = (data as { countries?: unknown }).countries;
      if (isCountryTree(nestedCountries)) {
        return nestedCountries;
      }

      const nestedData = (data as { data?: unknown }).data;
      if (isCountryTree(nestedData)) {
        return nestedData;
      }
    }

    const rootCountries = (raw as { countries?: unknown })?.countries;
    if (isCountryTree(rootCountries)) {
      return rootCountries;
    }

    const rootKeys =
      raw && typeof raw === "object" ? Object.keys(raw as Record<string, unknown>) : [];
    const dataKeys =
      data && typeof data === "object" ? Object.keys(data as Record<string, unknown>) : [];

    throw new Error(
      `Unexpected Airalo response shape; expected an array of countries. rootKeys=${rootKeys.join(",")}, dataKeys=${dataKeys.join(",")}`,
    );
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

  /**
   * Fetch packages without strict schema validation so we can tolerate upstream shape changes.
   */
  private async fetchPackagesRaw(options: GetPackagesOptions = {}): Promise<PackagesRawResponse> {
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

    if (this.sendClientCredentialsWithPackages) {
      searchParams.set("client_id", this.clientId);
      searchParams.set("client_secret", this.clientSecret);
    }

    const path = `/packages${searchParams.size ? `?${searchParams.toString()}` : ""}`;
    const url = this.resolveUrl(path);
    const maxAuthAttempts = 3;
    let attemptedBearerCaseFallback = false;
    let preserveTokenTypeForNextAttempt = false;

    console.info("[airalo-sync][step-3][packages] Requesting packages", {
      path,
      maxAuthAttempts,
    });

    for (let attempt = 1; attempt <= maxAuthAttempts; attempt++) {
      const token = await this.getAccessToken(preserveTokenTypeForNextAttempt);
      preserveTokenTypeForNextAttempt = false;

      const response = await this.executeWithRateLimitRetry(() =>
        this.fetchFn(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `${this.tokenType} ${token}`,
          },
        }),
      );

      if (response.ok) {
        const parsed = await this.parseJson(response);
        console.info("[airalo-sync][step-3][packages] Packages request succeeded", {
          status: response.status,
        });
        if (parsed && typeof parsed === "object") {
          return parsed as PackagesRawResponse;
        }

        return { data: undefined };
      }

      const isUnauthorized = response.status === 401;
      if (isUnauthorized && attempt < maxAuthAttempts) {
        const unauthorizedDetails = await this.parseUnauthorizedDetails(response.clone());

        if (attempt > 1 && !attemptedBearerCaseFallback && this.toggleBearerTokenTypeCase()) {
          attemptedBearerCaseFallback = true;
          preserveTokenTypeForNextAttempt = true;
          console.warn(
            "[airalo-sync][step-3][packages] Unauthorized response after token refresh, retrying with alternate bearer scheme casing",
            {
              attempt,
              tokenType: this.tokenType,
              ...unauthorizedDetails,
            },
          );
          continue;
        }

        console.warn("[airalo-sync][step-3][packages] Unauthorized response, clearing cached token and retrying", {
          attempt,
          ...unauthorizedDetails,
        });
        await this.clearCachedToken();
        continue;
      }

      const bodyText = await response.text();
      let body: unknown = bodyText;
      try {
        body = JSON.parse(bodyText);
      } catch {
        // keep raw body when parsing fails
      }

      if (response.status === 401) {
        const unauthorizedDetails = await this.parseUnauthorizedDetailsFromBody(body);

        if (unauthorizedDetails.authRejected) {
          console.error(
            "[airalo-sync][step-3][packages] Access token was rejected after refresh; check AIRALO_CLIENT_ID/AIRALO_CLIENT_SECRET credentials and account permissions for /v2/packages",
            {
              tokenType: this.tokenType,
              ...unauthorizedDetails,
            },
          );
        }

        throw new AiraloError(
          `Packages request failed with status 401${unauthorizedDetails.metaMessage ? `: ${unauthorizedDetails.metaMessage}` : ""}`,
          {
            status: response.status,
            statusText: response.statusText,
            body,
          },
        );
      }

      throw new AiraloError(
        `Packages request failed with status ${response.status}`,
        {
          status: response.status,
          statusText: response.statusText,
          body,
        },
      );
    }

    throw new Error(`Failed to complete request to ${url}`);
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

    const searchParams = new URLSearchParams({ include: "share" });
    const path = `/sims/${encodeURIComponent(iccid)}/instructions?${searchParams.toString()}`;

    return this.request({
      path,
      schema: SimInstallationInstructionsResponseSchema,
      init: {
        headers,
      },
    });
  }

  async getSimInstallationInstructions(
    iccid: string,
    options: { acceptLanguage?: string } = {},
  ): Promise<SimInstallationInstructionsPayload> {
    const response = await this.getSimInstallationInstructionsResponse(iccid, options);
    return response.data;
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
    const maxAuthAttempts = requiresAuth ? 3 : 1;
    let attemptedBearerCaseFallback = false;
    let preserveTokenTypeForNextAttempt = false;

    for (let attempt = 1; attempt <= maxAuthAttempts; attempt++) {
      const response = await this.executeWithRateLimitRetry(async () => {
        const headers = await this.buildHeaders(
          init?.headers,
          requiresAuth,
          preserveTokenTypeForNextAttempt,
        );
        preserveTokenTypeForNextAttempt = false;
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
        if (attempt > 1 && !attemptedBearerCaseFallback && this.toggleBearerTokenTypeCase()) {
          attemptedBearerCaseFallback = true;
          preserveTokenTypeForNextAttempt = true;
          continue;
        }

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
    preserveTokenType = false,
  ): Promise<Headers> {
    const resolvedHeaders = new Headers(headers);

    if (!resolvedHeaders.has("Accept")) {
      resolvedHeaders.set("Accept", "application/json");
    }

    if (requiresAuth && !resolvedHeaders.has("Authorization")) {
      const token = await this.getAccessToken(preserveTokenType);
      resolvedHeaders.set("Authorization", `${this.tokenType} ${token}`);
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

  private async getAccessToken(preserveTokenType = false): Promise<string> {
    const cached = await this.tokenCache.get();
    if (cached && !this.isExpired(cached.expiresAt)) {
      if (!preserveTokenType) {
        this.tokenType = this.normalizeTokenType(cached.tokenType);
      }
      return cached.token.trim();
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
    console.info("[airalo-sync][step-2][token] Requesting Airalo access token");
    const body = new URLSearchParams();
    body.set("client_id", this.clientId);
    body.set("client_secret", this.clientSecret);
    body.set("grant_type", "client_credentials");

    const response = await this.executeWithRateLimitRetry(() =>
      this.fetchFn(`${this.baseUrl}/token`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }),
    );

    if (!response.ok) {
      console.error("[airalo-sync][step-2][token] Token request failed", {
        status: response.status,
        statusText: response.statusText,
      });
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

    console.info("[airalo-sync][step-2][token] Access token received", {
      expiresInSeconds: parsed.data.expires_in,
    });

    const remainingSeconds = Math.max(
      parsed.data.expires_in - this.tokenExpiryBufferSeconds,
      1, // ensure a minimum TTL to prevent tight refresh loops
    );

    const expiresAt = Date.now() + remainingSeconds * 1000;

    const token = parsed.data.access_token.trim();
    this.tokenType = this.normalizeTokenType(parsed.data.token_type);

    const record: TokenCacheRecord = {
      token,
      expiresAt,
      tokenType: this.tokenType,
    };

    await this.tokenCache.set(record);
    recordTokenRefresh("airalo_client");

    return record.token;
  }

  private normalizeTokenType(tokenType: string | undefined): string {
    const normalized = tokenType?.trim();

    if (!normalized || normalized.length === 0) {
      return "Bearer";
    }

    // Airalo has historically returned both "Bearer" and "bearer".
    // Some gateway layers are strict about the canonical header scheme casing,
    // so we normalize bearer-like values to "Bearer".
    if (normalized.toLowerCase() === "bearer") {
      return "Bearer";
    }

    return normalized;
  }

  private toggleBearerTokenTypeCase(): boolean {
    if (this.tokenType === "Bearer") {
      this.tokenType = "bearer";
      return true;
    }

    if (this.tokenType === "bearer") {
      this.tokenType = "Bearer";
      return true;
    }

    return false;
  }

  private isExpired(expiresAt: number): boolean {
    return Date.now() >= expiresAt;
  }

  private resolveUrl(path: string): string {
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }

    const base = this.baseUrl.replace(/\/$/, "");
    const normalisedPath = path.startsWith("/") ? path.slice(1) : path;

    return `${base}/${normalisedPath}`;
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

  private async parseUnauthorizedDetails(response: Response): Promise<AiraloUnauthorizedDetails> {
    const body = await this.tryParseResponseBody(response);
    return this.parseUnauthorizedDetailsFromBody(body);
  }

  private parseUnauthorizedDetailsFromBody(body: unknown): AiraloUnauthorizedDetails {
    if (!body || typeof body !== "object") {
      return {
        bodySnippet: this.stringifyForLog(body),
      };
    }

    const meta = (body as { meta?: unknown }).meta;
    if (!meta || typeof meta !== "object") {
      return {
        bodySnippet: this.stringifyForLog(body),
      };
    }

    const metaRecord = meta as { message?: unknown; code?: unknown } & Record<string, unknown>;
    const metaMessage = typeof metaRecord.message === "string" ? metaRecord.message : undefined;

    return {
      meta: metaRecord,
      metaMessage,
      metaCode:
        typeof metaRecord.code === "string" || typeof metaRecord.code === "number"
          ? metaRecord.code
          : undefined,
      bodySnippet: this.stringifyForLog(body),
      authRejected: Boolean(metaMessage && /authentication failed|verify your client_id and client_secret/i.test(metaMessage)),
    };
  }

  private stringifyForLog(value: unknown): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    try {
      const text = typeof value === "string" ? value : JSON.stringify(value);
      return text.length > 500 ? `${text.slice(0, 500)}...` : text;
    } catch {
      return undefined;
    }
  }

  private async tryParseResponseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
      return undefined;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private async executeWithRateLimitRetry(
    makeRequest: () => Promise<Response>,
  ): Promise<Response> {
    const maxAttempts = this.rateLimitRetryPolicy.maxRetries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await makeRequest();

      const shouldRetry =
        response.status === 429 || response.status >= 500;

      if (!shouldRetry) {
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
    const jitter = Math.floor(Math.random() * 150);

    const retryAfterMs = this.parseRetryAfter(headers.get("Retry-After"));
    const requiredDelay = retryAfterMs ?? 0;

    return Math.max(backoffDelay, requiredDelay) + jitter;
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
