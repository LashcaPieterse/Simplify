# Airalo Submit Order contract

This document evaluates the upstream "Submit order async" OpenAPI contract (`POST /v2/orders-async`) and captures the expectations Simplify must meet to stay compliant with the Airalo Partner API.

## Endpoint summary

| Property | Requirement |
| --- | --- |
| Method | `POST` |
| Path | `/v2/orders-async` |
| Protocol | HTTPS only |
| Headers | `Accept: application/json`, `Authorization: Bearer <token>` |
| Request body | `multipart/form-data` |
| Rate/quantity limits | `quantity` must be ≤ 50 per request |

Airalo treats the payload as multipart form fields, so every value (even numeric ones) needs to be encoded as a string.

## Request parameters

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `quantity` | string | ✅ | Max 50. Validate client-side to avoid 422 responses. |
| `package_id` | string | ✅ | Use IDs fetched from the catalog sync. Reject stale/unknown IDs before calling Airalo. |
| `type` | string | ⚠️ | Only valid value is `"sim"`. When omitted, Airalo defaults to `sim`, but we should still send it for clarity. |
| `description` | string | ⚠️ | Optional identifier/notes for the partner. Simplify uses the local order ID + product summary. |
| `brand_settings_name` | string ⁄ null | ⚠️ | Controls white-label branding when sharing eSIMs. Leave empty for unbranded. |
| `to_email` | string | ⚠️ | Provide when Airalo should email the subscriber. Requires `sharing_option[]`. |
| `sharing_option[]` | array (string) | ⚠️ | Required if `to_email` is set. Valid values: `link`, `pdf`. Send as repeated form keys (e.g., `sharing_option[]=link`). |
| `copy_address[]` | array (string) | ⚠️ | Additional recipients for the white-label email. Optional but only valid alongside `to_email`. |
| `webhook_url` | string | ⚠️ | Optional override for the async callback target. Required per request if the partner isn’t globally opted in. |

> Implementation detail: keep our schema flexible enough to append new optional fields without breaking form encoding. Upstream occasionally adds eSIM-sharing knobs via additional form keys.

## Response model (`202`)

`/v2/orders-async` immediately responds with an acknowledgement envelope rather than the full SIM payload:

- `data.request_id`: NanoID that uniquely identifies the async job. Store this on every order record—it is echoed back as `data.reference` in the webhook payload.
- `data.accepted_at`: Timestamp string showing when Airalo queued the request.
- `meta.message`: Usually `"success"`, useful for observability dashboards.

No SIM metadata is returned at submission time. Once Airalo finishes provisioning, it sends a webhook that includes both `order_id` (the value we previously stored in `orderNumber`) and the original `request_id` reference. At that point Simplify must:

1. Match the webhook via `reference -> requestId` to update the pending order status.
2. Persist the newly revealed `order_id` so that follow-up operations (`GET /v2/orders/{id}` or `/usage`) work.
3. Fetch the full order document via `GET /v2/orders/{order_id}` to hydrate installation payloads (`manual_installation`, `qrcode_installation`, `direct_apple_installation_url`, etc.) when the customer next views the dashboard.

Voice & data plans still include optional `text`, `voice`, `net_price`, and per-platform APN hints when retrieved via the follow-up `GET /v2/orders/{id}` call—keep serializers flexible to store everything the webhook/lookup provides.

## Error responses (`422`)

Airalo surfaces validation errors through the `data` object with field-specific messages plus `meta.message` ("the parameter is invalid"). Common scenarios we must map:

| Scenario | Field | Message sample | Local mitigation |
| --- | --- | --- | --- |
| Invalid package | `package_id` | "The selected package is invalid." | Resync catalog; block checkout until resolved. |
| Quantity > available | `quantity` | "SIM quantity is not available. Available quantity: {n}." | Surface remaining quantity to the user and refresh availability cache. |
| Quantity > 50 | `quantity` | "The quantity may not be greater than 50." | Enforce UI/API guardrails. |
| Missing brand profile | `brand_settings_name` | "Brand settings name doesn't exist." | Offer a fallback unbranded share or force the user to pick a valid brand. |

Whenever the API returns a 422, log `order.validation.failed` with the returned field map so support can compare with this table.

## Business rule error codes

Beyond field-level validation, the Partner API responds with structured `code`/`reason` pairs (e.g., `{"code":73,"reason":"The eSIM with iccid … has been recycled"}`) whenever the upstream catalog, wallet, or operator status blocks fulfillment. Simplify must surface these signals directly so support can take the right mitigation:

| Code/Reason | Upstream meaning | Simplify response |
| --- | --- | --- |
| `11` – “Insufficient Airalo Credit” | Wallet lacks funds to fulfill the order. | Raise an actionable error and pause retries until credits are topped up. Emit a distinct metric so on-call can trigger the top-up runbook. |
| `33` – “Insufficient stock” / `reason` contains “out of stock” | Partner inventory for the requested plan is exhausted. | Throw `OrderOutOfStockError`, stop retries, and mark the catalog entry as unavailable until the next sync. |
| `34` – “Package invalid” | Plan has been withdrawn or the package ID is stale. | Treat as validation failure and force a catalog refresh before allowing checkout. |
| `73` – reason references “recycled” ICCIDs | ICCID has been recycled and cannot be topped up or re-used. | Surface a `410 Gone` style error so the UI can prompt the user to purchase a fresh plan. |
| Reason contains “maintenance” | Operator is under scheduled maintenance. | Return a 503-style error and flag the SKU so merchandising can pause it temporarily. |
| Reason contains “checksum” | Payload/ICCID failed checksum validation. | Bubble up a validation error instructing support to reissue the SIM. |

Maintaining these mappings keeps the integration “on standard” with Airalo’s error reference and allows downstream automation (catalog pausing, wallet top-ups, etc.) to react instantly instead of treating every 4xx as a generic failure.

## Integration checklist

1. **Authentication** – Ensure tokens used for catalog sync are also scoped for `/v2/orders`. Rotate credentials in step with Airalo expectations.
2. **Form encoding** – Use a multipart-capable HTTP client; do not send JSON. Arrays must repeat the field name with `[]` suffix.
3. **Async correlation** – Persist `request_id` from the `202 Accepted` response and map it to `payload.data.reference` from the webhook before fetching the final order payload.
4. **Email sharing** – Only send `to_email` when the customer opted in. Always include at least one `sharing_option[]` (`link` is the safest default). Optionally set `copy_address[]` for internal notifications.
5. **Observability** – Continue emitting `airalo_order_requests_total` counters tagged with `result`=`success`/`error` and `reason` (`validation`, `http_error`, etc.) so deviations from this spec trigger alerts described in `airalo-runbooks.md`.
6. **Schema drift watch** – Monitor release notes for new properties (e.g., the recently added `direct_apple_installation_url`). When a field appears in the response, persist it even if we do not expose it yet.

Keeping these guardrails in place keeps Simplify "on Standard" with the Airalo Submit Order specification and reduces the chance of regressions when Airalo evolves the endpoint.
