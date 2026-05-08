# Get Packages Endpoint Alignment Review

This review tracks how the Simplify catalog schema and sync job align with the local Airalo `getPackages` OpenAPI export.

## Current status

The previous review stated that the catalog tables were missing. That is no longer true. The current Prisma schema includes:

- `countries`: Airalo country code/slug/title/image metadata.
- `operators`: Airalo operator metadata, coverage, APN, plan type, KYC, rechargeability, roaming, image, and related fields.
- `packages`: Airalo package identity and API fields such as `type`, `title`, `amount`, `data`, `day`, unlimited status, install instructions, fair-usage policy, voice/text, net price, retail price, and multi-currency price maps.
- `package_state`: internal commerce and availability state, kept separate from the API-shaped package row.
- `package_sync_pages`: one row per Airalo page response, including `links`, `meta`, `pricing`, country count, and the complete raw page payload.

## Sync contract

- Scheduled syncs call `GET /v2/packages` hourly.
- The request includes `Authorization: Bearer <token>` and `Accept: application/json`.
- Scheduled syncs intentionally use `include=topup` and `limit=100` with pagination instead of the no-limit full-catalog response. This keeps serverless memory predictable while still following the Airalo pagination contract.
- Pagination follows `links.next`, `meta.current_page`, and `meta.last_page`; it does not infer completion from the number of countries returned.
- Missing packages from a full unfiltered sync are marked inactive in `package_state`.
- Every raw Airalo page response is stored in `package_sync_pages.raw_payload_json` for audit/debug replay.

## Rate limits

The local Airalo export identifies the package endpoint limit as 80 requests per minute per authentication token. Simplify keeps an internal sync pacing limit of 40 requests per minute for unattended catalog jobs. This is intentionally conservative and still far above the hourly scheduler's normal needs.

## Notes for future changes

- Keep the Airalo API-shaped package data in `packages`; put Simplify-specific selling state in `package_state`.
- When adding fields from the OpenAPI export, prefer first-class columns for documented package/operator fields and JSON columns for nested provider blobs.
- Keep regression coverage for page 2+ indexed country responses, global packages with missing `country_code`, multi-currency pricing, fair-usage policies, voice/text plans, raw snapshots, and stale-package deactivation.
