# Airalo package sync scheduler

This project supports triggering `/api/airalo-sync` from an external scheduler. We now include a **GitHub Actions hourly cron workflow** (`.github/workflows/airalo-sync.yml`) that pings the endpoint.

## GitHub Actions setup (recommended)

1. **Set a shared secret in Vercel** for the sync endpoint:

   ```env
   AIRALO_SYNC_CRON_TOKEN=<random-secret>
   ```

2. In GitHub, add these repository **Actions secrets**:
   - `AIRALO_SYNC_URL` = `https://<your-domain>/api/airalo-sync`
   - `AIRALO_SYNC_CRON_TOKEN` = same value as Vercel `AIRALO_SYNC_CRON_TOKEN`

3. Ensure the workflow is enabled:
   - File: `.github/workflows/airalo-sync.yml`
   - Schedule: hourly (`7 * * * *`)
   - Manual runs also supported via **Run workflow**.

4. Verify it works:
   - Trigger it manually once from the Actions tab.
   - Confirm the job succeeds and `/api/airalo-sync` returns 200.

## Endpoint auth contract

The route accepts the sync token in either format:

- Header: `x-airalo-sync-key: <random-secret>`
- Query param: `?key=<random-secret>`

If `AIRALO_SYNC_CRON_TOKEN` is set and the incoming token does not match, it returns `401 Unauthorized`.

## Alerting

Failures in the API sync route trigger an email to `pieterselashca@gmail.com` by default (override with `AIRALO_SYNC_ALERT_EMAIL`).

## Notes

- If you use preview/staging environments, give each environment its own URL/token pair.
- The route disconnects Prisma on completion to keep cold-start invocations lightweight.
