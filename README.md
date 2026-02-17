# Simplify

Modern landing page for the Simplify eSIM marketplace. Built with Next.js, TypeScript, Tailwind CSS, Radix Themes, Sanity v3, and subtle motion.

## Getting started

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

## Airalo catalog sync

The Airalo catalog can be synchronized into the local database with a dedicated script. Configure the following environment variables with your partner credentials:

```
AIRALO_CLIENT_ID=<airalo-client-id>
AIRALO_CLIENT_SECRET=<airalo-client-secret>
# Optional: force credential passthrough on every /packages request.
# The client also auto-retries with credential passthrough after an auth-rejected 401.
AIRALO_PACKAGES_SEND_CREDENTIALS=true
```

Then run the sync script:

```bash
npx tsx scripts/sync-airalo-packages.ts
```

Sync package requests default to:
- query params: `limit`, `page` (plus optional filters/include)
- headers: `Accept: application/json` and `Authorization: Bearer <token>`

If needed for partner compatibility, set `AIRALO_PACKAGES_SEND_CREDENTIALS=true` to include `client_id` and `client_secret` on `/packages` requests, or allow the built-in 401 auth-rejection fallback to retry once with those credentials.

> Recommended cadence: execute the script every 60 minutes via cron or a background worker to keep pricing and availability fresh while respecting upstream rate limits.
