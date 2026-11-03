# DPO payment gateway runbook

This document covers the SIM.Africa integration with the DPO payment gateway. The flow gates order fulfilment behind a successful DPO transaction for both new plans and top-up purchases.

New payments use NAD, taking the selected package's ZAR recommended retail price
at 1:1. Customers may browse in USD, NAD, ZAR, EUR or GBP. Follow the
[currency checkout deployment and rollback runbook](currency-checkout.md),
including its required database migration, before deploying this flow.

## Environment configuration

Set the following environment variables in production and non-production environments:

| Variable | Description |
| --- | --- |
| `DPO_TEST_COMPANY_TOKEN` | Test Company ID/token supplied by DPO (`CompanyToken` in XML). |
| `DPO_TEST_SERVICE_TYPE` | Test Service ID supplied by DPO (`ServiceType` in XML). |
| `DPO_LIVE_COMPANY_TOKEN` | Live Company ID/token supplied by DPO. |
| `DPO_LIVE_SERVICE_TYPE` | Live Service ID supplied by DPO. |
| `DPO_COMPANY_TOKEN`, `DPO_SERVICE_TYPE` | Legacy test-only pair, used only when both `DPO_TEST_*` values are empty. Partial explicit test pairs are rejected, and live mode never uses these variables. |
| `DPO_SERVICE_URL` | Base URL for the DPO API (defaults to `https://secure.3gdirectpay.com/API/v6`). |
| `DPO_PAYMENT_URL` | Base URL for hosted payment pages (defaults to `https://secure.3gdirectpay.com`). |
| `NEXTAUTH_SECRET` | Secret used by NextAuth sessions. |
| `ORDER_ACCESS_SECRET` | Secret used to sign scoped checkout/order access cookies for guest checkouts. |

### Dashboard gateway switch

The main `/admin` dashboard shows the active DPO mode, credential configuration status, and **Switch to live** or **Switch to test**. Only authenticated admins can change it. The button is disabled until the target mode has both credential values. Configuration status confirms presence, not that DPO has accepted the credentials.

The mode is persisted in the singleton `DpoSettings` record. All new purchases and top-ups read it at payment creation, without a process cache or redeployment. Each `PaymentTransaction.dpoMode` preserves the chosen mode; browser return verification, status polling and push callbacks use that saved mode even after an admin switches gateways. Missing settings, missing credentials, and database errors stop creation; verification errors preserve the current payment state for retry. Switches are recorded in `AuditLog` with the previous mode, new mode and admin email, without credentials.

Approved test payments retain normal fulfilment, including Airalo purchases/top-ups, receipts and any supplier charges.

### Immediate processing rollout

Apply the forward migration `20261103190000_immediate_checkout_wakeups` before deploying the immediate-processing application. It adds `LifecycleJob.wakeVersion`, `LifecycleJob.lastAttemptAt` and `ReceiptDelivery.wakeVersion`, preserving existing jobs, leases and business records. Use the active migration chain with `prisma migrate deploy`; do not replay the archived baseline or reset a database. Rollback can leave these additive columns in place.

`PURCHASE_LIFECYCLE_ENABLED` and `RECEIPT_OUTBOX_ENABLED` retain their existing roles. Browser return, DPO notifications and supplier completion all use the same leased stages. Work is persisted before acknowledging its trigger. Vercel `after` starts it promptly with a 120-second deadline inside 180-second routes; DPO, Airalo and email requests retain their shorter timeouts and also respect that deadline. A stopped worker is recovered through the existing five-minute scheduler.

New signals increment a durable wake generation without taking an active lease. The owner notices a signal received during its attempt and drains the follow-up work. Verification has a fixed 15-second cooldown measured from `lastAttemptAt`; repeated signals cannot postpone it. Ordinary background backoff remains in force without a new signal. Supplier readiness signals advance readiness retries, while email provider errors, accepted receipts and review states retain their existing policies.

### Initial rollout

1. Configure both credential pairs as server-side deployment secrets. Keep the existing `DPO_SERVICE_URL` and `DPO_PAYMENT_URL`; DPO selects the merchant gateway through the credential pair.
2. Apply migrations with `npx prisma migrate deploy` before deploying the new application. Migration `20261019120000_add_dpo_gateway_mode` initializes test mode, marks existing DPO transactions as test, and restricts settings-table access to the backend.
3. Deploy the application. Existing legacy credentials continue to work for test mode until the explicit test pair is configured.
4. Sign in to `/admin`, verify the configuration status, and use the button to select the desired mode. Verify the hosted gateway redirect. Later switches require no redeployment.
5. Keep both pairs configured while payments from either mode remain in progress. Configure the Push Payments Callback for both DPO merchant accounts using the URL below.

`NEXT_PUBLIC_APP_URL` or `NEXTAUTH_URL` must point to the canonical public HTTPS origin so checkout creation can construct trusted absolute callback URLs. Production checkout fails closed when neither is configured and never trusts a client-supplied `Origin` header for payment callbacks.

Configure the DPO merchant account Push Payments Callback URL to:

```text
https://<production-domain>/api/payments/dpo/push
```

`/api/payments/dpo/push` is the only DPO notification endpoint. The legacy `/api/payments/dpo/ipn` route has been removed and returns 404; it does not redirect. Have DPO confirm the registered URL for each merchant account. Use the URL without a trailing `?`.

## Checkout lifecycle

1. `/api/checkouts` validates the requested package, persists a `CheckoutSession`, and creates a DPO transaction.
2. `/api/checkouts` sets a scoped HTTP-only checkout access cookie. Authenticated users can also access their own checkout by session ownership.
3. Customers are redirected to DPO's hosted page. On completion DPO redirects the browser to `/checkout/[id]/return` and may send a server-to-server Push Payments Callback to `/api/payments/dpo/push`.
4. The Push Payments handler accepts DPO XML, records matched notifications in `PaymentTransactionEvent`, and durably queues verification before returning XML `OK`. A new callback brings an existing pending verification retry forward, preserving active leases and a fixed cooldown of up to 15 seconds. Next.js `after` starts verification after acknowledgement; the short cooldown is awaited there rather than deferred to cron. Push fields remain untrusted: only the server-side `verifyToken` result, with matching amount and currency, may approve payment. Once approved, the callback worker immediately attempts that checkout's leased fulfilment, installation and receipt stages. An already independently approved payment remains approved on replay. Provider failures, active workers, asynchronous supplier results and incomplete stages remain in durable recovery; failure to persist the callback's verification work returns HTTP 503.
5. New-plan checkouts finalise through Airalo `/v2/orders` or `/v2/orders-async`; top-up checkouts finalise through Airalo `/v2/orders/topups` with the original eSIM ICCID.
6. The return page requests `POST /api/checkouts/[id]/reconcile` immediately on return and when reconnecting, then reads `/status` every two seconds for the first two minutes and every ten seconds afterwards while visible and online. Eligible reconciliation requests are spaced by at least 15 seconds initially and one minute after two minutes, respecting `Retry-After` and server eligibility. GET status never calls payment or supplier providers. Completion redirects to `/orders/{orderId}` for new plans or `/orders/{originalOrderId}` for top-ups; confirmed failures redirect to `/checkout/{id}/failed`.
7. When finalisation exposes an order ID, the status API sets scoped HTTP-only order access cookies for guest order-page and eSIM-instruction access.
8. An authenticated async Airalo webhook commits supplier data and durable delivery wakeups before acknowledgement. Post-response work immediately attempts installation hydration, separate DPO processing acknowledgement and eligible receipt delivery. The receipt outbox sends only when personalised QR or manual activation values are ready. Email acceptance is recorded once using its persisted idempotency key; email or installation failure cannot invalidate the supplier acknowledgement or block the separate DPO acknowledgement. Top-up receipt policy is unchanged.

The status response retains `nextCheckAt` for durable background work and adds `verificationInProgress` and `nextReconcileAt` for the interactive path. HTTP 200 on reconciliation means the request was accepted; only `paymentStatus=approved` establishes that independent verification succeeded. A lost browser connection leaves saved work intact and never changes a payment to failed.

## Runbook

### Incident: customers receive plans without paying

1. Verify DPO status for the affected `checkoutId` using the `PaymentTransaction` record in the database (`transactionToken`, `providerReference`).
2. Check Cloud logs for events `payments.checkout.create`, `payments.checkout.dpo_error`, and `payments.checkout.finalized`.
3. If the Push Payments Callback was missed, use the checkout's authenticated or scoped-cookie-authorized `POST /api/checkouts/{id}/reconcile` to request verification, or let the five-minute recovery job retry. `GET /api/checkouts/{id}/status` only reads status and does not query DPO.
4. If payment failed, instruct the customer to retry via `/checkout/{id}`.

### Incident: Push Payments callback failures

1. Confirm the DPO merchant account callback URL is `/api/payments/dpo/push` on the public HTTPS production domain.
2. Inspect `payments.dpo.push.received` and `payments.dpo.push.response` in platform logs. They record the server-observed pathname, method, UTC receipt time, correlation ID and response status without query strings, headers, XML or customer details. Use the correlation ID to connect receipt and response, including rejected notifications; also inspect `payments.checkout.verification_mismatch`.
3. Matched push callbacks are stored in `PaymentTransactionEvent` with `eventType=dpo-push`. The JSON payload retains DPO's fields and adds `request: { pathname, method, receivedAt, correlationId }`. That ID also appears in the acknowledgement's `X-Correlation-ID` header and in `PaymentCallbackDiagnostic` when diagnostic rate/capacity limits allow it. A saved event can precede a failed verification enqueue, so check the response status separately. Older events lack request metadata and cannot establish which historical route was used.
4. DPO expects the endpoint to acknowledge accepted callbacks with XML `<Response>OK</Response>`.
5. If DPO provides source IP ranges, configure platform/network allowlisting without disabling server-side `verifyToken`.

### Test whether DPO sends a notification to `/push`

1. Have DPO confirm that notifications are enabled for the selected **live or test merchant account** and that its registered Push Payments Callback URL is exactly `https://sim.africa/api/payments/dpo/push`. Shared test credentials do not establish that merchant configuration. The `CallBackURL` field sent by the app is not listed in DPO's current `createToken` transaction fields; it does not prove callback registration.
2. Prefer asking DPO to resend a genuine notification for an existing paid transaction, if supported. Live reference `R88113906` was already paid and fulfilled on 2 November 2026; a notification resend should use that existing transaction, with no new charge or capture. Record a UTC test-start time and the latest event/diagnostic IDs before the resend. A replay tests transport and duplicate handling; it does not prove initial fulfilment without a browser return.
3. Observe passively using platform request logs and read-only database queries. For the selected payment, find a **new** `dpo-push` event with `request.pathname=/api/payments/dpo/push`, `request.method=POST`, a receipt time after the baseline, and the matching DPO reference/token. Match its correlation ID to the response log or diagnostic: accepted notifications receive HTTP 200 and XML `<API3G><Response>OK</Response></API3G>` (with an XML declaration). Rejected notifications appear in request logs even when no payment can be matched; best-effort diagnostics include their status.
4. Ask DPO for the delivery attempt's timestamp, destination URL, transaction reference and HTTP response/body, plus the `X-Correlation-ID` if their logs capture it. Match this with our record to establish **DPO-originated** delivery. Our metadata proves which handler received the request; it is not a cryptographic proof of sender identity.
5. Alternatively, complete one new payment on the confirmed merchant account. For test mode use only DPO-approved sandbox payment details. A live test requires the customer's real payment step and incurs a real charge. For browser-independent processing, block browser requests back to SIM.Africa before completing DPO's hosted payment and keep the merchant return page closed. Do not invoke `POST /reconcile` or manually run recovery while collecting evidence. Leave normal recovery enabled; a scheduled verification or completed order alone is not callback evidence. Check independent server verification, a single supplier order/profile and receipt separately from callback receipt.
6. Do not fabricate a successful provider payload or label local mock tests as DPO delivery. Opening `/push` in a browser sends GET (405), which does not test DPO's POST notification. Missing delivery evidence leaves the DPO-originated test unverified. Sandbox delivery and live delivery must each be confirmed for their own merchant configuration.

The five-minute `airalo-order-recovery` scheduler remains the fallback for unresolved work. Callback processing targets only the matched payment and checkout, respects the lifecycle and receipt feature flags, and never reopens supplier review or bypasses an existing job lease. HTTP 200 confirms that the notification and verification work were persisted; inspect payment transitions and the order separately to establish completion.

See DPO's [Push Payments Callback contract](https://docs.dpopay.com/dpo-pay-by-network/reference/pushpayments) and [createToken fields](https://docs.dpopay.com/dpo-pay-by-network/reference/create-token).

### Credential rotation

1. Request new credentials from DPO (company token, service type).
2. Update the relevant `DPO_TEST_*` or `DPO_LIVE_*` platform secrets as a complete pair and redeploy. Pending payments require access to the original merchant account; the mode snapshot does not version rotated credentials.
3. Verify health by creating a checkout in the corresponding mode and checking its hosted gateway. Complete payment verification in a controlled test.

## Metrics and logging

The integration emits structured logs via `payments.*` events. Instrumentation hooks into the existing order observability pipeline so alerts can be configured on payment error rates and latency using the log-based metrics.

`checkout.processing.queued`, `checkout.stage.started`, `checkout.stage.cooldown`, `checkout.stage.finished` and `checkout.receipt.finished` include a server-controlled trigger (`browser`, `dpo_push`, `supplier_webhook` or `recovery`) and correlation ID. Browser reconciliation returns that ID in `X-Correlation-ID`; DPO retains its existing request/event/diagnostic correlation. Supplier work uses its persisted event ID. Trace the initiating request and individual stage timestamps separately from the five-minute recovery schedule and email-provider acceptance.
