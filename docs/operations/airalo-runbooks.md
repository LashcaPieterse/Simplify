# Airalo Operations Runbooks

This document describes the operational playbooks for the Airalo integration, including webhook processing, order creation, and monitoring/alerting guidance. For the canonical API contract that our order flow must satisfy, refer to [`airalo-submit-order.md`](./airalo-submit-order.md).

## Observability Overview

| Signal | Location | Notes |
| --- | --- | --- |
| Prometheus metrics | `GET /api/metrics` | Includes order/webhook counters and histograms. |
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

### Structured Log Events

Logs are emitted as JSON with the `service` field set to `order-service`. Key events include:

- `order.validation.failed` – Validation errors before contacting Airalo.
- `order.package.unavailable` – Order aborted because the package no longer exists locally.
- `airalo.order.create.failed` – Airalo request rejected/errored. Includes latency, Airalo status, and request identifiers when available.
- `airalo.order.create.succeeded` – Successful response from Airalo.
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
    description: "Investigate /api/orders and /api/airalo/webhooks endpoints."
```

### Dashboard Suggestions

- **Order Health Panel**: Plot `rate(airalo_order_requests_total{result="success"}[5m])` vs. `result="error"` to visualise success rate.
- **Webhook Throughput**: Graph `increase(airalo_webhook_events_total[5m])` split by `result` and `event_type`.
- **Latency Heatmap**: Use `airalo_order_request_duration_seconds_bucket` and `airalo_webhook_processing_duration_seconds_bucket` for histograms.
- **Rate Limit Monitor**: Chart `increase(airalo_rate_limit_events_total[15m])` for early warnings.

## Runbooks

### Repeated 5xx Responses

1. **Confirm the alert**: Check the `PublicApiFiveHundreds` alert in Alertmanager/Grafana.
2. **Inspect metrics**: Review `airalo_order_requests_total` and `airalo_webhook_events_total` for concurrent failures.
3. **Review logs**: Search for `order.persistence.failed`, `airalo.order.create.failed`, or `webhook.processing.failed` events.
4. **Mitigation**:
   - If due to Airalo 5xx/429 responses, enable request backoff and contact the partner if sustained.
   - For database failures, check Prisma migrations and database availability.
   - Redeploy if the issue correlates with a recent release.
5. **Post-incident**: Document the cause, add regression tests/alerts if needed.

### Webhook Failures

1. **Identify failing events**: Use the `AiraloWebhookFailure` alert data and inspect `airalo_webhook_events_total{result="error"}`.
2. **Check WebhookEvent table**: Query the latest events to confirm deduplication and payload storage.
3. **Validate signature**: Ensure `AIRALO_WEBHOOK_SECRET` matches Airalo's configuration.
4. **Retry strategy**: Airalo retries on 5xx. Once fixed, confirm retries succeed and mark incidents resolved.
5. **Edge cases**: If payload schema changes, update `WebhookPayloadSchema` accordingly.

### Rate-Limit Breaches

1. **Observe counters**: `airalo_rate_limit_events_total{source="orders"}` indicates client-side limits, `{source="webhooks"}` indicates transaction contention/backoff.
2. **Throttle outbound traffic**: Add jitter/backoff to order creation flows or temporarily reduce throughput.
3. **Notify partners**: Inform Airalo support if limits persist beyond 30 minutes.
4. **Long-term fixes**: Cache data, schedule orders, or request higher rate limits.

### Webhook Replay/Recovery

1. **Locate event**: Search `WebhookEvent` for the stored payload (`eventId` column).
2. **Manual replay**: Repost the saved payload to `/api/airalo/webhooks` using the stored JSON and a valid signature.
3. **Database verification**: Confirm `EsimOrder` status and `UsageSnapshot` records match the payload data.
4. **Close incident**: Update documentation with remediation steps and payload anomalies if any.

## Maintenance Checklist

- Rotate `AIRALO_WEBHOOK_SECRET` regularly and update both the Airalo dashboard and environment variables.
- Ensure `/api/metrics` is scraped by Prometheus (or exposed via an agent) and forwarded to your observability stack.
- Keep Prisma migrations in sync with the webhook persistence schema (particularly `WebhookEvent`).
- Review alert thresholds quarterly based on observed traffic.
