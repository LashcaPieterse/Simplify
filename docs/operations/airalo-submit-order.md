# Airalo Submit Order contract

This document evaluates the upstream "Submit order" OpenAPI contract (`POST /v2/orders`) and captures the expectations Simplify must meet to stay compliant with the Airalo Partner API.

## Endpoint summary

| Property | Requirement |
| --- | --- |
| Method | `POST` |
| Path | `/v2/orders` |
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

> Implementation detail: keep our schema flexible enough to append new optional fields without breaking form encoding. Upstream occasionally adds eSIM-sharing knobs via additional form keys.

## Response model (`200`)

Successful submissions return JSON with the shape:

- `data`
  - Order details: `id`, `code`, `package_id`, `quantity`, `type`, `description`, `esim_type`, `validity`, `package`, `data`, `price`, `currency`, `created_at`, `brand_settings_name`.
  - Installation artifacts: `manual_installation`, `qrcode_installation`, `installation_guides.{lang}`, `direct_apple_installation_url` per SIM (iOS 17.4+ universal link).
  - `sims[]`: array of provisioned SIMs. Each item contains identifiers (`id`, `iccid`, `lpa`, `matching_id`), QR code payload/URL, `apn_type`/`apn_value`, roaming flag, optional `apn` per platform, and `msisdn` for voice/text plans.
- `meta.message`: human-readable success string.

Voice & data packages add optional `text`, `voice`, `net_price`, and may include platform-specific `apn` instructions per SIM. Our Prisma schema already stores these nullable fields; ensure serializers keep them when present to avoid data loss.

## Error responses (`422`)

Airalo surfaces validation errors through the `data` object with field-specific messages plus `meta.message` ("the parameter is invalid"). Common scenarios we must map:

| Scenario | Field | Message sample | Local mitigation |
| --- | --- | --- | --- |
| Invalid package | `package_id` | "The selected package is invalid." | Resync catalog; block checkout until resolved. |
| Quantity > available | `quantity` | "SIM quantity is not available. Available quantity: {n}." | Surface remaining quantity to the user and refresh availability cache. |
| Quantity > 50 | `quantity` | "The quantity may not be greater than 50." | Enforce UI/API guardrails. |
| Missing brand profile | `brand_settings_name` | "Brand settings name doesn't exist." | Offer a fallback unbranded share or force the user to pick a valid brand. |

Whenever the API returns a 422, log `order.validation.failed` with the returned field map so support can compare with this table.

## Integration checklist

1. **Authentication** – Ensure tokens used for catalog sync are also scoped for `/v2/orders`. Rotate credentials in step with Airalo expectations.
2. **Form encoding** – Use a multipart-capable HTTP client; do not send JSON. Arrays must repeat the field name with `[]` suffix.
3. **Email sharing** – Only send `to_email` when the customer opted in. Always include at least one `sharing_option[]` (`link` is the safest default). Optionally set `copy_address[]` for internal notifications.
4. **Observability** – Continue emitting `airalo_order_requests_total` counters tagged with `result`=`success`/`error` and `reason` (`validation`, `http_error`, etc.) so deviations from this spec trigger alerts described in `airalo-runbooks.md`.
5. **Schema drift watch** – Monitor release notes for new properties (e.g., the recently added `direct_apple_installation_url`). When a field appears in the response, persist it even if we do not expose it yet.

Keeping these guardrails in place keeps Simplify "on Standard" with the Airalo Submit Order specification and reduces the chance of regressions when Airalo evolves the endpoint.
