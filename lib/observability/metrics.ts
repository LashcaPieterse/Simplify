import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import { metrics } from "@opentelemetry/api";

type OrderResult = "success" | "error";
type OrderReason =
  | "ok"
  | "validation_failed"
  | "airalo_error"
  | "rate_limited"
  | "persistence_failed"
  | "unexpected"
  | "airalo_out_of_stock"
  | "insufficient_credit"
  | "operator_maintenance"
  | "iccid_recycled"
  | "checksum_failed";

type WebhookResult = "processed" | "duplicate" | "rejected" | "error";

type RateLimitSource = "orders" | "webhooks";

let registry: Registry | null = null;
let countersInitialised = false;

function initialiseRegistry(): Registry {
  if (registry) {
    return registry;
  }

  registry = new Registry();
  collectDefaultMetrics({ register: registry });

  return registry;
}

const meter = metrics.getMeter("simplify-airalo");

let orderRequestCounter: Counter<string>;
let orderRequestDuration: Histogram<string>;
let webhookCounter: Counter<string>;
let webhookDuration: Histogram<string>;
let rateLimitCounter: Counter<string>;
let tokenRefreshCounter: Counter<string>;
let packageSyncGauge: Gauge<string>;
let packageSyncRunCounter: Counter<string>;
const orderOtelCounter = meter.createCounter("airalo.order.requests", {
  description: "Number of order creation attempts.",
});
const orderOtelDuration = meter.createHistogram("airalo.order.request.duration", {
  description: "Latency for order creation requests.",
  unit: "ms",
});
const webhookOtelCounter = meter.createCounter("airalo.webhook.events", {
  description: "Webhook events processed by the application.",
});
const webhookOtelDuration = meter.createHistogram("airalo.webhook.processing.duration", {
  description: "Time taken to process Airalo webhook events.",
  unit: "ms",
});
const rateLimitOtelCounter = meter.createCounter("airalo.rate_limit.events", {
  description: "Rate limit responses observed when communicating with Airalo.",
});
const tokenRefreshOtelCounter = meter.createCounter("airalo.token.refreshes", {
  description: "Number of times the Airalo access token was refreshed.",
});
const packageSyncOtelGauge = meter.createObservableGauge(
  "airalo.package_sync.last_success_timestamp",
  {
    description: "Unix timestamp of the last successful Airalo package sync.",
    unit: "s",
  },
);
let packageSyncLastSuccessTimestamp = 0;

packageSyncOtelGauge.addCallback((observableResult) => {
  observableResult.observe(packageSyncLastSuccessTimestamp);
});

function ensureCounters(): void {
  if (countersInitialised) {
    return;
  }

  const register = initialiseRegistry();

  orderRequestCounter = new Counter({
    name: "airalo_order_requests_total",
    help: "Total number of Airalo order creation attempts.",
    labelNames: ["result", "reason", "status"],
    registers: [register],
  });

  orderRequestDuration = new Histogram({
    name: "airalo_order_request_duration_seconds",
    help: "Duration of Airalo order creation attempts.",
    labelNames: ["result", "reason", "status"],
    buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [register],
  });

  webhookCounter = new Counter({
    name: "airalo_webhook_events_total",
    help: "Count of Airalo webhook events handled.",
    labelNames: ["result", "event_type", "reason"],
    registers: [register],
  });

  webhookDuration = new Histogram({
    name: "airalo_webhook_processing_duration_seconds",
    help: "Time taken to process Airalo webhook events.",
    labelNames: ["result", "event_type", "reason"],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
    registers: [register],
  });

  rateLimitCounter = new Counter({
    name: "airalo_rate_limit_events_total",
    help: "Number of rate limit responses observed when interacting with Airalo.",
    labelNames: ["source"],
    registers: [register],
  });

  tokenRefreshCounter = new Counter({
    name: "airalo_token_refresh_total",
    help: "Number of times a new Airalo access token was requested.",
    labelNames: ["source"],
    registers: [register],
  });

  packageSyncGauge = new Gauge({
    name: "airalo_package_sync_last_success_timestamp",
    help: "Unix timestamp of the last successful Airalo package sync.",
    registers: [register],
  });

  packageSyncRunCounter = new Counter({
    name: "airalo_package_sync_runs_total",
    help: "Number of Airalo package sync attempts.",
    labelNames: ["result"],
    registers: [register],
  });

  countersInitialised = true;
}

export interface RecordOrderMetricsOptions {
  result: OrderResult;
  reason?: OrderReason;
  durationMs: number;
  airaloStatus?: string | number;
}

export function recordOrderMetrics(options: RecordOrderMetricsOptions): void {
  ensureCounters();

  const statusLabel = options.airaloStatus ? String(options.airaloStatus) : "unknown";
  const labels = {
    result: options.result,
    reason: options.reason ?? (options.result === "success" ? "ok" : "unexpected"),
    status: statusLabel,
  } as const;

  orderRequestCounter.labels(labels.result, labels.reason, labels.status).inc();
  orderRequestDuration
    .labels(labels.result, labels.reason, labels.status)
    .observe(options.durationMs / 1000);

  orderOtelCounter.add(1, {
    result: labels.result,
    reason: labels.reason,
    status: labels.status,
  });
  orderOtelDuration.record(options.durationMs, {
    result: labels.result,
    reason: labels.reason,
    status: labels.status,
  });
}

export interface RecordWebhookMetricsOptions {
  eventType: string;
  result: WebhookResult;
  durationMs: number;
  reason?: string;
}

export function recordWebhookMetrics(options: RecordWebhookMetricsOptions): void {
  ensureCounters();

  const labels = {
    result: options.result,
    event_type: options.eventType || "unknown",
    reason: options.reason ?? (options.result === "processed" ? "ok" : "unknown"),
  } as const;

  webhookCounter.labels(labels.result, labels.event_type, labels.reason).inc();
  webhookDuration
    .labels(labels.result, labels.event_type, labels.reason)
    .observe(options.durationMs / 1000);

  webhookOtelCounter.add(1, {
    result: labels.result,
    event_type: labels.event_type,
    reason: labels.reason,
  });
  webhookOtelDuration.record(options.durationMs, {
    result: labels.result,
    event_type: labels.event_type,
    reason: labels.reason,
  });
}

export function recordRateLimit(source: RateLimitSource): void {
  ensureCounters();
  rateLimitCounter.labels(source).inc();
  rateLimitOtelCounter.add(1, { source });
}

type TokenRefreshSource = "airalo_client";

export function recordTokenRefresh(source: TokenRefreshSource): void {
  ensureCounters();
  tokenRefreshCounter.labels(source).inc();
  tokenRefreshOtelCounter.add(1, { source });
}

export function recordPackageSyncSuccess(date: Date = new Date()): void {
  ensureCounters();
  packageSyncLastSuccessTimestamp = Math.floor(date.getTime() / 1000);
  packageSyncGauge.set(packageSyncLastSuccessTimestamp);
}

export function recordPackageSyncResult(result: "success" | "failure"): void {
  ensureCounters();
  packageSyncRunCounter.labels(result).inc();
}

export function getPrometheusRegistry(): Registry {
  return initialiseRegistry();
}
