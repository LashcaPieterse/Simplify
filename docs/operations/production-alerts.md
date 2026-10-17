# Production alerts

Alerts go to the configured operations email and appear under **Admin →
Operations → Production alerts**. The monitor never verifies a new payment,
submits a supplier purchase, retries a purchase, or sends customer receipts.

## Conditions and timing

| Condition | Threshold |
| --- | --- |
| Locally confirmed paid checkout without fulfilled eSIM/top-up | 10 minutes after payment confirmation |
| Fulfilled eSIM with no accepted receipt email | 10 minutes after payment confirmation |
| Unknown/failed supplier submission | 5 minutes after order creation |
| Stalled supplier submission | 10 minutes |
| Pending order with unresolved recovery | 45 minutes |
| Disabled/missing recovery job | Next monitor check |
| Failed recovery SQL/HTTP response, invalid response, or stalled execution | Next check; running execution gets 6 minutes |
| Missing successful recovery heartbeat | 15 minutes |
| Missing primary alert-monitor heartbeat | 15 minutes, detected by the external watchdog |

The most specific supplier incident suppresses a duplicate delivery alert for
the same order. Top-ups do not require a new profile or installation email.
Email acceptance is recorded; this does not prove that a customer read the email.
Payments unknown to the application cannot be discovered by this monitor;
DPO callback/verification coverage remains important.

## Two schedulers

- **Primary:** Supabase Cron `production-alert-monitor`, `4-59/5 * * * *`
  UTC, calls the authenticated `/api/operations/alerts` endpoint. Its database
  wrapper can email directly via Resend if the app endpoint fails or is unavailable.
- **External fallback:** GitHub Actions `Production Alert Watchdog`, minutes
  11, 26, 41, 56 UTC. It checks the same endpoint independently of Supabase Cron
  and can email directly if Vercel or the database is unavailable.

GitHub scheduled events can be delayed or dropped. The fallback is best effort,
not a guaranteed 15-minute SLA. Failures affecting both scheduling providers or
the email provider require independent infrastructure monitoring. Both workflows
also expose failures in their native dashboards.

## Delivery safeguards

Private `recovery_ops.production_alerts` rows track incident lifetimes, an atomic
two-minute send lease, and immutable pending payloads. Retries reuse the same
Resend idempotency key/body within its 24-hour window; pending keys are renewed
after 23 hours. A successful notification suppresses reminders for one hour.
Failed/skipped emails remain unsent and eligible for retry. At most five
incident notifications are attempted per monitor HTTP invocation. Resolved
conditions clear automatically; recurrence starts a new incident.

The database fallback has the same incident/lease mechanism. The external
watchdog coalesces endpoint-failure emails by UTC hour. Alert messages contain
operational references and fixed guidance, not customer email addresses,
provider tokens, activation codes, card details, or raw provider errors.
All alert state/functions require the privileged server connection; client
roles have no schema/table/function access. Request headers stay in memory
using the synchronous `http` extension, avoiding a shared outbound request queue.

## Setup and activation

1. Apply and record `20261017204000_add_production_alerts`. It creates the
   scheduler **inactive** with no secrets in the migration.
2. With the existing Resend key in a local environment file, run:

   ```sh
   PRODUCTION_ALERT_EMAIL=owner@example.com node --env-file=.env.local --import tsx scripts/configure-production-alerts.ts --configure
   ```

   The key is inserted into Vault as `operations_alert_resend_key` using
   parameters; a different existing value is rejected. The scheduler token
   reuses Vault `airalo_recovery_cron_token`. No provider credential is rotated.
3. Deploy the application and watchdog workflow. Configure GitHub secret
   `RESEND_API_KEY` using secure stdin, retain `AIRALO_SYNC_CRON_TOKEN`, and
   set repository variable `PRODUCTION_ALERT_EMAIL` to the same recipient.
4. After deployment, run the setup script with `--activate`. Then set GitHub
   variable `PRODUCTION_ALERTS_ENABLED=true`.
5. Observe a genuine automatic Cron execution and its HTTP result. Use a
   controlled job-disable test with guaranteed restoration to verify the
   stopped-job alert. Do not fabricate provider payment evidence for testing.

## Monitor and pause

Inspect `cron.job_run_details`, `recovery_ops.monitor_requests`, and
`recovery_ops.production_alerts` as an administrator. A SQL job's `succeeded`
status alone does not establish HTTP or email success. Verify `http_status=200`,
`response_valid=true`, and incident `last_notified_at`/`last_email_id`.

To pause the primary timer, use `cron.alter_job` with `active := false` for
`production-alert-monitor`. To pause all notifications deliberately, also set
`alert_config.enabled=false` and disable the GitHub watchdog repository variable.

The primary job keeps its HTTP/recovery heartbeat history and these two cron
jobs' completed run history for 30 days; resolved alert state is retained for
90 days. Customer/payment/order records are not affected by monitor retention.

References: [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart),
[Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).
