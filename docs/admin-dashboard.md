# Simplify Admin Dashboard

This admin surface ships within the main Next.js app and stays stylistically aligned with the existing Radix/Tailwind UI.

## Prisma schema (key entities)
- `AiraloPackage`: now stores country metadata, selling price overrides, tagging, notes, and last sync job linkage.
- `SyncJob`: tracks Airalo catalog sync executions and diff previews.
- `PackageTag` / `AiraloPackageTag`: simple tagging bridge for operational labels.
- `PackageNote`: internal notes per package.
- `AuditLog`: lightweight audit entries for pricing, syncs, and toggles.
- `AdminUser`: placeholder for future persisted admins (auth currently uses env-based credentials).

See the full schema in [`prisma/schema.prisma`](../prisma/schema.prisma).

## Next.js folder structure
```
app/
  admin/
    layout.tsx                // Auth-protected admin shell
    page.tsx                  // Sales & analytics overview
    login/
      actions.ts              // Login/logout server actions
      page.tsx                // Admin login screen
    packages/
      page.tsx                // Package listing with filters/search
      [id]/
        actions.ts            // Package detail mutations (price, status, tags, notes)
        page.tsx              // Package detail with analytics & forms
    sync/
      page.tsx                // Sync Center UI + diff preview
    operations/
      actions.ts              // Bulk pricing utilities
      page.tsx                // Operations toolkit + audit log
  api/admin/sync/route.ts     // Mocked Airalo sync endpoint
components/admin/
  AdminShell.tsx              // Sidebar + top bar layout
  BulkPriceEditor.tsx         // Client-side bulk pricing UI
  KpiCard.tsx                 // KPI stat card
  LoginForm.tsx               // Admin login form
  LogoutButton.tsx            // Session terminator button
  RunSyncButton.tsx           // Calls sync API and refreshes UI
  SimpleBarChart.tsx          // SVG bar chart
  SimpleLineChart.tsx         // SVG line chart
  StatusBadge.tsx             // Active/inactive pill
  TagPill.tsx                 // Tag badge
```

## Example implementations
- **Dashboard layout:** `components/admin/AdminShell.tsx` provides the sidebar/top bar shell consumed by `app/admin/layout.tsx`.
- **Packages list:** `app/admin/packages/page.tsx` renders search, filters, pagination, and the catalog table with status and margins.
- **Package detail:** `app/admin/packages/[id]/page.tsx` shows pricing overrides, per-package analytics, charts, notes, and status toggle.
- **Sync center:** `app/admin/sync/page.tsx` pairs the `RunSyncButton` with recent `SyncJob` history and diff preview from the mock Airalo feed.
- **Analytics overview:** `app/admin/page.tsx` aggregates revenue, profit, orders, and charts by date/country/package.

## Auth
Authentication is handled server-side using env-based credentials (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) with an HMAC-signed cookie (`simplify-admin-session`). Middleware protects `/admin` and `/api/admin/*` paths.
