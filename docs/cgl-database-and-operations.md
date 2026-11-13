# CGL 2027 database and operating guide

## What was audited

The existing site runs Next.js 16.3.8, React 19, TypeScript, Supabase Auth/Postgres and Vercel. CGS already has a shared player account system and Clubhouse Admin. Par 3, Ambrose and Top Dog use their existing independent tables and routes. Existing event payments use Stripe; the CGL billing adapter uses Square Sandbox alongside them. No existing payment integration was replaced.

The previous CGL trial consists of official SGT embeds, public SGT handles from trusted Auth app metadata and a separate fictional presentation preview. The official SGT Club Admin API is now integrated for `CGSBunker` as a read-only source. Its rotating key is encrypted in Supabase Vault, the administrator password is never stored, and a protected 30-minute sync caches tours, tournaments, registrations, scorecards, standings and statistics. The trial remains separate and CGL award publication still uses the existing reviewed result workflow.

Existing Clubhouse Admin previously accepted the literal `admin` / `admin` credentials and a fallback session secret. CGL refuses that legacy fallback. Configure all three `CGS_ADMIN_USERNAME`, `CGS_ADMIN_PASSWORD` and `CGS_ADMIN_SECRET` for the shared login before using it for CGL. Alternatively, use a verified Supabase Auth user whose server-managed `app_metadata.cgl_role` is `super_admin`, `league_admin` or `results_admin`. The profile table's editable `role` field and Auth `user_metadata` are never CGL authority.

## Database changes prepared, not applied

Two CLI-generated additive migrations are prepared as source:

1. `supabase/migrations/20261106202122_cgl_2027_platform_foundation.sql`
2. `supabase/migrations/20261106202134_cgl_square_sandbox_billing.sql`

They create only new `cgl_*` tables/functions and default plan/settings rows. They do not update existing CGS profiles, Auth accounts, SGT trial metadata, existing event results, Stripe records or hosting. They do not seed real players or invented competition scores.

Apply to an approved, isolated staging database first. Do not apply them to production or migrate customer billing without explicit approval. Inspect the existing migration history and take a verified backup before a deployment; do not blindly reset a database or replay historical CGS migrations to make these additions work.

All new tables enable RLS and revoke `anon` / `authenticated` table access. All writes go through the authenticated Next.js server using the existing service-role client. Internal RPCs use `SECURITY INVOKER`, an empty search path and service-role-only execution grants. Public reads are deliberately projected by `/api/cgl/public`; users cannot read arbitrary member/payment records directly through the Data API.

## Entity map

| Area                     | New tables                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| Configuration            | `cgl_settings`, `cgl_plans`                                                               |
| Calendar                 | `cgl_seasons`, `cgl_weeks`                                                                |
| Shared account extension | `cgl_members` (Auth user ID), `cgl_sgt_link_requests`                                     |
| Access and billing       | `cgl_memberships`, `cgl_season_entries`, `cgl_payments`                                   |
| Competition              | `cgl_division_assignments`, `cgl_imports`, `cgl_results`, `cgl_calculations`              |
| Rewards                  | `cgl_prizes`, `cgl_credit_lots`, `cgl_credit_transactions`, `cgl_catalogue`, `cgl_orders` |
| Gifts and operations     | `cgl_gift_items`, `cgl_gifts`, `cgl_notifications`, `cgl_audit_events`                    |
| Square                   | `cgl_square_checkout_intents`, `cgl_square_events` (see Square guide for current names)   |

Credits use immutable ledger entries plus expiry lots. Redemption locks the member, catalogue stock and lots in a transaction, consumes the earliest expiry first, creates an order and decrements stock together. Idempotency keys reject payload conflicts. Failed stock/credit checks roll everything back. Negative balances are refused. Cancelled unfulfilled orders create compensating ledger entries and restore the original expiry rather than extending a credit's life. Ledger/audit history rejects direct edits/deletes.

Weekly award issuance happens in the same transaction as result publication. Source snapshots prevent concurrent source edits from being published accidentally. Repeating publication does not issue another prize. If a correction changes an issued award, explicitly unpublish, reverse the affected credit prize with a reason, review the revised results and publish again. An insufficient available balance blocks automatic reversal and requires administrator reconciliation. Never delete financial history to resolve that condition.

## APIs and response conventions

All routes return `Cache-Control: no-store`. An unavailable schema/configuration returns HTTP 503 with `status: "setup_required"`; a successful response is never fabricated. POST replies are `{ status: "completed", result: ... }`. Errors include a safe actionable `message`.

| Route                                | Authentication                                       | Purpose                                                                                                                   |
| ------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/cgl/public`                | Public                                               | Published calendar, standings, scores, public handles, plans and reward catalogue                                         |
| `GET /api/cgl/member`                | Supabase Bearer token                                | Signed-in member only: account, SGT requests, billing, results, credits, orders, gifts and notices                        |
| `POST /api/cgl/member`               | Supabase Bearer token                                | `join`, `link_sgt`, `quote_cancellation`, `request_cancellation`, `redeem`, `mark_notification_read`, `check_eligibility` |
| `GET /api/cgl/admin`                 | Configured shared admin session or verified CGL role | Role-filtered operating records and confirmed financial totals                                                            |
| `POST /api/cgl/admin`                | Same, permission checked per action                  | League management commands below                                                                                          |
| `GET /api/cgl/admin?export=payments` | League/super administrator                           | CSV export; also supports `credit_transactions`, `orders`, `gifts`, `prizes`, `audit_events`                              |
| `POST /api/cgl/jobs`                 | `Authorization: Bearer <CGL_JOB_SECRET>`             | Credit expiry, physical-prize expiry and Square cancellation review                                                       |
| `POST /api/cgl/sgt/sync`             | `Authorization: Bearer <CGL_SGT_SYNC_SECRET>`        | Refresh the protected read-only SGT cache; called by Supabase Cron every 30 minutes                                        |

Public projections omit contact information, Auth IDs, long SGT IDs, private notes, payment records, fulfilment costs and arbitrary raw import metadata. Public identities use SGT usernames. Only explicitly permitted numeric statistics and verified CTP timestamps leave the public API. Member requests bind ownership to the verified token, ignoring a supplied member ID. Request origins are checked for mutation CSRF; authenticated roles are checked on the server. Financial CSV cells neutralise spreadsheet formula injection.

Results/support administrators can review results/imports but cannot publish credit awards, manage money/rewards/settings or inspect the full private member directory. League administrators can manage league operations. Role changes require the server-managed Supabase Auth administration channel; no client role editor exists.

## Admin command contract

Every admin command requires `action` and a reason of at least five characters. IDs are UUID strings. Monetary amounts are integer AUD cents; credit amounts are integers.

- `create_season` / `save_season`: `record` containing `id?`, `slug`, `name`, `year`, `season_number`, `format`, `starts_at?`, `ends_at?`, `qualification_ends_at?`, `status`, `config`. Non-draft seasons need exact dates.
- `generate_fixtures`: `seasonId`. Creates 13 draft records (3 qualification, 10 championship) for an exact 91-day season. Existing fixtures are never overwritten.
- `save_week`: `record` containing `id?`, `season_id`, `week_number`, `championship_week` (null for qualifying), `name`, `phase`, `opens_at`, `closes_at`, `status`, course names, SGT tournament/tour IDs, conditions and config. Custom `config.stroke_index_order` is an ordered array of distinct stroke indices.
- `publish_block`: `weekIds` (1–13), optional shared `opensAt` / `closesAt`. Enables initial four-round releases or other batches atomically. Locked/archived fixtures are excluded; a published parent season and valid play windows are required.
- `save_plan`: `record` using `code`, `name`, `price_cents`, `billing_interval`, `full_member`, `auto_renew`, `active`, `config`. Casual purchases must remain one-off and cannot auto-renew.
- `update_member`: `record.id`, optional verified handicap/status/date, qualifying holes, eligibility and private notes. It cannot directly edit membership billing or credits.
- `verify_sgt`: request `id`, `state: "verified" | "rejected"`. A member's existing verified link remains unchanged until approval.
- `assign_division`: `memberId`, `seasonId`, optional manual `division`, optional `locked: false` for preparation. An accepted verified handicap is required; C Grade must be explicitly active. Lock each division before importing championship play. Existing assignments are not silently moved by handicap changes.
- `import_results`: see source format below. `correction: true` is mandatory for changed previously imported records.
- `review_result`: result `id`, `state: "pending" | "verified" | "excluded"`.
- `recalculate` / `publish_results` / `unpublish_results`: `weekId`. Publication requires a reviewed approved points-table version, complete verification and no unresolved ties.
- `save_catalogue`: `record` using name, description, `credit_price`, stock, retail/cost/cash cents, image URL, kind, fulfilment method, availability dates and restrictions. Fully credit-funded physical purchases work. Cash-plus-credit purchases and Square-linked payment discounts fail closed pending settlement support.
- `adjust_credits`: `memberId`, signed `amount`, unique `requestKey`. Repeated matching requests are safe; changed payloads are rejected.
- `save_prize`: `record` using `member_id`, `season_id`, `category`, `kind`, `amount`, unique `source_key`, optional `claim_deadline` and metadata. Cash amounts are cents; credit amounts are credits. Cash prizes require approved terms. Physical prizes default to the following season's confirmed end when available.
- `review_prize`: `id`, `state`. Valid progression is pending → verified → approved → awarded → claimed. Approving a credit prize issues the credits and moves it to awarded automatically.
- `reverse_prize`: `id`. Uses an auditable compensating debit for issued credit prizes; it cannot create debt.
- `save_gift_item`: `record` using `season_id`, name, unit cost, stock, active and config.
- `approve_midseason_gift`: `membershipId`. Record a specific review of the prorated membership and payment history before allocation.
- `allocate_gift`: `memberId`, `giftItemId`. Rechecks payment count, active full membership, the configured release week, season conditions and stock in the transaction. One gift per member/season.
- `fulfil_gift` / `fulfil_order`: `id`, `state: "ready" | "dispatched" | "collected"`. `cancel_order` reverses only unfulfilled orders.
- `notification`: `record` with `member_id`, kind, title, body and unique `source_key`. Creates dashboard notice/email preview; does not send email.
- `save_settings`: `record: { key, value }`. Keys are `legal`, `cancellation_policy`, `annual_formula`, `divisions`, `rewards`, `prizes`, `gifts`, `financial`, `sgt`, `points`.
- `connect_sgt`: SGT club administrator `username` and `password`. Exchanges the password once for a rotating API key, stores only that key in Vault, and runs the first sync. Requires settings permission.
- `sync_sgt`: forces a fresh official Club API read. Requires results permission.
- `set_sgt_sync`: `enabled: boolean`. Pauses or resumes scheduled refresh without deleting cached display data. Requires settings permission.

The default settings intentionally leave legal approval, cancellation-policy approval, annual rankings and production prize approval false. `points.value` uses `{version, source, approved, table}`. `annual_formula.value` uses `{approved, method: null | "sum" | "best_seasons", counted_seasons?}`. `gifts.value` uses `{annual_release_week:5, monthly_payments:2, weekly_payments:5, midseason_review_required:true}`. `rewards.value` uses `{credit_expiry_months:18, credits_per_aud:2, payment_redemption_enabled:false, weekly_priority:["net","gross","ctp"], full:{net:20,gross:20,ctp:10}, casual:{net:10,gross:10,ctp:5}}`. The internal credit/AUD conversion is an admin accounting setting, excluded from public/member API projections.

## Official SGT Club API and reviewed CGL publication

The protected Club API cache is the website display source for `/cgl/live`; SGT remains the playing-data source of truth. Public responses remove contact details, provider identifiers, credentials and raw administrative metadata. If SGT is temporarily unavailable, the last successful cache remains visible and the next scheduled run retries. Connecting or renewing the API requires an intentional administrator action because a fully expired provider key cannot be recreated without the SGT login.

Automatic display sync does not silently publish CGL points or prizes. An authorised administrator must still review the relevant official source and use the existing result workflow. Source and scorecard URLs must be HTTPS on `simulatorgolftour.com`. A configured tournament ID must match the source URL. The official completion timestamp must be within the fixture's published play window, never in the future. Different fixtures cannot reuse an imported official result or nine-hole attempt ID.

Each import row represents **one combined weekly result**. Supply the two genuine official nine-hole attempts. For Aggregate the courses match; for Redemption the best eligible attempt counts; World Tour requires different courses; Elements also requires different verified conditions. The scoring engine derives gross/net/counting attempts; browser-supplied combined totals are not accepted.

```json
{
  "action": "import_results",
  "weekId": "ACTUAL_WEEK_UUID",
  "sourceUrl": "https://simulatorgolftour.com/tournament/ACTUAL_TOURNAMENT_ID",
  "reason": "Checked official SGT result and both scorecards",
  "rows": [
    {
      "member_id": "ACTUAL_MEMBER_UUID",
      "external_id": "ACTUAL_STABLE_OFFICIAL_WEEKLY_RESULT_ID",
      "played_at": "2027-03-25T08:30:00Z",
      "handicap": 8.2,
      "scorecard_url": "https://simulatorgolftour.com/scorecard/ACTUAL_TOURNAMENT_ID/ACTUAL_SCORECARD_ID",
      "attempts": [
        {
          "id": "ACTUAL_FIRST_SGT_ROUND_ID",
          "courseId": "ACTUAL_COURSE_ID",
          "holesCompleted": 9,
          "gross": 39,
          "net": 35,
          "eligible": true,
          "verified": true
        },
        {
          "id": "ACTUAL_SECOND_SGT_ROUND_ID",
          "courseId": "ACTUAL_COURSE_ID",
          "holesCompleted": 9,
          "gross": 38,
          "net": 34,
          "eligible": true,
          "verified": true
        }
      ],
      "stats": {
        "gir": 55.6,
        "fir": 57.1,
        "total_putts": 31,
        "longest_drive_metres": 251.2,
        "putting_distance_metres": 22.4
      }
    }
  ]
}
```

These are format examples, not records to import. Replace every identifier and verify every value against SGT. Optional attempt `holes` contain `{strokeIndex, gross, net, segment?}`. Never invent hole scores or indices to resolve a tie. Optional `conditionsId` is required for Elements. Optional statistics use these exact units: GIR/FIR percentage **0–100**, driving/putting/CTP distances **metres**, putts/birdies/eagles/par saves **integer counts**. Convert a documented source's feet/yards or fractions explicitly before importing; no unit is guessed. `ctp_verified_at` is the actual verified qualifying timestamp, not the time an admin opened the source. Equal CTP values without that evidence require review.

Imports initially remain pending. Review and verify them before calculating. Changed source records create a superseding revision only with explicit correction permission and an audit reason. Verified history remains in the database. Gross/net countback follows the configured stroke-index order; unresolved detail stops publication. Division points are separate; weekly net/gross/CTP prizes are shared across the whole eligible field, following configurable priority and one prize per player.

## Membership, cancellation and eligibility

`join` extends the existing verified Auth identity; it does not create another login or reset a password. Trusted trial SGT details are copied into the CGL extension without changing trial metadata. SGT requests entered by members remain pending until verified. SGT handicaps are not self-editable.

Member cancellation first obtains a fresh server quote, then requires `acknowledged: true`, `acceptedEffectiveAt` and `acceptedFutureAmountCents` matching the fresh quote. It records the request, effective date when approved, future scheduled payments and the policy version/quote. Unapproved policy stays a review request and cannot enforce the proposed season-boundary commitment. Provider cancellation is a separate reconciliation status; a recorded request is not a claim that Square was changed.

Full memberships are checked on the server at the recorded eligible play time. A failed **initial** charge never provides play access. An existing paid member receives grace for the failure's actual calendar competition week and earlier released eligible weeks; later weeks are blocked until confirmed payment. This is based on the season calendar, not the publishing window, so releasing several rounds together does not bypass the next-week lock. A later failure does not invalidate an earlier paid result. Casual access needs a current manually renewed registration plus confirmed season entry. Suspensions and missing verified handicaps block championship classification. Qualification can proceed without inventing a handicap.

CGL can enforce acceptance of results and member UI access. Without a supported SGT membership/provisioning API it cannot remotely prevent somebody opening an external SGT competition; this requires CGS/SGT operating controls.

## Environment and staging setup

Existing server configuration: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Use a dedicated staging project; never expose the service key to the browser.

Shared administrator configuration: `CGS_ADMIN_USERNAME` (non-default), `CGS_ADMIN_PASSWORD` (at least 16 characters), `CGS_ADMIN_SECRET` (at least 32 random characters). Prefer a verified Auth role for attributable individual administration. Never copy `admin` credentials into a deployment checklist.

Schedulers: `CGL_JOB_SECRET` protects the existing maintenance job. `CGL_SGT_SYNC_SECRET` is an independent random value used only by Supabase Cron to POST `/api/cgl/sgt/sync`; the same value is stored in Vercel and Supabase Vault. `CGL_SGT_CLUB_SLUG` defaults to `CGSBunker`. Notifications stay previews until an approved transactional email provider is integrated. No emails are represented as sent.

For Square environment variables, Sandbox merchant/location/plan setup and remaining provider limitations, see the Square integration guide. No real charges, live subscriptions, hosting changes or account invitations were made by this build.

1. Approve isolated staging database setup and apply the two migrations in order.
2. Configure staging secrets and a verified administrator role/strong shared login.
3. Open CGL Admin, inspect seeded prices/settings and approve the versioned reference points table when satisfied.
4. Confirm season dates and cancellation/legal policies. Leave unapproved switches off.
5. Create a 13-week season, generate fixtures, add real courses/SGT IDs, set play windows, and publish the desired block.
6. Use isolated Sandbox players for the complete checkout → confirmed webhook → membership → import → verify → publish → credits → redeem → fulfil flow.
7. Check member ownership, public redactions, results/support permissions, audit history and CSV exports.
8. Confirm legacy CGS/Top Dog/Par 3/trial access and account counts remain unchanged.

## Rollback and recovery

Preferred recovery is to roll back the application release or disable CGL routing at the hosting layer while retaining its data, then forward-fix the additive schema. Existing CGS features do not depend on the new tables. Keep database backups and financial exports; verify restore on staging.

`supabase/rollback/cgl_2027_empty_only.sql` is an optional **manual staging cleanup only**. It refuses to run if any CGL member, payment, ledger, order or audit data exists. It is outside the migrations directory and is never automatically applied. Do not remove CGL history from a live system as a rollback. When real financial activity exists, reconcile provider transactions and use approved compensating adjustments.

## Verification and limits

`npm run test:cgl` executes isolated pure-rules, server-contract, credit/database and Square tests using pinned PGlite; it never connects to hosted Supabase. Database tests execute both SQL migrations in a fresh in-memory PostgreSQL instance. They cover transaction rollback, replay safety, FEFO expiry, immutable history, account ownership/RBAC, public redaction, import revisions, publication snapshots, membership rules, gifts and payment reconciliation. Run `npx tsc --noEmit`, targeted ESLint and `npm run build` as part of staging validation.

These local tests do not prove an external Square/SGT/email credential works. The hosted SGT connection must be completed once by a club administrator and its first sync visually checked before being treated as live. Square end-to-end checkout, provider-safe exact season-boundary cancellation, upgrade/prorated provider settlement, cash-plus-credit settlement, payment-fee credit redemption, transactional email delivery and legal approval remain separate launch gates. Pure quote/rule calculations and fail-closed interfaces exist for blocked mechanisms; they do not claim successful provider execution.
