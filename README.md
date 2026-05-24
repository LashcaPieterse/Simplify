# Simplify

Modern landing page for the Simplify eSIM marketplace. Built with Next.js, TypeScript, Tailwind CSS, Radix Themes, Sanity v3, and subtle motion.

## Getting started

Use Node.js 20 or newer. The production and CI workflows assume Node 20.

```bash
npm install
npm run dev
```

Then open http://localhost:3000 to explore the experience.

## Sanity Studio

The content for the site lives in Sanity and is managed through the embedded Studio at `/studio`.

### Configure environment variables

Create `.env.local` and populate the following values:

```
SANITY_PROJECT_ID=<your-sanity-project-id>
SANITY_DATASET=production
SANITY_API_VERSION=2025-01-01
SANITY_READ_TOKEN=<sanity-token-with-write-access>
SANITY_STUDIO_BASE_PATH=/studio
SANITY_PREVIEW_SECRET=<long-random-string>
SANITY_WEBHOOK_SECRET=<long-random-string>
```

> Already using `NEXT_PUBLIC_SANITY_PROJECT_ID`/`NEXT_PUBLIC_SANITY_DATASET`? Those environment variables remain supported as a
> fallback, but the app now prefers the server-only `SANITY_*` variants above.

> Tip: Set `SANITY_STUDIO_PREVIEW_BASE_URL` if the Studio is hosted separately and needs to open the live preview on a specific origin.

### Initialise the dataset

Run the seed script to populate the dataset with the homepage sections, products, carriers, bundle, and sample blog posts described in the design brief. This script also uploads illustrative Unsplash imagery for the seeded entries.

```bash
npx tsx scripts/seed.ts
```

### Start the Studio locally

```bash
npx sanity dev --single --studio-config ./sanity.config.ts
```

Alternatively, run the Next.js app (`npm run dev`) and browse to `http://localhost:3000/studio`.

## Database (Supabase/Postgres across environments)

- **Single Prisma schema:** `prisma/schema.prisma` now targets Postgres/Supabase everywhere, backed by the migrations in `prisma/migrations`.
- **Local + production workflow:** point `DATABASE_URL` at your Supabase Postgres URL (include `?sslmode=require`) and run `npx prisma migrate dev` locally to evolve the schema. Deploy the same migrations to Supabase with `npx prisma migrate deploy` once you’re ready.
- **Safety while shipping the MVP:** until you spin up a separate dev Supabase project, be careful not to point your local environment at the production database. As soon as the MVP stabilizes, create a dedicated dev Supabase project (or schema) so you can iterate without touching production data.

## ISR revalidation webhook

Configure a Vercel deploy hook or generic HTTP request webhook in Sanity that POSTs to `/api/revalidate` with the following JSON body:

```json
{
  "_type": "<documentType>",
  "slug": { "current": "<document-slug>" },
  "secret": "<SANITY_WEBHOOK_SECRET>"
}
```

The handler revalidates the homepage, individual country, plan, bundle, and resource routes. Include `paths` if you need to trigger additional revalidation targets.

## Draft previews

- `/api/preview?secret=<SANITY_PREVIEW_SECRET>&slug=/country/namibia` enables preview mode and redirects to the requested slug.
- In Studio, use the “Open preview” document action to open a live preview tab for supported document types.

## Useful commands

- `npm run dev` – start the Next.js dev server.
- `npm run build` – create a production build.
- `npm run start` – serve the production build.
- `npm run lint` – run linting.
- `npm run typecheck` – run TypeScript without emitting files.
- `npm run airalo:test` – run Airalo/order/payment unit tests.
- `npm run security:audit` – report high-severity production dependency advisories.

Dependency advisory triage is tracked in [`docs/operations/dependency-security.md`](docs/operations/dependency-security.md).

## Production access and payment security

Paid order data is protected by authenticated ownership or scoped signed cookies issued during checkout. Configure `NEXTAUTH_SECRET` and `ORDER_ACCESS_SECRET` before accepting guest checkouts. `ORDER_ACCESS_SECRET` can be rotated independently; keep it long and random.

DPO payment IPNs require `DPO_IPN_SECRET` in production. Unsigned IPNs are accepted only outside production for local development. Prometheus metrics at `/api/metrics` require `METRICS_BEARER_TOKEN` in production.

Set these payment and delivery variables before enabling checkout:

```
NEXT_PUBLIC_APP_URL=https://<your-domain>
NEXTAUTH_SECRET=<long-random-string>
ORDER_ACCESS_SECRET=<long-random-string>
DPO_COMPANY_TOKEN=<dpo-company-token>
DPO_SERVICE_TYPE=<dpo-service-type>
DPO_SERVICE_URL=https://secure.3gdirectpay.com/API/v6
DPO_PAYMENT_URL=https://secure.3gdirectpay.com
DPO_IPN_SECRET=<long-random-string>
RESEND_API_KEY=<resend-api-key>
RECEIPT_EMAIL_FROM=receipts@<your-domain>
METRICS_BEARER_TOKEN=<long-random-string>
```

## Airalo catalog sync

The Airalo catalog can be synchronized into the local database with a dedicated script. Configure the following environment variables with your partner credentials:

```
AIRALO_CLIENT_ID=<airalo-client-id>
AIRALO_CLIENT_SECRET=<airalo-client-secret>
# Optional: force credential passthrough on every /packages request.
# The client also auto-retries with credential passthrough after an auth-rejected 401.
AIRALO_PACKAGES_SEND_CREDENTIALS=true
AIRALO_BRAND_SETTINGS_NAME=<exact-airalo-brand-name>
AIRALO_ASYNC_WEBHOOK_URL=https://<your-domain>/api/airalo/webhooks
AIRALO_WEBHOOK_SECRET=<url-safe-random-webhook-secret>
```

`AIRALO_WEBHOOK_SECRET` is required for async orders. Simplify appends it to the
Airalo callback URL as `airalo_webhook_secret` and the webhook endpoint rejects
callbacks that do not include the same token. Airalo's async order docs do not
define a webhook signing header, so this URL token is Simplify's app-level guard
for the public callback endpoint.

Then run the sync script:

```bash
npx tsx scripts/sync-airalo-packages.ts
```

Sync package requests default to:

- query params: `limit=100`, `page`, and `include=topup` for scheduled syncs (plus optional filters)
- headers: `Accept: application/json` and `Authorization: Bearer <token>`

Airalo supports a single full-catalog response when no `limit` is provided, but Simplify intentionally uses paginated syncs. Paging keeps Vercel function memory predictable, preserves each raw response page for audit/debug replay, and handles Airalo's documented page 2+ indexed-country response shape. Pagination follows Airalo `links.next` / `meta.current_page` / `meta.last_page` values instead of inferring completion from country counts.

Deploy pending Prisma migrations with `npx prisma migrate deploy` before or during production releases. If `package_sync_pages.raw_payload_json` is not present yet, the sync job will continue without raw page snapshots and log a warning until the migration is applied.

If needed for partner compatibility, set `AIRALO_PACKAGES_SEND_CREDENTIALS=true` to include `client_id` and `client_secret` on `/packages` requests, or allow the built-in 401 auth-rejection fallback to retry once with those credentials.

Async order submissions always send a per-request `webhook_url`. Simplify uses `AIRALO_ASYNC_WEBHOOK_URL` when configured; otherwise it derives `https://<public-app-domain>/api/airalo/webhooks` from `NEXT_PUBLIC_APP_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, or `VERCEL_URL`.

`AIRALO_BRAND_SETTINGS_NAME` is optional. Leave it empty for unbranded Airalo fulfillment, or set it to the exact brand profile name configured in the Airalo dashboard.

> Recommended cadence: execute the script every 60 minutes via cron or a background worker. The Airalo package endpoint is documented at 80 requests/minute per token; Simplify sync paces itself at 40 requests/minute as a conservative unattended-job limit.
