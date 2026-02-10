# Airalo package sync scheduler

This project supports triggering `/api/airalo-sync` from an external scheduler. We now include a **GitHub Actions hourly cron workflow** (`.github/workflows/airalo-sync.yml`) that pings the endpoint.

## GitHub Actions setup (recommended)

1. **Set a shared secret in Vercel** for the sync endpoint:

   ```env
   AIRALO_SYNC_CRON_TOKEN=<random-secret>
   ```

2. Ensure Airalo + database env vars are configured in Vercel for the same environment used by your URL:
   - `AIRALO_CLIENT_ID`
   - `AIRALO_CLIENT_SECRET`
   - `DATABASE_URL`

3. In GitHub, add these repository **Actions secrets**:
   - `AIRALO_SYNC_URL` = `https://<your-production-domain>/api/airalo-sync` (example: `https://simplify-pink.vercel.app/api/airalo-sync`)
   - `AIRALO_SYNC_CRON_TOKEN` = same value as Vercel `AIRALO_SYNC_CRON_TOKEN`

   Use a stable production alias/custom domain, **not** a single deployment URL.

4. Check debug output correctly:
   - The debug field `vercelUrl` comes from Vercel runtime (`VERCEL_URL`) and usually points to the backing deployment host.
   - It does **not** mean your GitHub secret is wrong as long as `AIRALO_SYNC_URL` targets your stable production domain.

5. Ensure the workflow is enabled:
   - File: `.github/workflows/airalo-sync.yml`
   - Schedule: hourly (`7 * * * *`)
   - Manual runs supported via **Run workflow** with two modes:
     - `sync` (default): runs package sync
     - `debug`: calls `/api/airalo-sync?debug=1` and returns env diagnostics

6. Verify it works:
   - Trigger it manually once from the Actions tab.
   - Confirm the job succeeds and `/api/airalo-sync` returns 200.

## Endpoint auth contract

The route accepts the sync token in either format:

- Header: `x-airalo-sync-key: <random-secret>`
- Query param: `?key=<random-secret>`

If `AIRALO_SYNC_CRON_TOKEN` is set and the incoming token does not match, it returns `401 Unauthorized`.

## Troubleshooting failed manual runs

If your Actions log shows `HTTP 500` and `{"error":"Airalo sync failed"}`:

1. Run the workflow manually with `mode=debug`.
2. Check debug JSON output for these fields:
   - `airaloClientIdPresent`
   - `airaloClientSecretPresent`
   - `databaseUrlPresent`
   - `cronTokenPresent`
3. If any of those are false, fix Vercel env vars and redeploy.
4. Check Vercel function logs for `/api/airalo-sync` to get the exact exception stack.

The workflow also attempts a debug probe automatically after a failed `sync` run to speed up diagnosis.

## Alerting

Failures in the API sync route trigger an email to `pieterselashca@gmail.com` by default (override with `AIRALO_SYNC_ALERT_EMAIL`).

GitHub Actions job failures are visible in the **Actions** tab. To get personal notifications when the workflow fails:

1. In GitHub, open your profile **Settings → Notifications** and enable email/web notifications for Actions failures.
2. In the repository, ensure you are **Watching** (or at least receiving notifications for Actions in that repo).

Without notification settings enabled, failed runs will not automatically email you.

## Notes

- If you use preview/staging environments, give each environment its own URL/token pair.
- The route disconnects Prisma on completion to keep cold-start invocations lightweight.

## Stale-package and price-change handling

The sync endpoint now acts as the **single source of truth** for package availability and pricing:

- Sync writes latest Airalo package details into Prisma (including updated prices).
- Packages missing from the latest upstream dataset are automatically marked inactive (`isActive=false`).
- After a successful sync, the route triggers `revalidatePath` for home/country/plan pages so static pages refresh without a full redeploy.

This means a scheduler run updates what customers can buy without requiring Sanity edits or a deployment cycle.
