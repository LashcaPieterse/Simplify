# Editorial service removal rollout

## Export completed

On 2026-10-23, the configured Sanity dataset returned two published posts, zero drafts, and zero release versions. Both posts and both original cover-image files were copied into the repository. Raw source documents, image hashes, and legacy database backups are stored privately in the ignored `docs/audits/sanity-removal-2026-10-23/` directory (owner-only permissions). Keep this archive in protected operational storage; never commit credentials or drafts.

The publishing-state and pricing-audit backups each contained zero rows at export time. Both published slugs are preserved. The 2024 coverage guide remains excluded by the existing current-year policy; the pre-flight checklist remains visible. Confirm that editors have not published additional changes between export and cutover; freeze edits or repeat the export before final deployment if the source changes.

## Local verification completed

- Node 22.22.3: typecheck, lint, and production build passed without content-service environment variables.
- Full unit/integration suite: 337 passed, one live Airalo test skipped. The four production-watchdog Python tests also passed.
- Content and database-removal checks passed, including source metadata/text comparisons, original image hashes, and preservation of catalogue/order/sync records in an isolated database.
- Production dependency audit: zero vulnerabilities. Existing dependency versions were retained; the lockfile removed 773 entries and added 68 for Markdown rendering/parsing.
- Chrome verified resource listing/detail pages, stale/unknown guide 404s, sitemap, destinations, country/plan pages, cart, checkout, regional plans, route builder, homepage, admin dashboard/packages/sync pages, and report downloads. Checkout and other browser write requests were mocked. No Sanity requests or browser runtime errors occurred; retired endpoints returned 404.
- All three resource/sitemap server traces include both Markdown files and both images; no private archive or environment files are traced.

Production cutover has not been performed. The workspace has no linked deployment project or deployment credentials, and the available Vercel integration is not connected. The database contract migration and hosted-service shutdown remain pending the release steps below.

## Application release, then database contraction

1. Deploy this application version while leaving the old database tables intact. Building runs client generation only; it does not apply database migrations. **Do not run `prisma migrate deploy` before the application cutover for this release.**
2. Verify resource pages, images, canonical/social metadata, sitemap, admin dashboard, packages, supplier sync/report downloads, destinations, plans, route builder, and checkout. Confirm there are no requests to Sanity APIs or its image CDN.
3. Let old application instances and in-flight admin/sync jobs drain. Take fresh private backups of `publishing_state` and `pricing_audits` if either table has changed since the export.
4. Apply `20261023120000_remove_editorial_publishing` using the existing production migration procedure. It transactionally drops only the two retired tables without `CASCADE`. Supplier sync history, snapshots, catalogue records, orders, and payments are retained. Historical migrations are unchanged.
5. Disable the old Sanity webhooks and Studio hosting; revoke tokens dedicated to this application. Remove all `SANITY_*` and `NEXT_PUBLIC_SANITY_*` environment variables from development, preview, production, and CI. Keep unrelated credentials intact. Account/project deletion is outside this rollout.

The removed HTTP interfaces are `/api/preview`, `/api/revalidate`, `/api/admin/sanity-sync`, `/api/admin/publishing-state`, `/api/admin/catalog-mismatches`, and `/api/admin/pricing-audits/[id]/actions`. The admin pricing-audit page and navigation entry are retired. Sync-run JSON downloads no longer include `audits`. Supplier-driven catalogue revalidation continues through the Airalo sync endpoint.

Before the contract migration, rollback consists of redeploying the previous application with its existing service configuration. After contraction, restore the legacy table backups before running old application code. Keep the dataset and backups until the new application has been verified; revoke credentials only after the rollback window is closed.
