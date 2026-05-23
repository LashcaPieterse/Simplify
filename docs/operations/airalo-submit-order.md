# Airalo Submit Order contract

This document evaluates the upstream "Submit order" (`POST /v2/orders`) and "Submit order async" (`POST /v2/orders-async`) OpenAPI contracts and captures the expectations Simplify must meet to stay compliant with the Airalo Partner API.

Canonical Airalo exports:

- [`../Airalo API/PlaceOrders/SubmitOrder.md`](<../Airalo API/PlaceOrders/SubmitOrder.md>)
- [`../Airalo API/PlaceOrders/SubmitOrderAsync.md`](<../Airalo API/PlaceOrders/SubmitOrderAsync.md>)

## Endpoint summary

| Property             | Requirement                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Method               | `POST`                                                                                                        |
| Paths                | `/v2/orders`, `/v2/orders-async`                                                                              |
| Protocol             | HTTPS only                                                                                                    |
| Headers              | `Accept: application/json`, `Authorization: Bearer <token>`                                                   |
| Request body         | `multipart/form-data`                                                                                         |
| Rate/quantity limits | Airalo accepts `quantity` ≤ 50 per request; Simplify intentionally caps local checkout/order requests at ≤ 10 |

Airalo treats the payload as multipart form fields, so every value (even numeric ones) needs to be encoded as a string.

## Request parameters

| Field                 | Type           | Required | Notes                                                                                                                                                                                                                   |
| --------------------- | -------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quantity`            | string         | ✅       | Airalo max is 50. Simplify validates at max 10 to keep payment, fulfillment, and support handling bounded per checkout.                                                                                                 |
| `package_id`          | string         | ✅       | Use IDs fetched from the catalog sync. Reject stale/unknown IDs before calling Airalo.                                                                                                                                  |
| `type`                | string         | ⚠️       | Only valid value is `"sim"`. When omitted, Airalo defaults to `sim`, but we should still send it for clarity.                                                                                                           |
| `description`         | string         | ⚠️       | Optional identifier/notes for the partner. Simplify uses the local order ID + product summary.                                                                                                                          |
| `brand_settings_name` | string ⁄ null  | ⚠️       | Controls white-label branding when sharing eSIMs. Simplify sends `"Simplify"` on both sync and async order submissions; Airalo must have a matching brand profile configured.                                           |
| `to_email`            | string         | ⚠️       | Provide when Airalo should email the subscriber. Requires `sharing_option[]`.                                                                                                                                           |
| `sharing_option[]`    | array (string) | ⚠️       | Required if `to_email` is set. Valid values: `link`, `pdf`. Send as repeated form keys (e.g., `sharing_option[]=link`).                                                                                                 |
| `copy_address[]`      | array (string) | ⚠️       | Additional recipients for the white-label email. Optional but only valid alongside `to_email`.                                                                                                                          |
| `webhook_url`         | string         | ⚠️       | Optional override for the async callback target. Simplify sends `AIRALO_ASYNC_WEBHOOK_URL` on async requests unless `AIRALO_ASYNC_WEBHOOK_GLOBAL_OPT_IN=true` confirms Airalo has a dashboard-level webhook configured. |

> Implementation detail: keep our schema flexible enough to append new optional fields without breaking form encoding. Upstream occasionally adds eSIM-sharing knobs via additional form keys.

## Response models

### Synchronous `POST /v2/orders` (`200`)

The synchronous endpoint returns the full order payload immediately, including `data.id`, `data.code`, package metadata, installation HTML, and the `sims[]` array with ICCID, QR, APN, and `direct_apple_installation_url` fields.

Simplify stores the provider order identifier from `data.order_id` when present, otherwise `data.id`, in `EsimOrder.orderNumber`. Do not store `data.code` as the primary provider identifier; Airalo documents `GET /v2/orders/{order_id}` against the order ID, while `code` is a display/search value.

The protected direct order API (`app/api/orders/route.ts`) forces `submissionMode: "sync"` and returns the local order identifiers plus the installation payload that the service persists.

### Asynchronous `POST /v2/orders-async` (`202`)

`/v2/orders-async` immediately responds with an acknowledgement envelope rather than the full SIM payload:

- `data.request_id`: NanoID that uniquely identifies the async job. Store this on every order record so webhook delivery and recovery jobs can correlate the eventual order payload.
- `data.accepted_at`: Timestamp string showing when Airalo queued the request.
- `meta.message`: Usually `"success"`, useful for observability dashboards.

No SIM metadata is returned at submission time. Simplify stores the complete async acknowledgement envelope in `airalo_order_snapshots` with source `orders-async` and keeps the `request_id` in `EsimOrder.requestId` while `EsimOrder.orderNumber` remains empty. Once Airalo finishes provisioning, it sends a webhook that includes the provider order ID plus a correlation value. The current handler accepts `payload.data.reference`, `payload.data.request_id`, or `payload.data.requestId` so it remains compatible with the async and future-order docs. At that point Simplify must:

1. Match the webhook via `reference`/`request_id`/`requestId` to update the pending order status.
2. Persist the newly revealed `order_id` so that follow-up operations (`GET /v2/orders/{id}` or `/usage`) work.
3. Store the complete webhook payload in `airalo_order_snapshots` with source `webhook` for replay/debugging.
4. Fetch the full order document via `GET /v2/orders/{order_id}` to hydrate installation payloads (`manual_installation`, `qrcode_installation`, `direct_apple_installation_url`, etc.) when the customer next views the dashboard.

Voice & data plans still include optional `text`, `voice`, `net_price`, and per-platform APN hints when retrieved via the follow-up `GET /v2/orders/{id}` call—keep serializers flexible to store everything the webhook/lookup provides.

## Error responses (`422`)

Airalo surfaces validation errors through the `data` object with field-specific messages plus `meta.message` ("the parameter is invalid"). Common scenarios we must map:

| Scenario              | Field                 | Message sample                                            | Local mitigation                                                                                    |
| --------------------- | --------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Invalid package       | `package_id`          | "The selected package is invalid."                        | Resync catalog; block checkout until resolved.                                                      |
| Quantity > available  | `quantity`            | "SIM quantity is not available. Available quantity: {n}." | Surface remaining quantity to the user and refresh availability cache.                              |
| Quantity > 50         | `quantity`            | "The quantity may not be greater than 50."                | Airalo's upstream maximum is 50, but Simplify blocks local requests above 10 before calling Airalo. |
| Missing brand profile | `brand_settings_name` | "Brand settings name doesn't exist."                      | Offer a fallback unbranded share or force the user to pick a valid brand.                           |

Whenever the API returns a 422, log `order.validation.failed` with the returned field map so support can compare with this table.

## Business rule error codes

Beyond field-level validation, the Partner API responds with structured `code`/`reason` pairs (e.g., `{"code":73,"reason":"The eSIM with iccid … has been recycled"}`) whenever the upstream catalog, wallet, or operator status blocks fulfillment. Simplify must surface these signals directly so support can take the right mitigation:

| Code/Reason                                                    | Upstream meaning                                            | Simplify response                                                                                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `11` – “Insufficient Airalo Credit”                            | Wallet lacks funds to fulfill the order.                    | Raise an actionable error and pause retries until credits are topped up. Emit a distinct metric so on-call can trigger the top-up runbook. |
| `33` – “Insufficient stock” / `reason` contains “out of stock” | Partner inventory for the requested plan is exhausted.      | Throw `OrderOutOfStockError`, stop retries, and mark the catalog entry as unavailable until the next sync.                                 |
| `34` – “Package invalid”                                       | Plan has been withdrawn or the package ID is stale.         | Treat as validation failure and force a catalog refresh before allowing checkout.                                                          |
| `73` – reason references “recycled” ICCIDs                     | ICCID has been recycled and cannot be topped up or re-used. | Surface a `410 Gone` style error so the UI can prompt the user to purchase a fresh plan.                                                   |
| Reason contains “maintenance”                                  | Operator is under scheduled maintenance.                    | Return a 503-style error and flag the SKU so merchandising can pause it temporarily.                                                       |
| Reason contains “checksum”                                     | Payload/ICCID failed checksum validation.                   | Bubble up a validation error instructing support to reissue the SIM.                                                                       |

Maintaining these mappings keeps the integration “on standard” with Airalo’s error reference and allows downstream automation (catalog pausing, wallet top-ups, etc.) to react instantly instead of treating every 4xx as a generic failure.

## Integration checklist

1. **Authentication** – Ensure tokens used for catalog sync are also scoped for `/v2/orders`. Rotate credentials in step with Airalo expectations.
2. **Form encoding** – Use a multipart-capable HTTP client; do not send JSON. Arrays must repeat the field name with `[]` suffix.
3. **Async callback** – Configure `AIRALO_ASYNC_WEBHOOK_URL=https://<domain>/api/airalo/webhooks` unless Airalo has confirmed global opt-in; if global opt-in is confirmed, set `AIRALO_ASYNC_WEBHOOK_GLOBAL_OPT_IN=true`.
4. **Async correlation** – Persist `request_id` from the `202 Accepted` response and map it to `payload.data.reference`, `payload.data.request_id`, or `payload.data.requestId` from the webhook.
5. **Email sharing** – Only send `to_email` when the customer opted in. Always include at least one `sharing_option[]` (`link` is the safest default). Optionally set `copy_address[]` for internal notifications.
6. **Raw snapshots** – Persist full Airalo response/webhook envelopes in `airalo_order_snapshots` for audit, support replay, and schema drift debugging.
7. **Observability** – Continue emitting `airalo_order_requests_total` counters tagged with `result`=`success`/`error` and current reason labels such as `ok`, `validation_failed`, `airalo_error`, `rate_limited`, and mapped Airalo business categories. Deviations from this spec should trigger alerts described in `airalo-runbooks.md`.
8. **Schema drift watch** – Monitor release notes for new properties (e.g., the recently added `direct_apple_installation_url`). When a field appears in the response, persist it even if we do not expose it yet.

Keeping these guardrails in place keeps Simplify "on Standard" with the Airalo Submit Order specification and reduces the chance of regressions when Airalo evolves the endpoint.

## Choosing synchronous vs async submissions

Simplify now supports both Airalo order flows through the shared `createOrder` service (`lib/orders/service.ts`). Use the `submissionMode` option to decide whether the request should hit `/v2/orders-async` (default) or the synchronous `/v2/orders` endpoint. Our application uses the two modes in different contexts:

- **Async (`submissionMode: "async"`)** – This is the default for public checkouts and any background jobs that provision after a payment. The Next.js checkout API (`lib/payments/checkouts.ts`) persists the Airalo `request_id`, waits for the webhook to hydrate ICCID/installation data, and keeps API routes responsive even when Airalo takes a few seconds to fulfill the SIMs.
- **Sync (`submissionMode: "sync"`)** – The protected `app/api/orders/route.ts` now forces synchronous submissions so that internal agents immediately receive the ICCID, Apple install link, and QR data in the response. The order is stored with `orderNumber`, installation payload, and profile rows populated in the same transaction, so the dashboard or support tooling can display everything without waiting for a webhook.

**Rule of thumb:** keep async submissions for any user-facing or high-volume workflow (they reduce timeouts and rely on the webhook state machine), and reserve synchronous submissions for trusted, low-volume tools that must show installation details before the request completes.
