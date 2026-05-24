import {
  AiraloClient,
  AiraloError,
  type CreateOrderPayload,
  type CreateTopUpOrderPayload,
  type SubmitOrderAsyncAck,
} from "../airalo/client";
import { extractAiraloBusinessError } from "../airalo/errors";
import type {
  Order as AiraloOrder,
  OrderResponse,
  SubmitOrderAsyncResponse,
} from "../airalo/schemas";
import { resolveSharedTokenCache } from "../airalo/token-cache";
import { logOrderInfo, logOrderWarn } from "../observability/logging";
import { resolveAiraloOrderActivationCode as resolveAiraloInstallActivationCode } from "./airalo-metadata";
import { OrderServiceError } from "./errors";

const ORDER_RATE_LIMIT_RETRY = { attempts: 3, baseDelayMs: 500 };

let cachedAiraloClient: AiraloClient | null = null;

export type OrderSubmissionMode = "async" | "sync";

export type AiraloOrderPackage = {
  id: string;
  airaloPackageId: string;
  title: string;
};

export type AiraloOrderSubmissionResult = {
  resolvedSubmissionMode: OrderSubmissionMode;
  airaloAsyncResponse: SubmitOrderAsyncResponse | null;
  airaloOrderResponse: OrderResponse | null;
  airaloAck: SubmitOrderAsyncAck | null;
  airaloOrder: AiraloOrder | null;
  airaloLatencyMs: number;
};

export type AiraloTopUpOrderSubmissionResult = {
  airaloOrderResponse: OrderResponse;
  airaloOrder: AiraloOrder;
  airaloLatencyMs: number;
};

export function resolveAiraloClient(): AiraloClient {
  if (cachedAiraloClient) {
    return cachedAiraloClient;
  }

  const clientId = process.env.AIRALO_CLIENT_ID;
  const clientSecret = process.env.AIRALO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new OrderServiceError(
      "AIRALO_CLIENT_ID and AIRALO_CLIENT_SECRET must be configured to create orders.",
      500,
    );
  }

  cachedAiraloClient = new AiraloClient({
    clientId,
    clientSecret,
    tokenCache: resolveSharedTokenCache(),
  });

  return cachedAiraloClient;
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeVercelHost(value: unknown): string | null {
  const host = normalizeOptionalString(value);
  if (!host) {
    return null;
  }

  if (/^https?:\/\//i.test(host)) {
    return host;
  }

  return `https://${host}`;
}

function envFlagEnabled(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes"].includes(value.trim().toLowerCase());
}

export function resolveAiraloBrandSettingsName(): string | null {
  return normalizeOptionalString(process.env.AIRALO_BRAND_SETTINGS_NAME);
}

function isLocalWebhookHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized.endsWith(".local")
  ) {
    return true;
  }

  const octets = normalized.split(".").map((part) => Number(part));
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function resolvePublicAppWebhookUrl(): string | null {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    normalizeVercelHost(process.env.VERCEL_PROJECT_PRODUCTION_URL),
    normalizeVercelHost(process.env.VERCEL_URL),
  ];

  for (const candidate of candidates) {
    const configuredUrl = normalizeOptionalString(candidate);
    if (!configuredUrl) {
      continue;
    }

    let url: URL;
    try {
      url = new URL(configuredUrl);
    } catch {
      continue;
    }

    if (!["https:", "http:"].includes(url.protocol)) {
      continue;
    }

    if (isLocalWebhookHost(url.hostname)) {
      continue;
    }

    url.pathname = "/api/airalo/webhooks";
    url.search = "";
    url.hash = "";
    return appendWebhookUrlSecret(url);
  }

  return null;
}

const AIRALO_WEBHOOK_SECRET_QUERY_PARAM = "airalo_webhook_secret";
const AIRALO_WEBHOOK_SECRET_QUERY_PARAMS = [
  AIRALO_WEBHOOK_SECRET_QUERY_PARAM,
  "webhook_secret",
] as const;

function appendWebhookUrlSecret(url: URL): string {
  const secret = normalizeOptionalString(process.env.AIRALO_WEBHOOK_SECRET);
  if (!secret) {
    return url.toString();
  }

  const alreadyHasSecret = AIRALO_WEBHOOK_SECRET_QUERY_PARAMS.some((param) =>
    url.searchParams.has(param),
  );
  if (!alreadyHasSecret) {
    url.searchParams.set(AIRALO_WEBHOOK_SECRET_QUERY_PARAM, secret);
  }

  return url.toString();
}

function resolveAsyncWebhookUrl(options: {
  asyncWebhookUrl?: string | null;
}): string | null {
  const configuredUrl = normalizeOptionalString(
    options.asyncWebhookUrl ?? process.env.AIRALO_ASYNC_WEBHOOK_URL,
  );

  if (!configuredUrl) {
    return null;
  }

  try {
    return appendWebhookUrlSecret(new URL(configuredUrl));
  } catch {
    throw new OrderServiceError(
      "AIRALO_ASYNC_WEBHOOK_URL must be a valid absolute URL.",
      500,
    );
  }
}

function hasGlobalAsyncWebhookOptIn(): boolean {
  return envFlagEnabled(process.env.AIRALO_ASYNC_WEBHOOK_GLOBAL_OPT_IN);
}

export function resolveRequiredAsyncWebhookUrl(options: {
  asyncWebhookUrl?: string | null;
}): string | null {
  const webhookUrl = resolveAsyncWebhookUrl(options);

  if (webhookUrl) {
    return webhookUrl;
  }

  if (hasGlobalAsyncWebhookOptIn()) {
    return null;
  }

  const derivedWebhookUrl = resolvePublicAppWebhookUrl();
  if (derivedWebhookUrl) {
    return derivedWebhookUrl;
  }

  throw new OrderServiceError(
    "AIRALO_ASYNC_WEBHOOK_URL must be configured for async orders unless AIRALO_ASYNC_WEBHOOK_GLOBAL_OPT_IN=true or NEXT_PUBLIC_APP_URL/VERCEL_URL provides a public app URL.",
    500,
  );
}

export function resolveAiraloOrderId(
  order: AiraloOrder | null | undefined,
): string | null {
  if (!order) {
    return null;
  }

  return order.order_id ?? order.id ?? order.code ?? null;
}

function resolveAiraloPrimarySim(order: AiraloOrder | null | undefined) {
  if (!order) {
    return null;
  }

  if (Array.isArray(order.sims) && order.sims.length > 0) {
    return order.sims[0];
  }

  return null;
}

export function resolveAiraloIccid(
  order: AiraloOrder | null | undefined,
): string | null {
  if (!order) {
    return null;
  }

  const primarySim = resolveAiraloPrimarySim(order);
  return order.iccid ?? primarySim?.iccid ?? null;
}

export function resolveAiraloActivationCode(
  order: AiraloOrder | null | undefined,
): string | null {
  return resolveAiraloInstallActivationCode(order);
}

export function resolveAiraloStatus(
  order: AiraloOrder | null | undefined,
): string {
  if (!order) {
    return "pending";
  }

  return order.status ?? "pending";
}

export function buildAiraloOrderPayload(options: {
  pkg: AiraloOrderPackage;
  quantity: number;
  customerEmail?: string | null;
}): CreateOrderPayload {
  const payload: CreateOrderPayload = {
    package_id: options.pkg.airaloPackageId,
    quantity: String(options.quantity),
    type: "sim",
    description: `${options.quantity} x ${options.pkg.title}`,
  };

  const brandSettingsName = resolveAiraloBrandSettingsName();
  if (brandSettingsName) {
    payload.brand_settings_name = brandSettingsName;
  }

  if (options.customerEmail) {
    payload.to_email = options.customerEmail;
    payload["sharing_option[]"] = ["link"];
  }

  return payload;
}

export function buildAiraloTopUpOrderPayload(options: {
  pkg: AiraloOrderPackage;
  iccid: string;
}): CreateTopUpOrderPayload {
  return {
    package_id: options.pkg.airaloPackageId,
    iccid: options.iccid,
    description: `Topup (${options.iccid})`,
  };
}

function shouldFallbackAsyncToSync(error: unknown): boolean {
  if (!(error instanceof AiraloError) || error.details.status !== 422) {
    return false;
  }

  const businessError = extractAiraloBusinessError(error.details.body);
  const signals = [businessError?.reason, businessError?.message, error.message]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .map((value) => value.toLowerCase());

  return signals.some(
    (value) =>
      value.includes("not opted in") ||
      value.includes("no webhook url provided") ||
      value.includes("webhook url"),
  );
}

async function invokeWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  let lastError: unknown;
  while (attempt < ORDER_RATE_LIMIT_RETRY.attempts) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isRateLimit =
        error instanceof AiraloError && error.details.status === 429;
      if (!isRateLimit) {
        throw error;
      }
      const delayMs =
        ORDER_RATE_LIMIT_RETRY.baseDelayMs * 2 ** attempt +
        Math.floor(Math.random() * 150);
      await new Promise((r) => setTimeout(r, delayMs));
      attempt += 1;
    }
  }
  throw lastError;
}

export async function submitAiraloOrder(options: {
  airalo: AiraloClient;
  pkg: AiraloOrderPackage;
  payload: CreateOrderPayload;
  submissionMode: OrderSubmissionMode;
  asyncWebhookUrl: string | null;
}): Promise<AiraloOrderSubmissionResult> {
  const airaloCallStartedAt = Date.now();
  let resolvedSubmissionMode = options.submissionMode;
  let airaloAsyncResponse: SubmitOrderAsyncResponse | null = null;
  let airaloOrderResponse: OrderResponse | null = null;
  let airaloAck: SubmitOrderAsyncAck | null = null;
  let airaloOrder: AiraloOrder | null = null;

  if (resolvedSubmissionMode === "async") {
    try {
      const asyncOrderPayload: CreateOrderPayload = options.asyncWebhookUrl
        ? { ...options.payload, webhook_url: options.asyncWebhookUrl }
        : options.payload;
      airaloAsyncResponse = await invokeWithBackoff(() =>
        options.airalo.createOrderAsyncResponse(asyncOrderPayload),
      );
      airaloAck = airaloAsyncResponse.data;
    } catch (asyncError: unknown) {
      if (!shouldFallbackAsyncToSync(asyncError)) {
        throw asyncError;
      }

      logOrderWarn("airalo.order.async_fallback_sync", {
        packageId: options.pkg.id,
        packageExternalId: options.pkg.airaloPackageId,
        reason:
          asyncError instanceof Error
            ? asyncError.message
            : "Airalo async order endpoint unavailable for this account.",
      });

      resolvedSubmissionMode = "sync";
      airaloOrderResponse = await invokeWithBackoff(() =>
        options.airalo.createOrderResponse(options.payload),
      );
      airaloOrder = airaloOrderResponse.data;
    }
  } else {
    airaloOrderResponse = await invokeWithBackoff(() =>
      options.airalo.createOrderResponse(options.payload),
    );
    airaloOrder = airaloOrderResponse.data;
  }

  return {
    resolvedSubmissionMode,
    airaloAsyncResponse,
    airaloOrderResponse,
    airaloAck,
    airaloOrder,
    airaloLatencyMs: Date.now() - airaloCallStartedAt,
  };
}

export async function submitAiraloTopUpOrder(options: {
  airalo: AiraloClient;
  payload: CreateTopUpOrderPayload;
}): Promise<AiraloTopUpOrderSubmissionResult> {
  const airaloCallStartedAt = Date.now();
  const airaloOrderResponse = await invokeWithBackoff(() =>
    options.airalo.createTopUpOrderResponse(options.payload),
  );

  return {
    airaloOrderResponse,
    airaloOrder: airaloOrderResponse.data,
    airaloLatencyMs: Date.now() - airaloCallStartedAt,
  };
}

export function logAiraloSubmissionSuccess(options: {
  pkg: AiraloOrderPackage;
  submission: AiraloOrderSubmissionResult;
}): void {
  if (
    options.submission.resolvedSubmissionMode === "async" &&
    options.submission.airaloAck
  ) {
    logOrderInfo("airalo.order.async.accepted", {
      packageId: options.pkg.id,
      packageExternalId: options.pkg.airaloPackageId,
      airaloRequestId: options.submission.airaloAck.request_id,
      acceptedAt: options.submission.airaloAck.accepted_at,
      latencyMs: options.submission.airaloLatencyMs,
    });
  } else if (options.submission.airaloOrder) {
    logOrderInfo("airalo.order.sync.completed", {
      packageId: options.pkg.id,
      packageExternalId: options.pkg.airaloPackageId,
      airaloOrderId: resolveAiraloOrderId(options.submission.airaloOrder),
      airaloRequestId:
        options.submission.airaloOrder.order_reference ??
        resolveAiraloOrderId(options.submission.airaloOrder) ??
        null,
      status: resolveAiraloStatus(options.submission.airaloOrder),
      latencyMs: options.submission.airaloLatencyMs,
    });
  }
}

export function logAiraloTopUpSubmissionSuccess(options: {
  pkg: AiraloOrderPackage;
  iccid: string;
  submission: AiraloTopUpOrderSubmissionResult;
}): void {
  logOrderInfo("airalo.order.topup.completed", {
    packageId: options.pkg.id,
    packageExternalId: options.pkg.airaloPackageId,
    iccid: options.iccid,
    airaloOrderId: resolveAiraloOrderId(options.submission.airaloOrder),
    status: options.submission.airaloOrder.status ?? "completed",
    latencyMs: options.submission.airaloLatencyMs,
  });
}
