# CGL member review release — 4 November 2026

The user approved making the current website live so other members can review it. The release is available at **https://crossodoggolf.com/cgl**. Populated fictional standings and player histories are available at **https://crossodoggolf.com/cgl/preview/2027**; actual trial players and SGT embeds remain under **https://crossodoggolf.com/cgl/trial**.

## Release record

- Existing Vercel project: `prj_l7zZsfD5y9NzrvWKwuLPIF71PBXP`, team `team_ZFejA3YiR5YL0eG7MiENlFPA`.
- Deployment: `dpl_F1L29spkbcerybgHqBu7Q1ULo1Th`.
- Deployment URL: https://cgs-website-byvjq4uo2-dwehl28s-projects.vercel.app.
- Production aliases verified: `crossodoggolf.com`, `www.crossodoggolf.com`, `cgs-website-dwehl28s-projects.vercel.app`.
- Function region remains Singapore (`sin1`).
- Source: current uncommitted CGL/account work on `codex/bright-redesign-scoreboard`, based on `d340e82e19837fc37e7f37b2c3a4d27c1a7868f0`. This is an API source deployment; no Git commit or push was created.
- Sanitized runtime manifest: `.vercel/cgl-member-review-manifest.json` (local, ignored). It contains 261 files. Text line endings were normalized for publishing. Environment files, operational account scripts, SQL migrations, private documents, tests, local builds and SSL bundles were excluded.
- Previous production deployment retained for recovery: `dpl_7p6WNJnoaKn9GvL3oSfy1o2GLyzm`.

## Review boundaries

The shared CGL banner states **“Member review · Membership sales are closed”** and links directly to the populated example standings. Fictional preview pages identify their players and scores as samples. Proposed prices and draft policies remain labelled.

No CGL database migration or seed was applied to hosted Supabase. No payment credentials, billing enablement, maintenance schedule, invitation, customer password or hosting setting was changed. Checkout remains disabled and Sandbox-only. Existing CGS accounts continue to work; reviewers who choose normal account registration use the existing real CGS account process.

The 2027 live standings remain empty until approved data setup and publication. The public API correctly returns `503 setup_required`; member and admin interfaces preserve their access controls. This is not a claim of completed hosted league or Square acceptance testing.

## Verification

- Local ESLint and production build passed after the review-banner change. The earlier implementation suite passed 109 tests; a text/link-only review notice did not require new business-rule tests.
- Vercel build completed and deployment reported `READY`, production, `sin1`, with no alias error.
- Unauthenticated live HTTP checks passed for CGS home/events/scoreboard/account setup and CGL home/memberships/trial/Tim's player page/dashboard/example standings. Public pages require no Vercel login.
- Anonymous member and checkout APIs returned `401`; the admin API returned `403`; the public CGL API reported the expected unapplied-schema state.
- Live CGL home, trial, Tim's profile and the fictional standings were checked for supplied private tester email addresses and long SGT identifiers: no matches. CGL pages retain `noindex` for review.
- Browser review confirmed the memberships page, review notice and working link to populated sample standings.

Future operational launch work remains in [the build report](cgl-2027-build-report.md), including staging persistence, Square Sandbox acceptance, verified SGT imports, final season details and policy approval.
