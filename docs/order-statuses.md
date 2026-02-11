# Order and eSIM status lifecycle

This project stores eSIM order/profile statuses as provider-driven strings (from Airalo), with a default value of `pending`.

## When status changes from `pending`

An order/profile status can move away from `pending` in either of these moments:

1. **At order creation time**
   - During order persistence, `esimOrder.status` and `esimProfile.status` are initialized from Airalo's order response (`order.status`), with fallback to `pending` if the field is missing.
2. **When Airalo webhook events arrive**
   - The Airalo webhook handler updates both `esimOrder.status` and `esimProfile.status` to `payload.data.status`.
   - Webhook payloads may also include `previous_status`, which indicates the prior provider state.

## Source-of-truth for "when did it change"

To determine _exactly when_ a status changed for a specific order, check:

- `WebhookEvent.createdAt` / `WebhookEvent.processedAt` rows for that order.
- `EsimOrder.updatedAt` and `EsimProfile.updatedAt` timestamps.

The order page currently shows the latest status value but not a full per-status timeline.

## Other status options in codebase

### eSIM order/profile status

- Stored as `String` (free-form), default `pending`.
- Values are not enum-restricted by Prisma or Zod in this app.
- Practically, any status string sent by Airalo can be stored (for example, `active`, `expired`, etc., depending on provider payloads).

### Payment status (DPO transaction)

Observed/handled statuses:

- `pending`
- `approved`
- `failed`
- `declined`
- `cancelled`

### Checkout session status

Observed statuses:

- `pending`
- `paid`
- `failed`
