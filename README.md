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

Copy `.env.example` to `.env.local` (this file stays out of git thanks to the existing ignore rule) and populate the following values:

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

For production deploys (e.g. Vercel), add the same keys—especially `SANITY_READ_TOKEN`—to your project’s environment-variable configuration so the Next.js server and ISR webhooks can authenticate with Sanity.

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
