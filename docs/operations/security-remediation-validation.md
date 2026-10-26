# Remediation validation — 2026-10-26

The implementation was validated locally using Node 22.22.3, Prisma 5.22.0 and Next.js 16.4.2. Automated tests use isolated databases and mocked payment, supplier-purchase and receipt transports. The isolated staging rollout used mocked financial transports and real verification, receipt and alert email delivery to an approved inbox. The owner subsequently resumed production rollout while retaining the Free Supabase plan. Production migration and deployment evidence is recorded below.

| Check | Result |
| --- | --- |
| `npm test` | 361 tests: 360 passed, 1 skipped, 0 failed. The skip is the existing live Airalo API test, which requires explicit provider credentials. |
| `npm run typecheck` | Passed. |
| `npm run check:operations` | Passed; includes database provisioning/backfill scripts and the Supabase platform fixture. |
| `npm run lint` | Passed with zero warnings. |
| `npm run build` | Passed using a dummy unavailable database URL; no production database was queried. |
| `npm run test:browser` | Passed: top-up pending, declined and complete outcomes, plus email recovery. Four journeys / five TAP tests including the parent. |
| `npm run test:postgres` | Passed on temporary native Postgres 16.11 bound to localhost: fresh deployment, previous-release upgrade, schema/function/constraint/permission parity, explicit denied reads for both `anon` and `authenticated`, historical migration records and preserved user/purchase/payment relationships and values. The temporary server was stopped and removed afterward. |
| Python production watchdog tests | Four passed. |
| `npm run security:audit` | Zero production dependency vulnerabilities reported. |
| `git diff --check` | Passed. |
| GitHub Actions on release candidate `c02ed61` | All three jobs passed: application/browser/dependency checks, real Postgres migrations, and disposable Supabase platform checks including extensions, Vault, denied client access and inactive schedulers. Includes baseline corrections, patched Zod/Nodemailer dependencies and the late-callback recovery regression. [Run 40313051906](https://github.com/LashcaPieterse/Simplify/actions/runs/40313051906). |

The remediation integration fixture executes the actual active migration SQL against an isolated PostgreSQL-compatible database. It verifies that a link request cannot claim purchases; verified proof resets preregistered credentials and quarantines mismatched identities; historical job seeding progresses; same-name constraint replacements fail adoption; competing payment observations retain approval; only one worker acquires a lease; receipt payloads and keys remain stable across unknown acceptance and later failures; expired uncertainty requires operator review; concurrent rate limits share hashed buckets; and limiter outages fail closed.

The browser-independent purchase journey starts with a persisted pending payment and runs the leased verification and fulfillment stages without a callback or browser. Two concurrent fulfillment workers produce exactly one supplier submission and one reserved order. Fulfillment persists a receipt job, the mocked provider accepts it, and DPO processing acknowledgment runs separately afterward. Existing unknown-outcome and concurrent supplier-submission regression tests remain passing.

A late independently verified paid callback can reopen only its payment-verification job after an earlier terminal observation. Concurrent callbacks preserve active leases and a 15-second verification cooldown; supplier review jobs remain untouched. This was also exercised using two independent clients against real isolated staging Postgres: one mocked DPO verification recovered approval and produced zero supplier submissions.

The JSON reader tests include false content lengths, malformed UTF-8 and oversized cloned request streams. Account-limit reservations remain isolated across concurrent authentication requests. Scoped-token and admin-session tests cover versioned access, old formats, timestamps, signatures and local return destinations.

## Isolated staging acceptance — 2026-10-26

The protected [staging deployment](https://simplify-security-staging.vercel.app) uses a separate Supabase project and independent application secrets. It has no DPO or supplier credentials. The installation rehearsal restored only production schema and historical migration records, compared Supabase-owned default privileges, applied the three additive releases, passed structural/security parity, registered the baseline without removing history, and applied shared abuse controls. The corrected baseline retains catalog audit timestamp precision and time zones, descending indexes and names, defaults, foreign-key actions, and all 16 SQL-only validation checks.

The staging-only draft baseline registration was reconciled to the final artifact after the generated-index correction, with a fresh complete-schema and permission check and an audit entry. Its registration identity and all other migration rows were preserved. Production has no baseline registration to repair; it must use the supported parity-and-`migrate resolve` adoption workflow in the runbook.

| Acceptance check | Observed result |
| --- | --- |
| Recovery ownership | Requesting a link changed no proof, session version or purchase ownership. Fresh inbox proof redeemed successfully; expired and reused links were rejected. Matching purchases were restored, the legacy password removed, old identities quarantined and mismatched ownership retained for review. |
| Revoked access | The deployed auth API rejected the old customer session version; the account page redirected to sign-in. The old password returned 401 and a revoked scoped order link returned 403. |
| Browser-independent fulfillment | Mocked DPO verification, two concurrent workers using real staging Postgres, exactly one supplier submission and one reserved order, durable installation/receipt work, and separate processing acknowledgment. No live payment or supplier purchase occurred. |
| Trusted ingress and shared limits | Eleven failed logins produced ten 401 responses followed by 429 with `Retry-After`. Alternating forged forwarded-IP headers created no spoofed-IP bucket; all attempts consumed the same ingress bucket. An oversized JSON request returned 413. |
| Scheduled recovery | The existing five-minute staging timer returned HTTP 200, `ok: true`, compatible counters and per-stage summaries. Installation/reconciliation work completed without a browser or callback. |
| Durable receipt | The payload was frozen and checked for the approved recipient and explicit staging label. The 09:22 UTC scheduled tick accepted exactly one receipt on its first attempt, recorded the provider message ID and acceptance timestamp, and set the order's sent marker. Inbox arrival was independently confirmed. |
| Overdue-work alerts | The scheduled monitor sent overdue receipt/fulfillment alerts with provider IDs; both reached the inbox. The 09:24 UTC monitor resolved both incidents after receipt acceptance. |
| Cleanup | Both staging timers and alert delivery were disabled. The temporary Vercel bypass was revoked, rejected by the protected deployment, and removed from staging Vault and local configuration. A new staging deployment has both worker flags disabled. |

Detailed evidence, inbox identifiers, payload fingerprints and operational logs are retained in the ignored owner-only audit directory; credentials and customer information are excluded from the release PR.

## Production rollout

Production deployment resumed at the owner's request and the release is live. The migration and baseline checks passed before application deployment. Recovery inbox proof, authenticated account access, request-body limits, scheduled lifecycle recovery and alert delivery were verified. Historical recovery and receipt-review controls are active.

[PR #107](https://github.com/LashcaPieterse/Simplify/pull/107) contains the deployed release. Its application code matches the tested release candidate. Detailed deployment, inventory, backup and operator-review evidence is retained privately.

Worker flags default to false for new environments, and fresh platform schedules remain inactive. Preserve queued work and additive schema during rollback; follow the [operations runbook](security-remediation.md).
