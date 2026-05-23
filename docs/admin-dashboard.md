# Simplify Admin Dashboard

The admin dashboard ships inside the main Next.js app and is protected by the env-based admin session cookie.

## Current routes

```text
app/(admin)/admin/
  layout.tsx
  page.tsx
  packages/page.tsx
  packages/[id]/page.tsx
  operations/page.tsx
  pricing-audits/page.tsx
  settings/page.tsx
  sync/page.tsx
  sync-runs/page.tsx
  sync-runs/[id]/page.tsx

app/(admin-auth)/admin/login/
  page.tsx
  actions.ts

app/api/admin/
  catalog-mismatches/route.ts
  health/sync/route.ts
  publishing-state/route.ts
  sanity-sync/route.ts
  sync/route.ts
```

## Key Prisma models

- `Country`, `Operator`, `Package`, `PackageState`: Airalo catalog data plus Simplify selling/availability state.
- `SyncRun`, `SyncRunItem`, `EntitySnapshot`, `PackageSyncPage`: catalog sync audit trail and raw Airalo page snapshots.
- `PricingAudit`, `PublishingState`: price drift and Sanity publishing integrity checks.
- `AdminUser`, `AuditLog`, `SyncJob`: legacy/admin support tables that still exist in the schema.
- `EsimOrder`, `EsimProfile`, `CheckoutSession`, `PaymentTransaction`: order/payment records surfaced in operational views.

See the full schema in [`prisma/schema.prisma`](../prisma/schema.prisma).

## Admin components

- `components/admin/AdminShell.tsx`: sidebar/top-bar shell.
- `components/admin/RunSyncButton.tsx`: starts the server-side Airalo sync audit job through `app/api/admin/sync/route.ts`.
- `components/admin/RunSanitySyncButton.tsx`: starts Sanity catalog publishing.
- `components/admin/BulkPriceEditor.tsx`: bulk price adjustment controls.
- `components/admin/KpiCard.tsx`, `SimpleBarChart.tsx`, `SimpleLineChart.tsx`, `StatusBadge.tsx`, `TagPill.tsx`: reusable UI pieces.

## Auth

Admin login uses `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and optional `ADMIN_ALLOWED_EMAILS`. Successful login creates the HTTP-only `simplify-admin-session` cookie. `lib/admin/guards.ts` protects `/api/admin/*`; page-level admin access is enforced by the admin layout/session helpers.
