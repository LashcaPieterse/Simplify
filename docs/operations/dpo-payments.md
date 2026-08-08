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
| `NEXTAUTH_SECRET` | Secret used by NextAuth sessions. |
| `ORDER_ACCESS_SECRET` | Secret used to sign scoped checkout/order access cookies for guest checkouts. |

`NEXT_PUBLIC_APP_URL` (or `VERCEL_URL`) must also point to the public HTTPS domain so that checkout creation can construct absolute callback URLs.

Configure the DPO merchant account Push Payments Callback URL to:

```text
https://<production-domain>/api/payments/dpo/push
```

The legacy `/api/payments/dpo/ipn` path remains as a compatibility alias, but new DPO configuration should use `/api/payments/dpo/push`.

## Checkout lifecycle

1. `/api/checkouts` validates the requested package, persists a `CheckoutSession`, and creates a DPO transaction.
2. `/api/checkouts` sets a scoped HTTP-only checkout access cookie. Authenticated users can also access their own checkout by session ownership.
3. Customers are redirected to DPO's hosted page. On completion DPO redirects the browser to `/checkout/[id]/return` and may send a server-to-server Push Payments Callback to `/api/payments/dpo/push`.
4. The Push Payments handler accepts DPO XML, stores accepted payloads in `PaymentTransactionEvent`, calls DPO `verifyToken`, compares amount and currency with the stored checkout payment, and finalises the order only when both the push payload and the verified transaction are approved.
5. New-plan checkouts finalise through Airalo `/v2/orders` or `/v2/orders-async`; top-up checkouts finalise through Airalo `/v2/orders/topups` with the original eSIM ICCID.
6. The return page polls `/api/checkouts/[id]/status` until the order is finalised, redirecting to `/orders/{orderId}` for new plans, `/orders/{originalOrderId}` for top-ups, or `/checkout/{id}/failed`.
7. When finalisation exposes an order ID, the status API sets scoped HTTP-only order access cookies for guest order-page and eSIM-instruction access.

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

### Credential rotation

1. Request new credentials from DPO (company token, service type).
2. Update platform secrets and redeploy.
3. Verify health by creating a checkout in the sandbox environment and ensuring it moves to `approved` status.

## Metrics and logging

The integration emits structured logs via `payments.*` events. Instrumentation hooks into the existing order observability pipeline so alerts can be configured on payment error rates and latency using the log-based metrics.
