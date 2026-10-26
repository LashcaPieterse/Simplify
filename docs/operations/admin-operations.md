# Admin operations and financial recovery

The admin workspace links incidents to payments, orders, individual receipt deliveries, system health and audit history. All times use Africa/Windhoek. Existing customer and administrator access rules remain in force; the shared administrator email identifies the actor, not the individual using shared credentials.

## Install and release

Use Node 22.12–22.x. Apply the existing security baseline and shared abuse-controls deployment before this additive release. Back up the database and rehearse the upgrade in staging, then apply `20261026190000_admin_operations` with the normal migration deployment. Do not change archived migrations, reset a database, provision new schedulers, or activate staging timers against production.

The migration adds private operation/refund journals, incident review history, callback diagnostics and checkout controls. It preserves original orders and relates replacement orders to their original sale. Existing external affiliate refund adjustments are adopted without submitting provider requests; checkouts with ambiguous multiple approved payments retain their legacy refund capacity deductions for investigation. Client database roles have no table access.

Deploy investigation and recovery first. These capabilities are disabled by default and must be validated and enabled separately in deployment configuration:

| Flag | Enables |
| --- | --- |
| `ADMIN_CAPTURE_ENABLED` | Explicit capture and unpaid-token cancellation |
| `ADMIN_REFUNDS_ENABLED` | Customer refunds and externally completed refund recording |
| `ADMIN_REPLACEMENTS_ENABLED` | Goodwill replacement purchases |
| `ADMIN_SUPPLIER_REFUNDS_ENABLED` | Airalo reimbursement requests |

Recording independently verified outcomes of existing refund requests remains possible after disabling new submissions. Every financial action requires the administrator password, a reason, current record version, and explicit confirmation. Password failures use shared account/IP rate limits. Provider credentials, payment tokens, callback bodies, activation codes and receipt payloads are never returned in action responses.

## Resolve an incident

1. Open **Operations** and select **Investigate affected records**. Warning counts are those observed by the last monitor run; the record lists use the same eligibility predicates and reflect current data.
2. Inspect the saved gateway environment, amount/currency, payment transitions, supplier identifiers, receipt evidence, and previous operations. Follow related payment/order links.
3. Acknowledge with a note, or add an external escalation reference. Acknowledgement does not suppress notifications or resolve the warning.
4. Choose an eligible action, read its effect, supply evidence and confirmation, and submit once. Pending/uncertain operations have durable references. Check history after a lost browser response before another action.
5. Use **Recheck incident conditions**, or wait for the next automatic check. A manual recheck sends no email and does not update scheduled HTTP heartbeat evidence. An incident clears only when the condition actually clears or financial disposition removes the delivery obligation. Recurrence receives a new incident identifier; review history remains.

If monitoring or a database dependency is unavailable, the dashboard reports unavailable data rather than a healthy empty state.

## Payments

**Verify with DPO** reads the original transaction with its saved test/live credentials. An independently verified `000`, matching the stored amount and currency, can approve payment. Callback fields, authorization, and an operator checkbox cannot approve payment.

**Capture authorization** performs a fresh read and calls `chargeTokenAuth` only for a matching authorized transaction. DPO `000` means capture was queued; the operation remains pending until independent verification confirms payment. `905` also requires reconciliation. Verification and the existing scheduled worker settle saved capture/cancellation operations without repeating the mutation.

**Cancel unpaid transaction** targets the saved unpaid token. Provider cancellation and release of a bank authorization hold are separate; do not promise immediate release of a bank hold.

**Refund payment** supports positive full/partial amounts in the original payment currency. Reservations include confirmed refunds, uncertain requests, and historical external adjustments. The sale is held during reconciliation; a full confirmed refund keeps future fulfilment blocked. Original approval evidence remains intact. Callback replay cannot clear this hold. Refund and purchase claims serialize against the sale row, with a database trigger guarding supplier submission as defence in depth.

DPO `refundToken` has no assumed replay guarantee. A lost response, execution crash or persistence failure retains the operation and reservation for review. The application never automatically repeats it. Independently verify the refund in DPO, then use **Record provider outcome** and supply its evidence reference. Confirmed refunds update affiliate adjustments idempotently; a ledger outage preserves provider success and leaves accounting eligible for retry. Recording an external refund does not submit money movement.

## Supplier fulfilment and replacements

**Reconcile supplier purchase** uses an existing supplier order ID or the exact local order marker. Missing search results do not establish that a purchase failed. Conflicting identifiers remain unresolved. **Retry unsubmitted purchase** is restricted to an active pending/explicitly rejected submission with no supplier acknowledgement or request identifier.

**Create goodwill replacement** requires an existing independently paid sale, resolved ownership, and an explicit package/cost preview. The preview is bound to the package version and checked again before submission. The operator accepts possible duplicate supplier cost, including when the original outcome is uncertain. No new customer payment is created.

A replacement has a separate order/marker, zero additional customer charge, and the same original sale/payment relationship. Original evidence remains. The sale has one active delivery; pending original receipts are superseded. A leased receipt must finish before changing financial disposition. Account/checkout status and authorized original order links expose the active replacement. Affiliate commission remains attached to the original sale and is never earned twice.

Top-up replacements preserve the original ICCID, validate its ownership and current package eligibility, and never create or reassign a profile. Top-ups do not send a new installation receipt.

Replacement previews require a known supplier cost and identify the supplier API environment. The journal retains the accepted package version, supplier amount/currency and original sale. A late response cannot overwrite a final operation outcome established by reconciliation.

**Request supplier reimbursement** submits `/v2/refund` for identified ICCIDs using the provider's documented reason code. It stays requested until Airalo's independently verified outcome is recorded. Supplier credits and customer refunds are separate decisions. Missing supplier identifiers require escalation rather than a guessed refund target.

## Receipts and ownership

Receipt review is linked from the individual receipt queue to its order. Inspect attempts, acceptance uncertainty, next attempt and provider message evidence. **Retry delivery** preserves the immutable payload and idempotency key. The existing 23-hour uncertainty cutoff remains. **Confirm provider acceptance** requires a provider message ID. **Explicitly resend** creates a new key after review and may deliver another copy if an earlier response was lost.

Ownership review restores the existing owner's access only after fresh account email proof and independent evidence. It does not reassign purchases. The Security URL remains available, including password-confirmed global administrator session revocation.

Affiliate incidents open the matching paginated overdue commission or notification queue. Follow its sale/guide links to existing reconciliation controls. Historical affiliate refund forms now link to Payments; new external refunds must enter the payment journal so the financial disposition and commission adjustment stay consistent.

## Health, catalogue and escalation

System health shows worker flags, delivery backlog, scheduler configuration, HTTP history, callback diagnostics and checkout pause controls. Manual recovery uses existing leased stages and limits; it does not masquerade as a scheduled heartbeat. Resume cannot bypass an environment-level checkout shutdown. Timer operations accept only the two existing jobs, retain their commands and URLs, and require supported production commands/origin and Vault readiness before activation.

Missing secrets, deployment flags, merchant configuration and the independent GitHub watchdog require their existing deployment/provider administration channels. Never paste a secret into an incident note. Callback diagnostics are bounded and retained for 30 days without request bodies or tokens.

Catalogue prices are read-only supplier retail values. NAD checkout uses the ZAR retail value at 1:1. Package activation/deactivation remains available with a reason, while stale/missing retail prices continue to block checkout. Sync uses a durable six-minute lease to prevent overlapping runs and records results in Sync Runs and operation history.

The overview reports approved payments, confirmed refunds, net receipts and fulfilled sales separately by original currency and test/live mode. Test payments are excluded by default. Refunds are dated by confirmation; net receipts can be negative when refunding older purchases. Historical approvals without an authoritative timestamp are excluded pending evidence backfill. These figures do not claim settled profit.

Fulfilled sales means current verified delivery for sales whose payments were approved in the selected period. It includes non-affiliate sales and counts only one active delivery per sale. A replacement awaiting completion is unfulfilled; a completed, subsequently refunded delivery remains in this operational count while its refund is reported separately. The overview does not use the affiliate-only fulfilment timestamp as an all-sales measure.

## Validation and rollback

Automated validation uses isolated database/provider fixtures; no test establishes a live DPO capture, customer refund, supplier refund or replacement. Before enabling each capability, validate its real merchant/provider response and confirm a single saved request, appropriate pending state, final verification, correct amount/currency and no duplicate fulfilment or commission.

Run `npm run test:postgres` against the explicitly disposable localhost `simplify_remediation_test` database, then `npm run test:admin-postgres` with the same `TEST_POSTGRES_URL`. The latter uses multiple real PostgreSQL connections to test competing refund reservations, lost responses, fulfilment holds and competing final outcomes. CI runs both commands together. `npm run test:platform` separately requires a disposable local Supabase service; never substitute a production URL. Browser tests use local servers, disposable databases and fixture provider evidence; `ADMIN_BROWSER_BUILD_ORIGIN` can specify the public origin compiled into an existing production artifact when it differs from the test environment.

Disable the financial flag to stop new submissions. Keep the additive schema, operation evidence and pending reservations. Continue verification and reconcile uncertain outcomes. Use the persisted checkout pause to stop new purchases during an incident while existing recovery and access continue.

References: [DPO capture](https://docs.dpopay.com/dpo-pay-by-network/reference/charge-token-auth), [DPO refund](https://directpayonline.atlassian.net/wiki/spaces/API/pages/808949/refundToken), [DPO cancellation](https://directpayonline.atlassian.net/wiki/spaces/API/pages/1356406/cancelToken), [Airalo refund requests](https://developers.partners.airalo.com/request-refund-14583565e0).
