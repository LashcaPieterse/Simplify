# Editorial service removal rollout

## Export completed

On 2026-10-23, the configured Sanity dataset returned two published posts, zero drafts, and zero release versions. Both posts and both original cover-image files were copied into the repository. Raw source documents, image hashes, and legacy database backups are stored privately in the ignored `docs/audits/sanity-removal-2026-10-23/` directory (owner-only permissions). Keep this archive in protected operational storage; never commit credentials or drafts.

The publishing-state and pricing-audit backups each contained zero rows at export time and at production cutover. Both published slugs are preserved. The 2024 coverage guide remains excluded by the existing current-year policy; the pre-flight checklist remains visible. A pre-deployment source check confirmed the same two published revisions and zero drafts before cutover.

## Local verification completed

- Node 22.22.3: typecheck, lint, and production build passed without content-service environment variables.
- Full unit/integration suite: 337 passed, one live Airalo test skipped. The four production-watchdog Python tests also passed.
- Content and database-removal checks passed, including source metadata/text comparisons, original image hashes, and preservation of catalogue/order/sync records in an isolated database.
- Production dependency audit: zero vulnerabilities. Existing dependency versions were retained; the lockfile removed 773 entries and added 68 for Markdown rendering/parsing.
- Chrome verified resource listing/detail pages, stale/unknown guide 404s, sitemap, destinations, country/plan pages, cart, checkout, regional plans, route builder, homepage, admin dashboard/packages/sync pages, and report downloads. Checkout and other browser write requests were mocked. No Sanity requests or browser runtime errors occurred; retired endpoints returned 404.
- All three resource/sitemap server traces include both Markdown files and both images; no private archive or environment files are traced.

## Production rollout completed

The application release `4913d3e` was pushed to `main` and deployed to [sim.africa](https://sim.africa) on 2026-10-23 (Africa/Windhoek). The Vercel `simplify` project was rebuilt successfully after removing its four retired variables (`SANITY_API_VERSION`, `SANITY_READ_TOKEN`, `SANITY_DATASET`, and `SANITY_PROJECT_ID`) from production, preview, development, and custom environments. No shared content-service variables are linked. The second repository-linked project, `simplify-ciss`, has no project environment variables and also built the removal release successfully. [The clean-environment production deployment](https://vercel.com/lashcas-projects/simplify/4FLKHEkpUxZGSzY8arpqv98Bz7Pu) is Ready and serves the production domains.

[GitHub Actions CI for the application release](https://github.com/LashcaPieterse/Simplify/actions/runs/39870095332) completed successfully, including typecheck, unit/integration tests, watchdog tests, lint, build, and the production dependency audit.

The repository's four obsolete GitHub Actions secrets (`SANITY_DATASET`, `SANITY_PROJECT_ID`, `SANITY_READ_TOKEN`, and `SANITY_WRITE_TOKEN`) were removed after the application release. Repository variables and all six deployment environments contain no additional Sanity settings. Unrelated secrets and variables are retained.

Production browser checks passed for guides, original images, metadata, sitemap, catalogue, plans, cart, checkout, regional plans, and route builder, with zero browser errors and zero Sanity requests. Checkout and other write requests were mocked. Authenticated production checks passed for the admin dashboard, packages, supplier-sync health, and report downloads; the report contains only `run`, `items`, `snapshots`, and `snapshotLimits`. Retired interfaces return 404.

After application cutover and a fresh private backup, `20261023120000_remove_editorial_publishing` was applied successfully at approximately 2026-10-22 23:23 UTC. No other migrations were pending. Database activity showed no active old transactions or sync jobs; one September sync row still marked running was stale and was preserved unchanged. The retired tables are absent and all retained record counts and primary-key hashes match the pre-migration check: 216 countries, 522 operators, 4,893 packages and package-state rows, 4,477 sync runs, two orders, and 43 payment transactions. Sync-item/snapshot tables and all historical migrations were retained.

## Remaining Sanity account cleanup (manual)

The application and database no longer require Sanity. The owner chose to complete Sanity account administration manually; account-side deletion and token revocation have **not** been verified. In [Sanity Manage](https://www.sanity.io/manage), select **Simplify**, project `xp1nmxei`:

1. Under **API → Webhooks**, delete only webhooks targeting this application's retired publishing or revalidation endpoints.
2. Under **API → Tokens**, revoke tokens dedicated to this application, including the former application read and write tokens. Keep unrelated project or human credentials.
3. Inspect **Studios** for an application Studio. The pre-cleanup project metadata reported no legacy `studioHost`, and the repository had no standalone CLI hosting configuration. If no Studio is listed, there is nothing to remove. If one is listed, inspect its URL before deleting it. The Studio menu's **Remove studio** action removes its registration; for a separately Sanity-hosted Studio, use `sanity undeploy` from that Studio's configured directory to actually stop hosting. See [Sanity's deployment documentation](https://www.sanity.io/docs/studio/deployment).

Keep the project, `production` dataset, and private exports. Project/account deletion is outside this rollout. Removing a variable from Vercel does not revoke its credential at Sanity; the dedicated token remains valid until the owner revokes it.

An existing operational issue is separate from the removal release: [scheduled supplier-sync run 2949](https://github.com/LashcaPieterse/Simplify/actions/runs/39863432735) failed with exit code 28 on the previous application commit `29c8ff4`. Recent scheduled sync timeouts predate this rollout; authenticated sync-health and report reads passed after deployment. This removal did not change the supplier workflow.

## Release procedure reference

1. Deploy this application version while leaving the old database tables intact. Building runs client generation only; it does not apply database migrations. **Do not run `prisma migrate deploy` before the application cutover for this release.**
2. Verify resource pages, images, canonical/social metadata, sitemap, admin dashboard, packages, supplier sync/report downloads, destinations, plans, route builder, and checkout. Confirm there are no requests to Sanity APIs or its image CDN.
3. Let old application instances and in-flight admin/sync jobs drain. Take fresh private backups of `publishing_state` and `pricing_audits` if either table has changed since the export.
4. Apply `20261023120000_remove_editorial_publishing` using the existing production migration procedure. It transactionally drops only the two retired tables without `CASCADE`. Supplier sync history, snapshots, catalogue records, orders, and payments are retained. Historical migrations are unchanged.
5. Disable the old Sanity webhooks and Studio hosting; revoke tokens dedicated to this application. Remove all `SANITY_*` and `NEXT_PUBLIC_SANITY_*` environment variables from development, preview, production, and CI. Keep unrelated credentials intact. Account/project deletion is outside this rollout.

The removed HTTP interfaces are `/api/preview`, `/api/revalidate`, `/api/admin/sanity-sync`, `/api/admin/publishing-state`, `/api/admin/catalog-mismatches`, and `/api/admin/pricing-audits/[id]/actions`. The admin pricing-audit page and navigation entry are retired. Sync-run JSON downloads no longer include `audits`. Supplier-driven catalogue revalidation continues through the Airalo sync endpoint.

The contract migration is now applied. To roll back to application code that uses the retired models, recreate both tables from the preserved historical schema and restore their private backups before deploying that code. Restore its required service configuration as well; revoked tokens must be replaced. Keep the dataset and backups available for recovery.
