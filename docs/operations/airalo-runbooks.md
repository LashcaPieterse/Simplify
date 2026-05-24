# Airalo Operations Runbooks

This document describes the operational playbooks for the Airalo integration, including webhook processing, order creation, and monitoring/alerting guidance. For the canonical API contract that our order flow must satisfy, refer to [`airalo-submit-order.md`](./airalo-submit-order.md).

## Observability Overview

| Signal | Location | Notes |
| --- | --- | --- |
| Prometheus metrics | `GET /api/metrics` | Includes order/webhook counters and histograms. Requires `Authorization: Bearer <METRICS_BEARER_TOKEN>` in production. |
| OpenTelemetry metrics | `airalo.*` metric namespace | Emitted via the default SDK (no-op when an exporter is not configured). |
| Structured logs | Application stdout | JSON records with `service: "order-service"`. |

### Prometheus Metrics

| Metric | Type | Labels | Description |
| --- | --- | --- | --- |
| `airalo_order_requests_total` | Counter | `result`, `reason`, `status` | Total order creation attempts and outcome reason. |
| `airalo_order_request_duration_seconds` | Histogram | `result`, `reason`, `status` | Latency for `createOrder` requests. |
| `airalo_webhook_events_total` | Counter | `result`, `event_type`, `reason` | Webhook processing outcomes (processed/duplicate/rejected/error). |
| `airalo_webhook_processing_duration_seconds` | Histogram | `result`, `event_type`, `reason` | Processing time per webhook. |
| `airalo_rate_limit_events_total` | Counter | `source` | Rate-limit observations for orders/webhooks. |
| `airalo_endpoint_requests_total` | Counter | `endpoint`, `result`, `status` | Outbound Airalo endpoint attempts. |
| `airalo_api_errors_total` | Counter | `endpoint`, `status`, `code`, `category`, `retriable` | Classified outbound Airalo API errors. |
| `airalo_token_refresh_total` | Counter | `source` | Airalo token refresh count. |
| `airalo_package_sync_last_success_timestamp` | Gauge | none | Unix timestamp of the last successful package sync. |

### Structured Log Events

Logs are emitted as JSON with the `service` field set to `order-service`. Key events include:

- `order.validation.failed` – Validation errors before contacting Airalo.
- `order.package.unavailable` – Order aborted because the package no longer exists locally.
- `airalo.order.create.failed` – Airalo request rejected/errored. Includes latency, Airalo status, and request identifiers when available.
- `airalo.order.async.accepted` – Successful `/orders-async` acknowledgement.
- `airalo.order.sync.completed` – Successful synchronous `/orders` response.
- `airalo.order.async_fallback_sync` – Async order submission fell back to the synchronous endpoint after an Airalo webhook opt-in error.
- `catalog.package.auto_paused` – Local package state was deactivated after Airalo returned an out-of-stock or invalid-package signal.
- `order.persistence.failed` – Database persistence failures.
- `order.create.completed` – Order fully persisted locally.
- `webhook.*` – Webhook processing lifecycle events (duplicate, processed, failures, etc.).

## Alerting and Dashboards

### Suggested Alert Rules

> These examples use PromQL syntax; adjust thresholds to match production baselines.

```yaml
# alerts/airalo-rules.yaml
- alert: AiraloOrderErrorSpike
  expr: sum by(reason) (increase(airalo_order_requests_total{result="error"}[5m])) > 5
  for: 10m
  labels:
    severity: critical
  annotations:
    summary: "High error rate when creating Airalo orders"
    description: "More than 5 failed order attempts in 5 minutes. Investigate logs for airalo.order.create.failed."

- alert: AiraloWebhookFailure
  expr: increase(airalo_webhook_events_total{result="error"}[5m]) > 0
  for: 5m
  labels:
    severity: high
  annotations:
    summary: "Airalo webhook failures detected"
    description: "Webhook handler returned errors in the last 5 minutes. Review /api/airalo/webhooks logs."

- alert: AiraloRateLimitBreaching
  expr: increase(airalo_rate_limit_events_total[10m]) > 0
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Rate limit responses observed"
    description: "Airalo responded with 429 or transactions are being throttled. Consider backing off or contacting Airalo."

- alert: PublicApiFiveHundreds
  expr: sum(increase(nextjs_api_requests_total{status=~"5.."}[5m])) > 10
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Repeated 5xx responses from Next.js API routes"
    description: "Investigate /api/checkouts, /api/orders, and /api/airalo/webhooks endpoints."
```

### Dashboard Suggestions

- **Order Health Panel**: Plot `rate(airalo_order_requests_total{result="success"}[5m])` vs. `result="error"` to visualise success rate.
- **Webhook Throughput**: Graph `increase(airalo_webhook_events_total[5m])` split by `result` and `event_type`.
- **Latency Heatmap**: Use `airalo_order_request_duration_seconds_bucket` and `airalo_webhook_processing_duration_seconds_bucket` for histograms.
- **Rate Limit Monitor**: Chart `increase(airalo_rate_limit_events_total[15m])` for early warnings. Sources include `orders`, `webhooks`, `token`, `packages`, `sim_usage`, and `sim_packages`.

## Runbooks

### Airalo Catalog Sync Troubleshooting (Vercel)

Use this runbook when `/api/airalo-sync` fails, returns `Unauthorized`, or appears to run without updating package data.

1. **Run endpoint diagnostics where allowed**
   - Production returns 404 for `GET /api/airalo-sync?debug=1` by design. Use Vercel function logs for production failures.
   - On preview/staging deployments, open `GET /api/airalo-sync?debug=1` on the same deployment that is failing.
   - If a cron token is configured, include `x-airalo-sync-key: <AIRALO_SYNC_CRON_TOKEN>` or add `?key=<AIRALO_SYNC_CRON_TOKEN>`.
   - Confirm the response flags and lengths:
     - `airaloClientIdPresent` = `true`
     - `airaloClientSecretPresent` = `true`
     - `databaseUrlPresent` = `true`
     - `airaloBaseUrl` points to the expected API host

2. **Validate Vercel environment scoping**
   - In Vercel, verify all sync variables are set for the correct target environment (`Production`, `Preview`, or both).
   - Required variables for sync:
     - `AIRALO_CLIENT_ID`
     - `AIRALO_CLIENT_SECRET`
     - `DATABASE_URL`
   - Recommended:
     - `AIRALO_SYNC_CRON_TOKEN` (protect endpoint)
     - `AIRALO_SYNC_ALERT_EMAIL` (failure notifications)
     - `AIRALO_BASE_URL` (override default only when needed)

3. **Force a fresh deployment after env changes**
   - Vercel environment updates do not affect already-built deployments.
   - Redeploy and then rerun `/api/airalo-sync?debug=1` in a non-production environment, or inspect production function logs, to confirm new values are loaded.

4. **Check authorization failures (`401`)**
   - If `AIRALO_SYNC_CRON_TOKEN` is set, requests without a matching key are rejected.
   - Verify scheduler configuration includes the same token in either header (`x-airalo-sync-key`) or query (`key`).

5. **Inspect runtime failure signals (`500`)**
   - Review Vercel function logs for `[airalo-sync] Failed to sync Airalo packages`.
   - Confirm alert delivery is configured by setting `AIRALO_SYNC_ALERT_EMAIL` and mail provider secrets.
   - Test database connectivity from the deployment environment (SSL/network rules, not just credentials).

6. **Confirm sync is actually mutating data**
   - After a successful run, inspect the package records in the database and verify `updatedAt` changes.
   - If result payload indicates no changes repeatedly, compare local catalog fields with upstream values to detect mapping drift.

### Repeated 5xx Responses

1. **Confirm the alert**: Check the `PublicApiFiveHundreds` alert in Alertmanager/Grafana.
2. **Inspect metrics**: Review `airalo_order_requests_total` and `airalo_webhook_events_total` for concurrent failures.
3. **Review logs**: Search for `order.persistence.failed`, `airalo.order.create.failed`, `airalo.order.async_fallback_sync`, `catalog.package.auto_paused`, or `webhook.processing.failed` events.
4. **Mitigation**:
   - If due to Airalo 5xx/429 responses, enable request backoff and contact the partner if sustained.
   - For database failures, check Prisma migrations and database availability.
   - Redeploy if the issue correlates with a recent release.
5. **Post-incident**: Document the cause, add regression tests/alerts if needed.

### Webhook Failures

1. **Identify failing events**: Use the `AiraloWebhookFailure` alert data and inspect `airalo_webhook_events_total{result="error"}`.
2. **Check WebhookEvent table**: Query the latest events to confirm deduplication and payload storage.
3. **Validate authentication**: If logs show `webhook.auth.invalid`, ensure async submissions are appending `?airalo_webhook_secret=<AIRALO_WEBHOOK_SECRET>` and that the platform environment contains the same URL-safe token. Airalo's async order docs do not define a signing header, so the URL token is the expected authentication mechanism.
4. **Retry strategy**: Airalo retries on 5xx. Once fixed, confirm retries succeed and mark incidents resolved.
5. **Edge cases**: If payload schema changes, update `WebhookPayloadSchema` accordingly.

### Rate-Limit Breaches

1. **Observe counters**: `airalo_rate_limit_events_total{source="orders"}` indicates client-side limits, `{source="webhooks"}` indicates transaction contention/backoff.
2. **Throttle outbound traffic**: Add jitter/backoff to order creation flows or temporarily reduce throughput.
3. **Notify partners**: Inform Airalo support if limits persist beyond 30 minutes.
4. **Long-term fixes**: Cache data, schedule orders, or request higher rate limits.

### Webhook Replay/Recovery

1. **Locate event**: Search `WebhookEvent` for the stored payload (`eventId` column).
2. **Manual replay**: Repost the saved payload to `/api/airalo/webhooks?airalo_webhook_secret=<AIRALO_WEBHOOK_SECRET>` using the stored JSON.
3. **Database verification**: Confirm `EsimOrder` status and `UsageSnapshot` records match the payload data.
4. **Close incident**: Update documentation with remediation steps and payload anomalies if any.

### Pending Order Recovery Worker

Orders that remain in `pending` without an `orderNumber` or associated `EsimProfile` for more than ten minutes are automatically
re-queried via the scheduled recovery worker. The worker uses `AiraloClient.getOrderById` to pull the latest installation payload,
status, metadata, and usage readings; it then applies the same persistence logic as the webhook handler.

- **Command**: `npm run airalo:recover-orders`
- **Schedule**: run every 5 minutes via cron or your scheduler of choice. Ensure `AIRALO_CLIENT_ID`/`AIRALO_CLIENT_SECRET` are
  available in the worker environment.
- **Signals**:
  - Logs prefixed with `airalo.order.recovery.*` describe the attempt lifecycle (started/completed/failed/alert).
  - The `EsimOrderRecoveryAttempt` table keeps a durable audit trail of success/failure/skip results, including reasons.
- **Alerts**: when Airalo cannot confirm an order for 45 minutes the worker emits `airalo.order.recovery.alert` logs so support
  can follow up with Airalo or issue refunds.

For manual investigations, query `EsimOrderRecoveryAttempt` joined with `EsimOrder` metadata to confirm how many times a record
has been retried and the last observed error message.

## Maintenance Checklist

- Rotate `AIRALO_WEBHOOK_SECRET` regularly and update the platform environment. If any Airalo dashboard webhook URL is used outside per-request async submissions, update that URL too.
- Ensure `/api/metrics` is scraped with `METRICS_BEARER_TOKEN` by Prometheus (or exposed via an agent) and forwarded to your observability stack.
- Keep Prisma migrations in sync with the webhook persistence schema (particularly `WebhookEvent`).
- Review alert thresholds quarterly based on observed traffic.
