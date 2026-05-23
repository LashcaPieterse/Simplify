# Dependency Security Triage

Last reviewed: 2026-05-23.

## Current Status

`npm audit --omit=dev --json` reports 38 production advisories after removing the unused `sqlite3` runtime dependency:

- 16 high severity
- 22 moderate severity
- 0 critical severity

`sqlite3` was not imported by the app and the Prisma datasource is Postgres, so it was removed from runtime dependencies. That eliminated the `sqlite3`/`node-gyp` advisory chain and reduced installed production packages.

## Remaining High-Priority Items

- `next` / `next-sanity`: audit recommends major upgrades (`next@16.2.6`, `next-sanity@13.0.3`). Treat this as a framework upgrade project with full build, auth, Sanity Studio, ISR, checkout, and admin regression testing.
- `react-simple-maps` / `d3-*`: the current map dependency pulls vulnerable D3 transitive packages. Replace the map component or verify an upgrade path before production traffic.
- `sanity` / `@sanity/vision`: `sanity@3.99.0` is the non-major audit fix for several Studio advisories, but it may require Node 20 and Studio QA.
- `next-auth`: audit flags the transitive `uuid` chain. Review whether the issue applies to the configured providers, then plan a migration or patch strategy.

## CI Policy

CI runs `npm run security:audit` as a report-only step until the major framework and Studio upgrades are completed. Do not treat a passing typecheck/build as security clearance while this document lists unresolved high-severity runtime advisories.

