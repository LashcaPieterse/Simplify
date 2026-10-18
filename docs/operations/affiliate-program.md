# Tour guide affiliate program

The program uses the existing customer accounts, DPO checkout, Airalo fulfilment, admin authentication, and protected recovery scheduler. It ships closed, with no commercial commission rate selected. No legacy checkout is attributed retroactively.

## Release and pilot

1. Apply `prisma/migrations/20261018120000_add_affiliate_program` and `prisma/migrations/20261018183000_add_affiliate_topup_commissions` using the normal reviewed migration deployment. The initial additive migration enables RLS and revokes browser/API-role access on all eight new tables. It also freezes checkout attribution and original commission terms, makes ledger/refund entries append-only, and adds a unique constraint on active payout allocations.
2. Configure `AFFILIATE_PROGRAM_ENABLED=true` and a separate random `AFFILIATE_REFERRAL_SECRET` of at least 32 characters. This environment switch indicates that the database infrastructure is available. Keep it true while closing the program through admin, so existing obligations continue reconciling.
3. Configure a verified Resend sender in `AFFILIATE_EMAIL_FROM`, `RESEND_API_KEY`, and optionally `AFFILIATE_APPLICATIONS_EMAIL` (falls back to `ADMIN_EMAIL`). The existing email magic-link provider requires `EMAIL_FROM` too; approved Google/Apple sign-ins also verify the account email.
4. In `/admin/affiliates`, enter a positive default commission percentage and review the margin preview before opening applications. Costs without a matching supplier-price currency are shown as unknown; displayed margin excludes operating fees. Individual guide overrides apply only to subsequent checkouts.
5. Open the program in admin, approve selected pilot applications after email verification, and test their referral links and QR codes. Confirm the existing protected `/api/airalo/recover` scheduler is active and production alerts are configured.
6. Review the program terms and public privacy notice before promoting `/affiliates`. Application acceptance records the terms version, currently `2026-10-18-v2`. Update that version whenever terms change.

Closing applications/referrals in admin leaves earned balances, payout access, outstanding notifications, and commission recovery working. Turning off the environment switch is a rollout/maintenance switch and also pauses automatic affiliate bookkeeping.

## Attribution and earning rules

- `/r/[code]?to=/country/namibia` opens a guide recommendation and asks permission to remember the guide for 30 days. Only public storefront destinations are accepted. Declining or forgetting a remembered guide removes the referral cookie.
- The cookie is signed, HTTP-only, host-scoped, SameSite=Lax, and secure in production. It contains a guide code and issue/expiry times, with no traveller contact data. A later accepted referral replaces it. Entering a valid code at checkout overrides the cookie for that purchase without extending cookie storage consent.
- Referral codes provide attribution and do not discount the purchase. Same-account and same-email self-referrals are excluded. Suspended or unverified guides cannot receive new attributions.
- Affiliate ID, code, rate, and source are resolved by the server and frozen at checkout creation. Generic browser metadata cannot supply accounting values. Guest account claims and payment redirects preserve the snapshot.
- A commission is posted once only after server-verified, amount/currency-matched payment and supplier completion. New eSIMs require an owned SIM profile and personalized installation details. A top-up instead verifies that its ICCID belongs to the originally referred eSIM; it requires no new SIM profile or installation credentials. The first fulfilment timestamp is persisted independently of receipt email success. Maturity is exactly 30 days later.
- New eSIM purchases, including purchases by returning travellers, and top-ups on those eSIMs are eligible. Top-ups retain the original eSIM’s guide even after the 30-day browser cookie expires. A different browser link or checkout code cannot replace that guide. The program must be open and the guide approved and verified when the top-up checkout starts; self-referrals remain excluded. Each top-up snapshots the guide’s current override/default rate, with its own payment verification, fulfilment timestamp, 30-day hold, refund adjustments, and payout entries. Existing top-up checkouts are not retroactively attributed. Closing the program or suspending a guide does not erase previously valid obligations; use an audited commission hold for an investigation.

## Refunds and review holds

Refunding money in DPO or another external system does **not** automatically update the affiliate ledger. Record every completed refund or lost chargeback in admin using the newly refunded sale amount, external reference, and reason. Do not record an unresolved dispute as a final refund; hold the commission while investigating.

For a paid referral awaiting delivery, use **Paid referrals awaiting commission**. The refund is recorded before a commission exists and is included if delivery later succeeds. For a fulfilled referral, open its commission record and use **Record external refund / chargeback**.

Repeating the same reference and amount is idempotent. Reusing a reference with a different amount is rejected. Cumulative sale refunds cannot exceed the original charge. Commission deductions are calculated from the cumulative refunded sale amount to avoid repeated rounding errors. Pending earnings and their adjustments mature together; deductions for mature or previously paid earnings reduce future balances.

A refund cancels prepared payouts for that guide/currency and releases their allocations so stale exports are not used. A processing transfer remains reserved because money may already have been sent; its refund deduction carries forward. Resolve an uncertain transfer before cancelling it. Financial history cannot be edited or deleted to reverse a mistake; investigate and preserve external evidence before making a correction.

## Monthly manual payout procedure

1. Search for the guide in admin and review their balances, refund entries, and any holds. Agree payment method, instructions, transfer currency, conversion, and fees directly with the guide. The app does not collect bank instructions.
2. Prepare a payout for each positive available currency balance. There is no automatic minimum. Negative/deferred balances carry forward. You can record a deferral reason in the audit log.
3. Export an individual payout or **Export all reserved payouts** for the monthly payment list. Each row has a stable payout ID, guide, currency, amount, period, and current status. Exports contain no bank instructions or traveller data.
4. Mark the payout **processing before sending money**, then make the transfer externally. Only transfer rows whose current reservation/status you have checked. Do not retry an uncertain external transfer.
5. Record the transfer reference and payment date (Windhoek date), amount sent before fees, transfer currency, exchange rate, and fees. The exchange rate is transfer-currency units per earnings-currency unit; same-currency transfers use 1. Converted amounts must agree within one transfer-currency cent.
6. Mark paid only after confirming the transfer. A completed payout cannot be cancelled. Cancelling a processing payout requires explicit confirmation that no money was sent, along with a reason, and releases its allocations.

Payout preparation uses serializable transactions and an active-allocation unique index. Ledger entries cannot be reserved for overlapping payouts. The external bank transfer remains a manual operation, so the processing/reconciliation procedure is essential.

## Monitoring and troubleshooting

The protected recovery endpoint independently retries missing commissions in bounded batches and delivers up to five queued emails per run. Failed bookkeeping is logged with identifiers and cannot undo a supplier acknowledgement or successful payment.

The existing production alert monitor reports paid fulfilled referrals without a commission after 30 minutes and undelivered affiliate notifications after one hour. `/admin/affiliates` also shows both queues and provides a manual retry. Review sender configuration if email remains queued; review the protected recovery scheduler if fulfilled commissions are missing.

## Validation

- `npm test`: includes rule/HTTP tests and an isolated in-memory PostgreSQL sandbox over a local TCP socket. The sandbox derives the previous schema, applies both actual additive migrations, and uses mocked payment, supplier, and email responses; it does not use `DATABASE_URL` or purchase live eSIMs. A local socket permission is required.
- `npm run airalo:test`: existing payment, supplier, recovery, access, and authentication regression tests.
- `npm run lint`, `npm run typecheck`, and `npm run build`: run typecheck after build/type generation, since both depend on `.next/types`.

The sandbox covers approval/email verification, guest checkout and snapshot preservation, top-up attribution and fulfilment without a new SIM profile, payment mismatches, fulfilment and duplicate callbacks, maturity, suspension/rate changes, refunds before and after fulfilment, payout races and cancellation, currency separation, guide data isolation, and database immutability/RLS. PGlite uses one database connection, so native multi-connection PostgreSQL contention and genuine DPO/Airalo callback delivery remain staging checks before public launch.
