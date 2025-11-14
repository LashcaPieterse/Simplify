# DPO payment gateway runbook

This document covers the Simplify integration with the DPO payment gateway. The flow gates order fulfilment behind a successful DPO transaction for both new plans and top-up purchases.

## Environment configuration

Set the following environment variables in production and non-production environments:

| Variable | Description |
| --- | --- |
| `DPO_MERCHANT_ID` | Merchant identifier issued by DPO. |
| `DPO_COMPANY_TOKEN` | Company token supplied by DPO for API access. |
| `DPO_API_KEY` | Secret key used to sign API and IPN requests. |
| `DPO_SERVICE_URL` | Base URL for the DPO REST API (defaults to `https://secure.3gdirectpay.com/api/v1`). |
| `DPO_PAYMENT_URL` | Base URL for hosted payment pages (defaults to `https://secure.3gdirectpay.com`). |
| `DPO_IPN_SECRET` | Shared secret for validating IPN notifications. |

`NEXT_PUBLIC_APP_URL` (or `VERCEL_URL`) must also point to the public HTTPS domain so that checkout creation can construct absolute callback URLs.

## Checkout lifecycle

1. `/api/checkouts` validates the requested package, persists a `CheckoutSession`, and creates a DPO transaction.
2. Customers are redirected to DPO's hosted page. On completion DPO sends both a browser redirect to `/checkout/[id]/return` and a server-to-server notification to `/api/payments/dpo/ipn`.
3. The IPN handler validates the signature, stores the payload in `PaymentTransactionEvent`, updates the payment status, and finalises the order when the status is `approved`.
4. The return page polls `/api/checkouts/[id]/status` until the order is finalised, redirecting to `/orders/{orderId}` or `/checkout/{id}/failed`.

## Runbook

### Incident: customers receive plans without paying

1. Verify DPO status for the affected `checkoutId` using the `PaymentTransaction` record in the database (`transactionToken`, `providerReference`).
2. Check Cloud logs for events `payments.checkout.create`, `payments.checkout.dpo_error`, and `payments.checkout.finalized`.
3. If the IPN was missed, manually trigger verification via `/api/checkouts/{id}/status` to force a DPO re-query. The handler is idempotent and will finalise the order when payment is approved.
4. If payment failed, instruct the customer to retry via `/checkout/{id}`.

### Incident: IPN signature mismatch

1. Confirm `DPO_IPN_SECRET` matches the value configured in the DPO dashboard.
2. Inspect the latest `PaymentTransactionEvent` entries for `eventType=ipn` to review the raw payload.
3. Temporarily disable strict signature verification by rotating the secret to match the inbound payloads, then coordinate a full rotation with DPO.

### Credential rotation

1. Request new credentials from DPO (merchant ID, company token, API key, IPN secret).
2. Update platform secrets and redeploy.
3. Verify health by creating a checkout in the sandbox environment and ensuring it moves to `approved` status.

## Metrics and logging

The integration emits structured logs via `payments.*` events. Instrumentation hooks into the existing order observability pipeline so alerts can be configured on payment error rates and latency using the log-based metrics.
