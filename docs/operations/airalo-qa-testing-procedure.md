# Airalo QA Testing Procedure

This document defines a repeatable QA process for the Airalo integration, including real API validation and release gates.

## 1) Prerequisites

- Airalo partner credentials stored as secrets (never committed):
  - `AIRALO_CLIENT_ID`
  - `AIRALO_CLIENT_SECRET`
  - `AIRALO_BASE_URL` (default `https://partners-api.airalo.com/v2`)
- One dedicated ICCID for read-only smoke checks (optional but recommended):
  - `AIRALO_SMOKE_ICCID`
- Airalo mode handling:
  - There is no local sandbox/production toggle in this app.
  - Airalo must switch account mode on their side (email/request process).

## 2) Test Levels

1. Unit tests
- Run on every PR.
- Validate schema parsing, retry logic, token handling, and fallback behavior.

2. Integration tests (local)
- Run on every PR.
- Includes Airalo client tests with mocked HTTP behavior.

3. Live smoke tests
- Run before deploy and after deploy.
- Uses real credentials and real endpoints in read-only mode (`/token`, `/packages`, optional `/sims/:iccid/usage`, `/sims/:iccid/packages`).

## 3) Standard Commands

Local correctness:

```bash
npx tsc --noEmit
npx tsx --test lib/airalo/client.test.ts
```

Live smoke (with `.env.local`):

```bash
set -a
source .env.local
set +a
npm run airalo:smoke-live
```

Optional SIM checks:

```bash
export AIRALO_SMOKE_ICCID="<known-good-iccid>"
npm run airalo:smoke-live
```

## 4) Release Gates

A release is blocked if any of these fail:

- Typecheck fails.
- Airalo client tests fail.
- Live smoke returns `"ok": false`.
- `airalo_rate_limit_events_total` spikes unexpectedly during smoke.

## 5) Observability Requirements

Monitor and alert on:

- `airalo_endpoint_requests_total` by `endpoint`, `result`, `status`
- `airalo_rate_limit_events_total` by `source`
- `airalo_token_refresh_total`
- `airalo_order_requests_total`
- `airalo_webhook_events_total`

Minimum dashboard panels:

- Token request rate and 429 rate.
- Packages request rate and 429 rate.
- SIM usage/packages request rate and 429 rate.
- Order success/error ratio.

## 6) CI/CD Automation (Recommended)

1. PR pipeline:
- `npx tsc --noEmit`
- `npx tsx --test lib/airalo/client.test.ts`

2. Pre-deploy manual gate:
- Run `npm run airalo:smoke-live` with deployment credentials.

3. Post-deploy canary:
- Re-run `npm run airalo:smoke-live`.
- Block rollout if canary fails.

## 7) Failure Handling

If smoke fails:

1. Capture endpoint stats from smoke output JSON.
2. Check `airalo_endpoint_requests_total` and `airalo_rate_limit_events_total`.
3. If auth-related, rotate credentials and verify cached token recovery.
4. If rate-limit-related, reduce request fan-out and re-run smoke.
5. If persistent, open an Airalo support ticket with timestamps and request IDs.

