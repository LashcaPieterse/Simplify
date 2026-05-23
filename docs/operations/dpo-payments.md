# DPO payment gateway runbook

This document covers the Simplify integration with the DPO payment gateway. The flow gates order fulfilment behind a successful DPO transaction for both new plans and top-up purchases.

## Environment configuration

Set the following environment variables in production and non-production environments:

| Variable | Description |
| --- | --- |
| `DPO_COMPANY_TOKEN` | Company token supplied by DPO for API access. |
| `DPO_SERVICE_TYPE` | Service type identifier supplied by DPO for the product being sold. |
| `DPO_SERVICE_URL` | Base URL for the DPO API (defaults to `https://secure.3gdirectpay.com/API/v6`). |
| `DPO_PAYMENT_URL` | Base URL for hosted payment pages (defaults to `https://secure.3gdirectpay.com`). |
| `DPO_IPN_SECRET` | Shared secret for validating IPN notifications. |
| `NEXTAUTH_SECRET` | Secret used by NextAuth sessions. |
| `ORDER_ACCESS_SECRET` | Secret used to sign scoped checkout/order access cookies for guest checkouts. |

`NEXT_PUBLIC_APP_URL` (or `VERCEL_URL`) must also point to the public HTTPS domain so that checkout creation can construct absolute callback URLs.

## Checkout lifecycle

1. `/api/checkouts` validates the requested package, persists a `CheckoutSession`, and creates a DPO transaction.
2. `/api/checkouts` sets a scoped HTTP-only checkout access cookie. Authenticated users can also access their own checkout by session ownership.
3. Customers are redirected to DPO's hosted page. On completion DPO sends both a browser redirect to `/checkout/[id]/return` and a server-to-server notification to `/api/payments/dpo/ipn`.
4. The IPN handler validates the `x-dpo-signature` HMAC signature, stores accepted payloads in `PaymentTransactionEvent`, updates the payment status, and finalises the order when the status is `approved`.
5. The return page polls `/api/checkouts/[id]/status` until the order is finalised, redirecting to `/orders/{orderId}` or `/checkout/{id}/failed`.
6. When finalisation exposes an order ID, the status API sets a scoped HTTP-only order access cookie for guest order-page and eSIM-instruction access.

## Runbook

### Incident: customers receive plans without paying

1. Verify DPO status for the affected `checkoutId` using the `PaymentTransaction` record in the database (`transactionToken`, `providerReference`).
2. Check Cloud logs for events `payments.checkout.create`, `payments.checkout.dpo_error`, and `payments.checkout.finalized`.
3. If the IPN was missed, manually trigger verification via `/api/checkouts/{id}/status` to force a DPO re-query. The handler is idempotent and will finalise the order when payment is approved.
4. If payment failed, instruct the customer to retry via `/checkout/{id}`.

### Incident: IPN signature mismatch

1. Confirm `DPO_IPN_SECRET` matches the value configured in the DPO dashboard.
2. Inspect platform logs for `invalid_signature`. Accepted IPNs are stored in `PaymentTransactionEvent` with `eventType=ipn`; rejected IPNs are not persisted.
3. Do not unset `DPO_IPN_SECRET` in production. Production fails closed when the secret is missing.
4. Rotate the secret in both DPO and the platform, redeploy, and replay the affected IPNs if needed.

### Credential rotation

1. Request new credentials from DPO (company token, service type, IPN secret).
2. Update platform secrets and redeploy.
3. Verify health by creating a checkout in the sandbox environment and ensuring it moves to `approved` status.

## Metrics and logging

The integration emits structured logs via `payments.*` events. Instrumentation hooks into the existing order observability pipeline so alerts can be configured on payment error rates and latency using the log-based metrics.
