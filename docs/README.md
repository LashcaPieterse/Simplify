# Simplify Documentation

This folder contains two kinds of documentation:

- [`Airalo API`](<Airalo API/>): local exports from Airalo. Treat these as the canonical API contract for Airalo endpoint shapes, parameters, examples, and upstream limits.
- App and operations docs: Simplify-specific implementation notes, runbooks, QA procedures, and release/security notes.

When a Simplify doc appears to conflict with the Airalo API exports, update the Simplify doc or the code. Do not add local implementation notes directly into the Airalo API exports.

## Current App Docs

- [`admin-dashboard.md`](admin-dashboard.md): admin routes, schema areas, components, and auth.
- [`airalo-sync-cron.md`](airalo-sync-cron.md): scheduled package sync setup and troubleshooting.
- [`get-packages-schema-review.md`](get-packages-schema-review.md): how local catalog tables align to Airalo `GET /v2/packages`.
- [`order-statuses.md`](order-statuses.md): order, profile, checkout, and payment status lifecycle.
- [`operations/airalo-qa-testing-procedure.md`](operations/airalo-qa-testing-procedure.md): test levels, commands, and Airalo smoke gates.
- [`operations/airalo-runbooks.md`](operations/airalo-runbooks.md): Airalo operational runbooks and observability.
- [`operations/airalo-submit-order.md`](operations/airalo-submit-order.md): Simplify-specific order submission contract and implementation notes.
- [`operations/dependency-security.md`](operations/dependency-security.md): current dependency advisory triage.
- [`operations/dpo-payments.md`](operations/dpo-payments.md): DPO checkout/IPN runbook.
