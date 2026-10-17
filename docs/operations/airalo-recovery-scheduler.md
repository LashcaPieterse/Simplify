# Automatic order recovery

Supabase Cron is the automatic timer. GitHub Actions retains a manual fallback.
The deployed worker checks existing supplier purchases and never submits a new
purchase. An unresolved historical purchase requires investigation.

## Configuration

The migration `20261017114000_add_supabase_recovery_schedule` enables `pg_cron`
and `http`, creates the private `recovery_ops` audit schema, and registers
`airalo-order-recovery` **inactive**. It runs as `postgres` at `2-59/5 * * * *`
(UTC). The destination is fixed to `https://sim.africa/api/airalo/recover`.

Provision a Vault secret named `airalo_recovery_cron_token` containing the
existing deployed `AIRALO_SYNC_CRON_TOKEN`. Use Vault administration or a
parameterized database operation; never paste its value into SQL, a migration,
cron command, logs, or source control. Confirm the values match without
displaying them. This does not rotate any provider credential.

The synchronous `http` extension avoids storing authorization headers in a
shared `pg_net` request queue. The call has a 310-second timeout and holds one
database connection while running. Cron serializes executions of the same job;
an advisory lock also prevents overlap with manual calls. The helper is a
security-invoker function restricted to administrators. Its audit table has RLS
enabled and no client grants. Only response status, bounded body, and sanitized
transport errors are retained; request headers are never persisted.

Remove any other automatic recovery timer before activation. The GitHub
workflow in this repository has no `schedule` trigger.

```sql
select cron.alter_job(jobid, active := true)
from cron.job where jobname = 'airalo-order-recovery';
```

Apply the versioned migration once and record it in Prisma migration history
when applying it outside Prisma. Application deployment alone does not
activate the job or provision the secret.

## Verify actual automatic executions

Wait for a cron boundary without invoking the helper manually. Inspect all
three sources as an administrator:

```sql
select jobid, jobname, schedule, active, command
from cron.job where jobname = 'airalo-order-recovery';

select d.runid, d.status, d.start_time, d.end_time, d.return_message
from cron.job_run_details d join cron.job j using (jobid)
where j.jobname = 'airalo-order-recovery'
order by d.start_time desc limit 10;

select id, requested_at, completed_at, http_status, response_body, error_text
from recovery_ops.http_requests order by id desc limit 10;

select "createdAt", result, reason
from public."EsimOrderRecoveryAttempt"
order by "createdAt" desc limit 10;
```

A cron `succeeded` result means the helper returned. Check `http_status = 200`
and `error_text is null` separately, then inspect response counts. Transport
errors are retained in the private audit table. A nonzero `unresolved` count
means purchases still need review; it does not mean that scheduling failed.
The application emits `airalo.order.recovery.alert` logs for overdue unresolved
purchases. Cron failures and HTTP audit results require operational monitoring;
they do not automatically generate GitHub failure notifications.

Monitor database storage and retain only the operational history required by
your retention policy; both cron history and recovery audit rows grow over time.

## Pause and rollback

```sql
select cron.alter_job(jobid, active := false)
from cron.job where jobname = 'airalo-order-recovery';
```

Pause this job before restoring another automatic timer. Keep audit evidence.
Never reset historical orders to a purchase-eligible state to force recovery.

References: [Supabase Cron](https://supabase.com/docs/guides/cron),
[HTTP extension](https://supabase.com/docs/guides/database/extensions/http),
[managed pg_net permissions](https://supabase.com/docs/guides/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16).
