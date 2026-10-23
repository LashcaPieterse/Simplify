# Remediation validation — 2026-10-23

The implementation was validated locally using Node 22.22.3, Prisma 5.22.0 and Next.js 16.4.2. All automated payment, supplier-purchase and receipt transports were mocked. No production database, purchase, recovery email, quarantine batch or scheduler activation was exercised.

| Check | Result |
| --- | --- |
| `npm test` | 359 tests: 358 passed, 1 skipped, 0 failed. The skip is the existing live Airalo API test, which requires explicit provider credentials. |
| `npm run typecheck` | Passed. |
| `npm run check:operations` | Passed; includes database provisioning/backfill scripts and the Supabase platform fixture. |
| `npm run lint` | Passed with zero warnings. |
| `npm run build` | Passed using a dummy unavailable database URL; no production database was queried. |
| `npm run test:browser` | Passed: top-up pending, declined and complete outcomes, plus email recovery. Four journeys / five TAP tests including the parent. |
| `npm run test:postgres` | Passed on temporary native Postgres 16.11 bound to localhost: fresh deployment, previous-release upgrade, schema/function/constraint/permission parity, explicit denied reads for both `anon` and `authenticated`, historical migration records and preserved user/purchase/payment relationships and values. The temporary server was stopped and removed afterward. |
| Python production watchdog tests | Four passed. |
| `npm run security:audit` | Zero production dependency vulnerabilities reported. |
| `git diff --check` | Passed. |

The remediation integration fixture executes the actual active migration SQL against an isolated PostgreSQL-compatible database. It verifies that a link request cannot claim purchases; verified proof resets preregistered credentials and quarantines mismatched identities; historical job seeding progresses; same-name constraint replacements fail adoption; competing payment observations retain approval; only one worker acquires a lease; receipt payloads and keys remain stable across unknown acceptance and later failures; expired uncertainty requires operator review; concurrent rate limits share hashed buckets; and limiter outages fail closed.

The browser-independent purchase journey starts with a persisted pending payment and runs the leased verification and fulfillment stages without a callback or browser. Two concurrent fulfillment workers produce exactly one supplier submission and one reserved order. Fulfillment persists a receipt job, the mocked provider accepts it, and DPO processing acknowledgment runs separately afterward. Existing unknown-outcome and concurrent supplier-submission regression tests remain passing.

The JSON reader tests include false content lengths, malformed UTF-8 and oversized cloned request streams. Account-limit reservations remain isolated across concurrent authentication requests. Scoped-token and admin-session tests cover versioned access, old formats, timestamps, signatures and local return destinations.

## Remaining activation evidence

The following checks require isolated Supabase-compatible staging and configured delivery/ingress; local application tests do not establish them:

- Run `npm run test:platform` against a disposable local Supabase instance. Validate actual `pg_cron`, `http`, Vault, inactive secret-free schedulers and denied client-role reads.
- Run baseline adoption against a staging copy of the real installation and resolve any installation-specific drift before marking the baseline applied.
- Verify recovery mail reaches the correct inbox and successfully redeems before historical quarantine activation.
- Validate the trusted-IP adapter through the deployment's actual ingress.
- Observe scheduled recovery and overdue-work alerts with lifecycle stages enabled. Verify the approved receipt sender and provider-acceptance evidence in staging.

`PURCHASE_LIFECYCLE_ENABLED` and `RECEIPT_OUTBOX_ENABLED` default to false. Fresh platform schedules are inactive. Follow the [rollout, provisioning and rollback runbook](security-remediation.md); preserve queued work and additive schema during rollback.
