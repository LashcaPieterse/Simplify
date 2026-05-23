# Airalo API Docs

These files are local exports of Airalo Partner API documentation and are the source of truth for Airalo endpoint contracts in this repository.

## Canonical Endpoint Exports

- [`getPackages.md`](getPackages.md): `GET /v2/packages`.
- [`PlaceOrders/SubmitOrder.md`](PlaceOrders/SubmitOrder.md): `POST /v2/orders`.
- [`PlaceOrders/SubmitOrderAsync.md`](PlaceOrders/SubmitOrderAsync.md): `POST /v2/orders-async`.
- [`PlaceOrders/FutureOrders.md`](PlaceOrders/FutureOrders.md): `POST /v2/future-orders`.
- [`Install-E-Sims/GeteSim.md`](Install-E-Sims/GeteSim.md): `GET /v2/sims/{sim_iccid}`.

The previous aggregate `DefaultModule.md` export was removed because it duplicated endpoint-specific content and conflicted with `getPackages.md` on package rate limits and include syntax. Prefer endpoint-specific exports when comparing code or Simplify runbooks to Airalo.
