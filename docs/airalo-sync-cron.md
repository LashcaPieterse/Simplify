# Airalo package sync scheduler

Vercel Cron is limited on the free plan, so the project now expects an **external ping-based scheduler** to trigger the `/api/airalo-sync` route (the `vercel.json` cron config has been removed to avoid deployment failures). Recommended options:

- [cron-job.org](https://cron-job.org)
- [Healthchecks.io / Dead Man's Snitch style checks](https://healthchecks.io)
- Any uptime monitor that can perform authenticated HTTP requests

## Setup steps
1. **Set a shared secret** for the sync endpoint (optional but recommended):
   ```env
   AIRALO_SYNC_CRON_TOKEN=<random-secret>
   ```

2. **Expose the sync URL** using either the header or query param token:
   - Header: `x-airalo-sync-key: <random-secret>`
   - Query param: `?key=<random-secret>`

3. **Create the external cron job** to `GET https://<your-domain>/api/airalo-sync` hourly (or as needed), including the token from step 1.

4. **Alerting**: failures already trigger an email to `pieterselashca@gmail.com` (override with `AIRALO_SYNC_ALERT_EMAIL`). Your cron provider can also notify you if the endpoint returns a non-2xx status.

## Notes
- The route disconnects Prisma on completion to keep cold-start invocations lightweight.
