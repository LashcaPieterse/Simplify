# Dependency Security Triage

Last reviewed: 2026-10-23.

## Current Status

`npm run security:audit` reported zero production vulnerabilities on 2026-10-23 after the editorial service removal. Advisory results can change; CI checks the lockfile for every release.

## Runtime decisions

- Travel guides use local Markdown, parsed with gray-matter and rendered with react-markdown. Raw HTML is disabled, default safe URL handling is retained, and article images must exist locally.
- The old, unused React map/D3 dependency chain was removed.
- Magic-link sign-in sends through the existing Resend client. It does not import NextAuth's Nodemailer provider. The optional peer is locked to patched Nodemailer 10.1.2. Keep the override under review when upgrading NextAuth.
- Development, CI, and production use Node 22.12 or newer in the Node 22 line.

## CI Policy

CI must run `npm run security:audit` as a blocking production-tree gate alongside typecheck, lint, tests, and build. A new production advisory fails the command and must be triaged before deployment.
