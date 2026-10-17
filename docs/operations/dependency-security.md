# Dependency Security Triage

Last reviewed: 2026-10-17.

## Current Status

`npm run security:audit` reports zero production vulnerabilities as of this review. The checked lockfile resolves Next 16.4.2, React 19.2.3, NextAuth 4.24.15, Sharp 0.35.5, source-map-js 1.2.2, and the Sanity 7 API client. Advisory results can change; rerun the check for every release.

## Runtime decisions

- Sanity Studio and its CLI are development-only dependencies and are deployed separately. The customer runtime uses `@sanity/client` and `@sanity/image-url`; it does not ship the Studio or deployment CLI.
- The old, unused React map/D3 dependency chain was removed.
- Magic-link sign-in sends through the existing Resend client. It does not import NextAuth's Nodemailer provider. The optional peer is locked to patched Nodemailer 10.1.2. Keep the override under review when upgrading NextAuth.
- Node 22.12 or newer in the Node 22 line is required by the current Sanity tooling.

The complete development tree can still report advisories inside Sanity's deployment CLI. Those packages are not bundled into the storefront. Run Studio commands only in a trusted development environment, do not process untrusted archives or configuration through the CLI, and review upstream releases regularly.

## CI Policy

CI must run `npm run security:audit` as a blocking production-tree gate alongside typecheck, lint, tests, and build. A new production advisory fails the command and must be triaged before deployment.
