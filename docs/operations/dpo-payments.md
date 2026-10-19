# DPO payment gateway runbook

This document covers the SIM.Africa integration with the DPO payment gateway. The flow gates order fulfilment behind a successful DPO transaction for both new plans and top-up purchases.

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

The legacy `/api/payments/dpo/ipn` path remains as a compatibility alias, but new DPO configuration should use `/api/payments/dpo/push`.

## Checkout lifecycle

1. `/api/checkouts` validates the requested package, persists a `CheckoutSession`, and creates a DPO transaction.
2. `/api/checkouts` sets a scoped HTTP-only checkout access cookie. Authenticated users can also access their own checkout by session ownership.
3. Customers are redirected to DPO's hosted page. On completion DPO redirects the browser to `/checkout/[id]/return` and may send a server-to-server Push Payments Callback to `/api/payments/dpo/push`.
4. The Push Payments handler accepts DPO XML and records matched notifications in `PaymentTransactionEvent`. Push fields are untrusted notifications: only the server-side `verifyToken` result may change payment state or authorize fulfilment. Verification compares the provider's amount and currency with the stored payment. An already independently approved payment remains approved on callback replay. A failed or mismatched push cannot downgrade it. If verification cannot complete, the handler preserves state and returns HTTP 503 so callback delivery can be retried.
5. New-plan checkouts finalise through Airalo `/v2/orders` or `/v2/orders-async`; top-up checkouts finalise through Airalo `/v2/orders/topups` with the original eSIM ICCID.
6. The return page polls `/api/checkouts/[id]/status` until the order is finalised, redirecting to `/orders/{orderId}` for new plans, `/orders/{originalOrderId}` for top-ups, or `/checkout/{id}/failed`.
7. When finalisation exposes an order ID, the status API sets scoped HTTP-only order access cookies for guest order-page and eSIM-instruction access.
8. The branded delivery email is claimed only after personalised QR or manual activation values are available. Async Airalo webhooks hydrate missing installation data and retry delivery without allowing email failure to invalidate the supplier acknowledgement.

## Runbook

### Incident: customers receive plans without paying

1. Verify DPO status for the affected `checkoutId` using the `PaymentTransaction` record in the database (`transactionToken`, `providerReference`).
2. Check Cloud logs for events `payments.checkout.create`, `payments.checkout.dpo_error`, and `payments.checkout.finalized`.
3. If the Push Payments Callback was missed, manually trigger verification via `/api/checkouts/{id}/status` to force a DPO re-query. The handler is idempotent and will finalise the order when payment is approved.
4. If payment failed, instruct the customer to retry via `/checkout/{id}`.

### Incident: Push Payments callback failures

1. Confirm the DPO merchant account callback URL is `/api/payments/dpo/push` on the public HTTPS production domain.
2. Inspect platform logs for invalid XML, unknown transaction references, and `payments.checkout.verification_mismatch`.
3. Accepted push callbacks are stored in `PaymentTransactionEvent` with `eventType=dpo-push`.
4. DPO expects the endpoint to acknowledge accepted callbacks with XML `<Response>OK</Response>`.
5. If DPO provides source IP ranges, configure platform/network allowlisting without disabling server-side `verifyToken`.

### Verify browser-independent callback delivery

1. Have DPO confirm the test merchant's Push Payments Callback URL is `https://sim.africa/api/payments/dpo/push` and notifications are enabled. Shared test API credentials do not establish that merchant configuration. The `CallBackURL` field sent by the app is not listed in DPO's current `createToken` transaction fields; do not treat it as proof of callback registration.
2. Capture the baseline payment events and request-log window. DPO can resend a genuine notification for an existing test transaction, if supported, to verify transport and duplicate handling without another purchase. A resend for an already fulfilled order does not prove initial fulfilment without a browser return.
3. For a full test, complete one approved sandbox payment using dummy card details and block browser requests to SIM.Africa after submission. Do not open the return page or call the checkout status endpoint; both can initiate verification and invalidate this test's evidence.
4. Observe DPO's POST in Vercel logs, a matching `dpo-push` event, server verification and a single fulfilled supplier order/profile. Match timestamps and payment identifiers. Confirm receipt separately.
5. Do not manually fabricate a successful provider payload or label a local mock test as a genuine DPO notification. Missing callback evidence leaves the end-to-end test unverified.

See DPO's [Push Payments Callback contract](https://docs.dpopay.com/dpo-pay-by-network/reference/pushpayments) and [createToken fields](https://docs.dpopay.com/dpo-pay-by-network/reference/create-token).

### Credential rotation

1. Request new credentials from DPO (company token, service type).
2. Update the relevant `DPO_TEST_*` or `DPO_LIVE_*` platform secrets as a complete pair and redeploy. Pending payments require access to the original merchant account; the mode snapshot does not version rotated credentials.
3. Verify health by creating a checkout in the corresponding mode and checking its hosted gateway. Complete payment verification in a controlled test.

## Metrics and logging

The integration emits structured logs via `payments.*` events. Instrumentation hooks into the existing order observability pipeline so alerts can be configured on payment error rates and latency using the log-based metrics.
