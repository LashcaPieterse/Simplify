# SIM.Africa Admin Dashboard

The admin dashboard ships inside the main Next.js app and is protected by the env-based admin session cookie.

## Current routes

```text
app/(admin)/admin/
  layout.tsx
  page.tsx
  packages/page.tsx
  packages/[id]/page.tsx
  operations/page.tsx
  payments/page.tsx
  payments/[id]/page.tsx
  orders/page.tsx
  orders/[id]/page.tsx
  receipts/page.tsx
  health/page.tsx
  audit/page.tsx
  security/page.tsx
  affiliates/attention/page.tsx
  settings/page.tsx
  sync/page.tsx
  sync-runs/page.tsx
  sync-runs/[id]/page.tsx

app/(admin-auth)/admin/login/
  page.tsx
  actions.ts

app/api/admin/
  health/sync/route.ts
  sync/route.ts
  operations/route.ts
  operations/preview/route.ts
  incidents/route.ts
```

## Key Prisma models

- `Country`, `Operator`, `Package`, `PackageState`: authoritative Airalo retail catalogue, sync freshness and local availability.
- `SyncRun`, `SyncRunItem`, `EntitySnapshot`, `PackageSyncPage`: catalog sync audit trail and raw Airalo page snapshots.
- `AdminUser`, `AuditLog`, `SyncJob`: legacy/admin support tables that still exist in the schema.
- `EsimOrder`, `EsimProfile`, `CheckoutSession`, `PaymentTransaction`: order/payment records surfaced in operational views.
- `AdminOperation`, `PaymentRefund`, `IncidentReview`, `OperationsSettings`, `PaymentCallbackDiagnostic`: durable commands, refund reservations, triage, checkout pause and sanitized diagnostics.

See the full schema in [`prisma/schema.prisma`](../prisma/schema.prisma).

## Admin components

- `components/admin/DpoGatewayControl.tsx`: shows test/live DPO mode and credential readiness, and switches all new purchases and top-ups through an authenticated server action. Settings persist in `DpoSettings`; existing payments retain `PaymentTransaction.dpoMode`. See the [DPO runbook](operations/dpo-payments.md) for secrets and migration rollout.
- `components/admin/AdminShell.tsx`: sidebar/top-bar shell.
- `components/admin/RunSyncButton.tsx`: starts the server-side Airalo sync audit job through `app/api/admin/sync/route.ts`.
- `components/admin/OperationForm.tsx`, `IncidentControls.tsx`, `OpsUI.tsx`: confirmations, incident reviews and linked operational timelines.
- `components/admin/KpiCard.tsx`, `SimpleBarChart.tsx`, `SimpleLineChart.tsx`, `StatusBadge.tsx`, `TagPill.tsx`: reusable UI pieces.

## Auth

Admin login uses `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and optional `ADMIN_ALLOWED_EMAILS`. Successful login creates the HTTP-only `simplify-admin-session` cookie. `lib/admin/guards.ts` protects `/api/admin/*`; page-level admin access is enforced by the admin layout/session helpers.

Sync-run report downloads contain `run`, `items`, `snapshots`, and `snapshotLimits`. Catalogue publishing and published-price comparisons have been retired; storefront and checkout read the supplier catalogue directly.

## Operational control overhaul

Operations is now an incident inbox with affected-record links, review notes, acknowledgement, escalation and recurrence history. Payments, Orders & delivery, Receipts, System health and Audit history provide searchable investigations and guarded recovery. Mobile navigation exposes every admin section.

The previous price editors changed legacy price fields instead of checkout retail prices; those controls are removed. Catalogue pages show authoritative supplier retail prices and availability controls. Reporting separates approved payments, refunds, net receipts and fulfilled sales, excluding test payments by default.

Durable financial operations, original-currency refund reservations, explicit goodwill replacements and fulfilment holds are additive to the existing lifecycle/outbox safeguards. Financial capabilities remain disabled until configured and validated. See the [operator and deployment runbook](operations/admin-operations.md).

## Audit disposition — 26 October 2026

| Audited limitation | Implemented response |
| --- | --- |
| Counts without an investigation path | Incident links and shared predicates for payment, receipt, supplier and affiliate attention queues |
| Recovery stops at instructions | Authenticated commands, saved operations, provider outcome reconciliation and record-specific eligibility |
| Receipt review lacks purchase context | Linked order/payment evidence, readiness, attempts, acceptance evidence and keyboard-operable review |
| Price editors do not affect checkout | Override/markup controls removed; read-only supplier retail values and guarded availability controls |
| Revenue counts unpaid orders | Separate approved payments, confirmed refunds, net receipts and fulfilled sales by currency/environment |
| Scheduler diagnostics require infrastructure access | System health, backlog/HTTP evidence, bounded manual recovery and allowlisted timer controls |
| Mobile navigation disappears | Visible mobile navigation, loading states and explicit unavailable states |

Local validation: 377 unit/integration tests passed, one skipped; six browser tests passed; five additional real PostgreSQL concurrency tests passed. Production build, typecheck, lint, operational checks and four watchdog tests passed. The production dependency audit reported zero vulnerabilities. PostgreSQL 16.14 fresh installation, historical upgrade, schema parity and record preservation passed against a disposable database.

The Supabase extension/timer suite still requires the disposable local Supabase service provided by CI. It was not run locally because that service is unavailable. Live incident causes and real provider financial behaviour remain unverified. No production migration, deployment, provider mutation or customer message was performed during validation. Release the additive migration and investigation workspace first; keep financial flags disabled until each controlled provider validation succeeds.
