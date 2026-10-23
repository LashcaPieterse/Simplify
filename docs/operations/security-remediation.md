# Security remediation: installation, upgrade and activation

Local test outcomes and remaining staging gates are recorded in the [validation report](security-remediation-validation.md).

Use Node 22.12–22.x and the lockfile's Prisma 5.22 CLI. Run commands from the repository root. Supply `DATABASE_URL` through the secret manager or shell environment, using the direct migration connection and TLS for remote databases. Do not put credentials in command arguments or committed files. These instructions never use `migrate reset`.

## Release boundaries

1. `20261023130000_identity_proof`: authoritative proof, customer session and purchase access versions. The sign-in callback does not claim purchases. Initial JWT issuance records successful email/OAuth proof transactionally. First proof invalidates preregistered passwords and identities even before the quarantine batch runs.
2. `20261023140000_payment_lifecycle`: atomic transitions and durable leased lifecycle jobs. `PURCHASE_LIFECYCLE_ENABLED` controls verification and workers; default false. Amount/currency checks precede approval. Authorized payments stay authorized; no automatic capture is introduced.
3. `20261023150000_receipt_outbox`: immutable receipt payloads and durable delivery. `RECEIPT_OUTBOX_ENABLED` controls sending; default false. The outbox is populated while delivery is inactive.
4. `20261023170000_security_baseline`: frozen schema after release 3 plus SQL-only constraints, indexes, functions, affiliate triggers and backend access restrictions.
5. `20261023180000_shared_abuse_controls`: database rate buckets and persisted admin revocation. Deploy this migration before the combined application's abuse checks become active.

The workspace contains the combined implementation. A staged production rollout must deploy an application artifact compatible with each corresponding schema; do not deploy the final artifact against only the identity migration. Historical SQL remains byte-for-byte archived under `prisma/migration-history/migrations`, with SHA-256 checksums for the pre-cutover files. Do not edit archived migrations. The historical chain contains installation defects; it is an upgrade path for existing databases, not a fresh-install recipe.

## Backup and inventory

Take a provider backup/PITR checkpoint and a direct Postgres dump before migration. Use PostgreSQL client tools compatible with the server, and store the dump securely outside the repository. Configure a `simplify_backup` connection profile in a protected Postgres service file outside the repository (mode 0600), matching the intended database. This keeps credentials out of command arguments:

```sh
PGSERVICE=simplify_backup pg_dump --format=custom --file=/secure/backups/simplify-before-remediation.dump
npx prisma migrate status --schema prisma/migration-history/schema.prisma
```

Inspect the pending migration list. An existing database must already have the historical application schema. Resolve unexpected historical failures or drift explicitly against the archived SQL and deployment evidence; never mark an unknown migration applied merely to skip it. The editorial removal must satisfy its separate deployment-first runbook.

## Existing database upgrade

Run in staging first. The archived schema points at the complete historical chain followed by the three additive releases. Apply only after inspecting `migrate status` and confirming that earlier migrations are already accounted for:

```sh
npm run db:upgrade-legacy
npm run db:adopt-baseline
```

The adoption command is read-only by default. It verifies archived checksums, Prisma schema parity against the frozen stage-3 schema, CHECK definitions and validation, trigger definitions and enabled state, partial unique indexes, function bodies and fixed search paths, RLS, and effective client-role access. A mismatch stops adoption. Resolve drift with reviewed forward SQL; never run baseline CREATE TABLE statements over existing tables.

After parity succeeds, record the new baseline and apply stage 5:

```sh
npm run db:adopt-baseline -- --apply
npx prisma migrate deploy
npm run db:platform
npm run db:platform -- --apply
```

`migrate resolve --applied` adds the baseline history record; it does not remove historical records or execute baseline SQL. Retain those records and backups. The parity command intentionally targets stage 3; run it before stage 5 introduces its new tables.

## Fresh installation

Use an empty dedicated Postgres database. Active migrations create the baseline followed by shared abuse controls:

```sh
npx prisma migrate deploy
```

For Supabase, run the separate platform bootstrap with the privileged migration connection:

```sh
npm run db:platform
npm run db:platform -- --apply
```

This provisions access restrictions, `pg_cron`, `http`, Supabase Vault, the private operational schema, recovery/monitor functions, and inactive jobs. It installs no scheduler or mail secrets. Existing matching platform functions are verified and retained; mismatches stop rather than replacing running definitions. A plain Postgres installation can run the application schema tests; platform scheduling requires a Supabase-compatible server with these extensions installed. Vault setup follows [Supabase's extension definition](https://github.com/supabase/postgres/blob/develop/migrations/schema-17.sql) and [Vault documentation](https://supabase.com/docs/guides/database/vault).

Fresh schedulers target `https://sim.africa`; use an approved forward platform migration to change those function URLs for another deployment. Do not activate staging timers against production. Existing live schedules remain in their current state during verification.

## Identity recovery activation

Verify a real recovery email reaches the intended inbox and that redemption signs into the recovery journey. Confirm mismatched historical purchases stay under operator review and a preregistered password no longer works. Replace the example below with the actual fixed past cutover timestamp and keep it in the deployment record:

```sh
npm run security:quarantine -- --before=2026-10-23T00:00:00Z
```

This command inventories uncertain accounts without changing them. After the delivery/journey check, activate bounded transactional batches using that same cutover:

```sh
npm run security:quarantine -- --before=2026-10-23T00:00:00Z --apply --recovery-delivery-verified
```

The batch preserves users, purchases and financial records, quarantines identities, increments customer/session and scoped-access versions, and records audit evidence. It is safe to resume with the same cutoff. Fresh inbox proof or verified matching Google/Apple OAuth clears only matching-email access; operators review mismatches in `/admin/security`. No ownership is automatically detached or reassigned. Password access requires a new password set after proof. Unaffected guest links retain version-zero compatibility.

## Worker and receipt activation

Inventory and backfill payments before enabling recovery:

```sh
npm run security:backfill
npm run security:backfill -- --apply
```

Each apply processes at most 100 previously unbackfilled payments. Repeat inventory/apply until there are no candidates. Raw `000` without accepted approval is not inferred paid. Ambiguous creation stays blocked and is inspected by original checkout reference and saved gateway mode. Never create a replacement automatic payment attempt for an unknown outcome.

Enable `PURCHASE_LIFECYCLE_ENABLED=true` in the application environment, deploy, then enable `RECEIPT_OUTBOX_ENABLED=true` only after inspecting immutable payloads and sender configuration. Keep the existing five-minute recovery schedule. Each tick runs at most five jobs per stage with a 240-second budget, two-minute leases, and 5-minute/15-minute/1-hour/4-hour retry delays. Provider read deadlines are 15 seconds for DPO and 20 seconds for suppliers; purchase submissions have a 30-second deadline. Unknown purchase outcomes stay blocked from resubmission.

Provision `airalo_recovery_cron_token` and `operations_alert_resend_key` through the Supabase Vault UI or the approved secret-management channel; never paste secrets into migration files or shell history. Configure `recovery_ops.alert_config` with the approved sender/recipient and enable it after a staging alert test. Inspect `cron.job` names and active flags before explicitly activating a fresh environment:

```sql
SELECT jobid, jobname, active, schedule FROM cron.job
WHERE jobname IN ('airalo-order-recovery', 'production-alert-monitor');
SELECT cron.alter_job(jobid, active := true) FROM cron.job
WHERE jobname IN ('airalo-order-recovery', 'production-alert-monitor');
```

Do not add another timer alongside the existing timer. Observe `recovery_ops.http_requests`, `recovery_ops.monitor_requests` and `cron.job_run_details`. A healthy recovery response includes `ok: true`, legacy `checked/recovered/unresolved` counters and per-stage results. Alert on payment/authorization unresolved for 15 minutes, paid fulfillment incomplete for 10 minutes, and deliverable receipts pending for 10 minutes. Affiliate maintenance runs independently of recovery-stage failures.

Receipt acceptance is not inbox delivery. The provider ID and acceptance time are recorded only after Resend accepts the immutable request. Unknown outcomes retry the same payload/key for less than 23 hours, then require review. Legacy sent markers without provider evidence enter review and are never automatically resent. In `/admin/security`, an operator can confirm acceptance using a provider message ID or explicitly resend with a new key and an audit reason. Resend documents a [24-hour idempotency window](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Abuse controls and admin access

Configure `RATE_LIMIT_SECRET` (otherwise `NEXTAUTH_SECRET` is used). Vercel uses its overwritten single-IP `x-forwarded-for` header. Other ingress must strip untrusted incoming values, set a dedicated single-IP header, and configure `TRUSTED_CLIENT_IP_HEADER`. Missing or ambiguous production IP data fails closed with 503. Test the actual ingress before accepting traffic; never configure a pass-through client header.

Limits use server database time and HMAC identifiers, shared across processes. API rejections include `Retry-After`; server actions return structured errors. Database outages fail mandatory checks with controlled 503-equivalent responses. Expired buckets are cleaned after 48 hours by the recovery tick. Admin cookies expire in eight hours and require the current persisted revocation version at authorization boundaries. The audited revoke-all action is in `/admin/security`; existing pre-versioned cookies require sign-in again. Individual admin identities and MFA are separate work.

## Verification

All automated financial transports are mocked. Never supply production provider credentials to tests.

```sh
npm test
npm run typecheck
npm run check:operations
npm run lint
python3 -B -m unittest discover -s scripts -p '*_test.py'
npm run build
npm run test:browser
npm run security:audit
```

`npm test` includes isolated PGlite tests that execute actual active migration SQL and exercise proof, atomic transitions, leases, immutable receipt retries, and concurrent rate buckets. Browser tests start a local production server and mock checkout and auth APIs; they check top-up pending/terminal/completed behavior and the recovery journey. They require Chromium (CI installs it; macOS can use local Chrome).

Run the real Postgres checks against an empty disposable localhost database named `simplify_remediation_test`. The test creates a separate `simplify_remediation_upgrade_test` database, refuses an occupied fixture, and never drops/resets databases:

```sh
TEST_POSTGRES_URL=postgresql://postgres:fixture@127.0.0.1:5432/simplify_remediation_test npm run test:postgres
```

CI provisions Postgres 16 for this check. It validates fresh deployment and a previous-release upgrade, structural/security parity, preserved user data and retained historical migration records. For platform behavior, start a separate fresh local Supabase instance on its standard port and run:

```sh
TEST_SUPABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:platform
```

The platform fixture checks real extensions, Vault, inactive secret-free jobs and denied client-role reads. It refuses remote/occupied application databases. Stop the disposable instance after testing. PGlite success does not replace these real-server and staging platform checks.

Release acceptance additionally requires observing a scheduled tick, a browser-independent mocked payment/fulfillment journey, receipt provider-acceptance evidence, and overdue-work alerts in isolated staging. A successful build alone is not activation approval.

## Rollback

Disable the affected workers by setting `PURCHASE_LIFECYCLE_ENABLED=false` and/or `RECEIPT_OUTBOX_ENABLED=false`, deploy, and retain queued work. If necessary, deactivate the existing timer using `cron.alter_job(jobid, active := false)` after checking its job name. Keep additive tables, versions, migrations and audit evidence. Restore service using a forward fix or the last compatible application artifact that retains these ownership and purchase safeguards.

Never roll back to premature verification, restore old access versions, clear unknown supplier claims, automatically resend ambiguous receipts, or destructively roll back financial data. For disaster recovery, configure a separate `simplify_restore` service profile pointing at an isolated restore database, then run `PGSERVICE=simplify_restore pg_restore --no-owner /secure/backups/simplify-before-remediation.dump`. Validate the restored copy and reconcile all post-backup gateway/supplier activity before any controlled cutover. Do not restore an old snapshot over the running purchase system.
