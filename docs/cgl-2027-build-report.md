# CGL 2027 — implementation and launch status

> Historical note: this report records the original November 2026 review release. The hosted CGL migrations, read-only SGT connection and live one-off Square checkout were completed later. See [the current master implementation audit](cgl-2027-master-audit.md) before making launch decisions.

The implementation adds a CGS-branded public clubhouse, member portal and protected league administration alongside the existing CGS events. On 4 November 2026, CGS approved publishing the website for member review at https://crossodoggolf.com/cgl. This is **a website review release**: hosted CGL migrations have not been applied, membership sales are closed, Square credentials are not configured, and several provider-dependent billing operations remain disabled. See [the review release record](cgl-member-review-release.md).

## Implemented

- Authentic supplied CGS bulldog asset, blue/yellow/navy presentation, responsive navigation, public standings, player histories, honours and performance highlights.
- A/B divisions, explicit future C Grade setting, accepted SGT handicaps, qualification progress and audited division overrides. New rules are separate from the earlier trial.
- Four two-nine-hole scoring formats, versioned regular 500-point placement table, division points, configurable countback, manual tie review, best eight of ten and annual calculations gated by approval.
- Season creation, thirteen-fixture generation, individual dates and deadline extensions, block publication, official read-only SGT Club API sync, reviewed result revisions, calculation and publication.
- Configured full and casual plan records, verified member ownership, server-side access checks, cancellation quotes/requests and failed-payment grace rules.
- Square Sandbox hosted checkout adapter, current-price quotes, explicit amount confirmation, signature verification, provider re-reading, payment reconciliation and idempotent entitlements. Returning from checkout does not activate membership.
- Transactional credit awards and redemptions, earliest-expiry spending, immutable history, eighteen-month defaults, stock management, compensating reversals, gift eligibility and fulfilment.
- Private payment/credit reports, actual revenue separated from forecasts, financial scenario controls, CSV exports, in-app notices, policy review screens and an audit trail.

## Main routes

| Route | Purpose |
| --- | --- |
| `/cgl` | Public clubhouse and trial access |
| `/cgl/competition`, `/cgl/calendar` | Published events and seasons |
| `/cgl/leaderboard`, `/cgl/annual` | Weekly scores and championship standings |
| `/cgl/players/[username]` | Published 2027 history; existing trial profiles preserved |
| `/cgl/memberships`, `/cgl/join`, `/cgl/dashboard` | Pricing, account access and private member features |
| `/cgl/prizes`, `/cgl/rules`, `/cgl/faq`, `/cgl/terms`, `/cgl/archive` | Public information and review states |
| `/cgl/trial` | Existing SGT embeds and five linked public trial identities |
| `/cgl/preview/2027` | Read-only fictional field using the real calculation engine |
| `/cgl/preview/2027/players/[username]` | Fictional player history; no external SGT identity claimed |
| `/clubhouse-admin/cgl` | Protected operations centre |
| `/api/cgl/*` | Public/member/admin, checkout, webhook and maintenance endpoints |

The earlier fictional designs remain under `/cgl/preview`, `/cgl/preview/standings` and their original sample round/player links. Preview data never enters the live API or database. The new development fixture contains twenty full members, four casuals and a thirteen-week season; all identities are synthetic.

## Database and configuration

Prepared additive migrations, in order:

1. `supabase/migrations/20261106202122_cgl_2027_platform_foundation.sql`
2. `supabase/migrations/20261106202134_cgl_square_sandbox_billing.sql`

They add CGL tables and internal transactional functions without changing existing Auth accounts, profiles, trial results, event tables or Stripe integration. RLS and explicit grants keep browser roles away from private tables and write functions. An unapplied schema produces an honest setup-required response; the website does not substitute fictional results.

Existing Supabase variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Administrator access uses verified, server-managed `app_metadata.cgl_role`, or the existing shared login only when **all** strong settings are configured: `CGS_ADMIN_USERNAME`, `CGS_ADMIN_PASSWORD` and `CGS_ADMIN_SECRET`. The optional environment credentials extend the shared login; CGL rejects its old default credentials/fallback secret. Never grant authority through editable profile roles or `user_metadata`.

Square variables: `CGL_SQUARE_ENVIRONMENT=sandbox`, `CGL_SQUARE_ACCESS_TOKEN`, `CGL_SQUARE_LOCATION_ID`, `CGL_SQUARE_MERCHANT_ID`, `CGL_SQUARE_WEBHOOK_SIGNATURE_KEY`, `CGL_SQUARE_WEBHOOK_URL`, `CGL_SQUARE_CHECKOUT_ENABLED`, `CGL_SQUARE_TERMS_APPROVED`. Keep enablement/approval off until the staging setup is reviewed. Membership terms also require database approval. Server secrets have no public prefix.

Maintenance uses `CGL_JOB_SECRET`. No live maintenance schedule or new email automation was installed.

See [database and operating instructions](cgl-database-and-operations.md), [Square connection instructions](cgl-square-setup.md), [calculation sources](cgl-rules-sources.md), and the manual, empty-staging-only rollback file at `supabase/rollback/cgl_2027_empty_only.sql`.

## Verified locally

- **109 automated tests passed** through `npm run test:cgl`. These include real execution of the prepared SQL in isolated PGlite databases, account ownership, public/private projections, membership rules, calendar renewal boundaries, all scoring formats, points/countback, credit expiry and transaction rollback, stock limits, gift rules, fixture publication and payment/award replay.
- TypeScript, repository ESLint and production compilation were checked. The existing sitemap's dynamic-scoreboard fallback warning is unrelated to CGL and does not fail the build.
- Browser checks: actual navigation, division filtering, points sorting, gross sorting, search/empty/reset states, populated fictional histories, mobile layout and protected sign-in boundaries.
- Local HTTP checks: home, CGL home/trial/member shell, Tim's existing trial profile and preview return 200. Anonymous member/checkout requests return 401; admin data returns 403. The hosted CGL schema correctly reports 503 until explicitly installed.
- Public HTML was checked for supplied private tester email addresses and long SGT IDs; those details were absent. Existing public business contact metadata remains unchanged.

Tests use pinned `@electric-sql/pglite` as a development dependency. They do not connect to hosted Supabase or create customer accounts, payments or awards.

## Incomplete or blocked mechanisms

| Mechanism | Exact status |
| --- | --- |
| Hosted CGL persistence | Migrations prepared and locally tested; applying them needs an approved staging database. No hosted schema was changed. |
| Actual Square Sandbox checkout | Adapter and reconciliation tests pass; merchant/location/webhook/plan credentials are absent. No provider payment/subscription was created. |
| Prorated initial provider charges and plan upgrades | Quote rules are tested. Provider settlement is blocked rather than starting an unverified or duplicate subscription. A tested saved-card/Subscriptions workflow is still required. |
| Automatic season-boundary provider cancellation | Quotes and requests are stored. Provider execution requires a supported, verified Square workflow; maintenance reports requests for review and never cancels early. |
| Payment-card replacement | Hosted subscription consent is supported; a replacement-card management flow has not been completed. |
| Membership/season-fee credit discounts and cash-plus-credit settlement | Data/rule boundaries exist, but the Square-linked settlement mechanism is disabled. Fully credit-funded physical merchandise redemption works locally. No arbitrary 25% credit cap is introduced. |
| Automatic SGT synchronisation/provisioning | No documented feed/export/API credentials are available. Existing embeds work; traceable, reviewed manual result import is implemented. CGL cannot remotely block entry inside SGT. |
| Transactional CGL emails | In-app notices and safe previews/templates exist. A delivery provider is not connected; no email is claimed as sent. Existing CGS Auth email processes remain unchanged. |
| Legally approved terms, exact launch dates, annual formula | Awaiting CGS decisions/review. Draft terms are explicitly labelled. C Grade remains inactive. |
| Full authenticated browser acceptance against hosted services | Requires the approved staging database, test accounts and Square Sandbox configuration. Local contract/database tests are not a substitute for this step. |

## Staging and launch checklist

1. Approve and configure an isolated staging Supabase project. Back up existing production data; inspect migration history and apply only the two new migrations in order.
2. Configure staging server variables and an individual verified administrator role or strong shared credentials. Test results/support role restrictions.
3. Review seeded prices, benefits, credit rules and the sourced points table. Record approved versions. Confirm exact season dates, courses, conditions, divisions and fixture windows.
4. Follow the Square guide to connect an AUD Sandbox seller/location and three supported subscription variations; configure signed webhook delivery and keep production billing disabled.
5. Test checkout → webhook → membership → eligibility → real SGT manual import → verify → publish → credit award → redemption → fulfilment. Replay payments/imports and verify no duplicate benefits.
6. Validate refunds, failed payments, original billing anniversaries, cancellation disclosures, gift eligibility, stock exhaustion, credit expiry, audit exports and privacy with staging accounts.
7. Confirm a supported SGT import/export operating process and determine whether an official automated feed is available. Never infer data from inaccessible embeds.
8. Resolve all disabled billing mechanisms intended for launch, connect approved email delivery/maintenance scheduling and test receipts/reminders.
9. Obtain final CGS approval and the required Australian legal review for memberships, renewal/cancellation commitments, prizes, credits, privacy and consumer rights. Publish reviewed documents before taking real payments.
10. Recheck existing CGS events, trial accounts/results, deployment region and rollback recovery. Moving beyond the approved website review release to an operational league and live billing requires separate explicit approval.

The website review release is deployed to the existing production domain with a review notice and a prominent link to fictional example standings. No live database migration, charge, subscription, invitation or hosting-region change was performed for this release.

## Design reference

Reviewed GSL's [public leaderboard](https://golfsimleagues.co.uk/leaderboard/), [prizes](https://golfsimleagues.co.uk/prizes/), [handicaps](https://golfsimleagues.co.uk/how-gsl-handicaps-actually-work/) and [registration](https://golfsimleagues.co.uk/sign-up/) for information architecture. Its [dashboard](https://golfsimleagues.co.uk/dashboard/) requires sign-in; no private dashboard content was accessed. CGL uses original components, CGS's supplied artwork and CGL's own business rules.
