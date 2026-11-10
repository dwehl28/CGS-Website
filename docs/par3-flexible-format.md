# Flexible Par 3 tournament organiser

Live on 5 November 2026 at https://crossodoggolf.com/clubhouse-admin/par3#entrants. The format calculator is at https://crossodoggolf.com/clubhouse-admin/par3/format-preview. The existing admin sign-in is required. Save the format, allocate entrants manually or with the seeded/random draw, then generate fixtures. The current event remains five pools of four, capacity twenty, with fifteen active entrants; no new pool assignments or fixtures were generated during release.

The organiser supports 1–16 pools, independently nominated capacities of 2–8 players, and a maximum field of 64. The finals size is 2, 4, 8, 16, 32 or 64 and must fit the nominated field. Existing five-pool and six-pool formats retain their original finals templates.

An organiser can nominate the format, allocate players manually or automatically, and calculate fixtures from the actual active players assigned to each pool. A pool does not have to be filled to its nominated capacity, but every pool needs at least two active players and every active entrant must be assigned before calculating a draw. Odd-sized pools receive rotating byes; each distinct pair plays once. Four-player pools retain the existing fixture order.

Automatic allocation uses the display order as seeding and alternates direction through the pools. Random allocation securely shuffles the entrants before the same allocation process. Both fill each nominated capacity without duplicating players. Automatic reallocation clears scheduled fixtures and manual/CTP seeds, so regenerate the draw afterwards.

Changing capacity or finals size preserves valid fixtures, fixture identifiers and queued bay assignments. Recalculating an unchanged draw preserves running matches and recorded results. A changed pool with a live match or result cannot be reshuffled; format changes and automatic allocation are also blocked once a match starts. After finals are generated, allocations, manual pool ranks, display order and CTP qualifiers are locked, and generating finals again cannot overwrite the bracket.

Pool completion uses the actual round-robin total `n × (n − 1) ÷ 2`. Alternatively, the organiser can manually seed a whole pool using each rank from 1 to its actual player count exactly once. A partial or duplicate manual ranking must be completed or cleared before CTP confirmation or finals generation.

Finals qualification is calculated from the actual pools. Equal automatic places per pool are followed by the required number of CTP qualifiers. Where the next single finishing position cannot supply enough contestants, all remaining non-automatic players enter the CTP playoff. No CTP is required when automatic places already fill the finals. Players with identical display names remain separate bracket participants through their player identifiers.

## Pool winners CTP for an opening-round bye

The organiser's **Finals qualification and CTP** setting also offers **Pool winners CTP for a bye — all entrants advance**. This is for a field exactly one player short of the selected bracket size: for example, fifteen entrants in a sixteen-slot bracket. Each pool must have at least two entrants and every active player must be assigned. All pool winners contest CTP; its confirmed winner skips the opening round. Every other entrant remains in the finals draw, with same-pool opening pairings avoided where possible.

For Championship II's fifteen entrants in five pools, this means five pool winners in CTP, one direct quarter-finalist and seven opening matches involving the other fourteen players. The resulting eight quarter-finalists continue through the normal bracket. No player is eliminated through the CTP playoff. The bye is a genuine empty bracket slot, with automatic progression and no invented player, played match, score or manually awarded win.

Save the format before confirming CTP. Complete every pool (or confirm full, unique manual pool rankings), confirm the CTP bye winner, then generate the finals once. The organiser, public display, stream graphics and print sheets describe the bye consistently. Bye advancement cannot be marked live, reported as a match result or undone as if it were a played match.

The CTP format can be changed before finals exist while retaining the same pool capacities and bracket size, even after pool play starts. Clear any confirmed CTP selection before changing it. Structural changes remain locked after play starts; generated finals lock both settings. Merely changing the CTP format preserves players, scheduled fixtures and simulator queues.

The additive migration is `supabase/migrations/20261105094940_par3_pool_winners_ctp_bye.sql`, name `par3_pool_winners_ctp_bye`, SHA-256 `831d105d657338fdbaeb5c0c71e06c1aba8d0466d50fb9bc0f0c4aaf584bf98a`. It was applied to the existing CGS project after 82 passing Par 3 tests, TypeScript, repository ESLint and a successful production build. Its filename matches the version assigned by the hosted migration service. The 27 isolated database tests passed again after filename alignment. Service-only invoker permissions were verified for the updated functions and the new pool-winner helper; security advisors reported no new function finding.

Before/after migration checks confirmed both events' existing fields were unchanged, all 40 player records were preserved (checksum `7187bf43690d4c3bf14df2ecb579776d`), and all 45 pool fixtures were preserved (checksum `3240154aa8211fbc690d2c542623259b`). This includes Championship II's fifteen scheduled fixtures created by the organiser after the earlier flexible-format release. Merely installing the migration leaves both events on their existing standard format; selecting the new format is a separate action for Championship II only.

The prepared source release contains 264 runtime files, with 12 changed from the previous flexible-format deployment. Its sanitized manifest is `.vercel/par3-ctp-bye-release-manifest.json`, SHA-256 `dbf5db047816d3ad8dadb15a284823a3972a5a23debb37ec209bd39a21f3cb70`. Private files, environment settings, database migrations, tests and generated builds are excluded from that source package.

Published as Vercel production deployment `dpl_HHsRznejnPCfbCJuwFcXnnUJx7dC`, `READY`, in Singapore `sin1`, with all three existing aliases assigned successfully. URL: https://cgs-website-m1hskb9aq-dwehl28s-projects.vercel.app. The preceding flexible-format deployment remains available for rollback. Public API, homepage, bracket stream, CGL and account setup checks returned 200; the public Par 3 response uses the database and omits private contact/consent fields.

During live verification, the organiser added a sixteenth active entrant and removed the old Pool E assignments. The user then explicitly requested a regular four-pool, four-player format instead. The live organiser was verified with four capacities of four, sixteen finals slots and **Standard** qualification already saved by the organiser; no additional format save or pool reshuffle was needed. The CTP bye option remains permanently selectable for a future field exactly one player short of its finals bracket. This release did not select a CTP winner, create results or generate a finals bracket.

## Pool-count refresh follow-up

The organiser later returned to fifteen active entrants and requested a switch from four pools back to five. Live inspection showed the database still held four pools, with no started match, finals or CTP lock blocking a save. An authenticated five-pool save succeeded and updated the player menus, pool tables and finals preview. The five-pool/CTP-bye format was restored for the fifteen-player field, preserving the existing assignments and twelve scheduled fixtures; no player allocation or fixture regeneration was performed.

The controls now remount their editor when the saved event format changes, preventing old local state from hiding a refreshed pool count, capacity or finals setting. Failed saves and unrelated roster refreshes preserve the draft. A prominent saved/unsaved status distinguishes the preview from the live format and places a **Save and update tournament** button near the format controls. Saving remains explicit because changing a preview must not silently overwrite a tournament.

All 88 Par 3 checks pass, including four-to-five expansion with unassigned players and scheduled fixtures in both finals modes, four-to-five-to-four input changes, refreshed saved props, failed-save draft preservation and the existing bracket/database scenarios. TypeScript, scoped ESLint and the production build pass. No database migration was needed for this fix.

The source release contains 264 runtime files with only `components/admin/Par3FormatControl.tsx` changed from the preceding release. Manifest `.vercel/par3-format-refresh-release-manifest.json`, SHA-256 `2276887ceb86bc496de9fe0120751497f8728132009c4f185b292cdb11beeb31`; private files, tests and generated builds are excluded. Production deployment: `dpl_HDXfJhBqzZ1wJJDyYSieCzJx2e4Y`, URL https://cgs-website-byx0or67o-dwehl28s-projects.vercel.app, existing CGS project, Singapore `sin1`.

The deployment reached `READY` with all three existing aliases assigned successfully. Authenticated live browser checks confirmed **Saved format: 5 pools**, the CTP-bye setting, and five pool tables. A four-pool draft showed the explicit unsaved warning and nearby save button; returning the draft to five restored the saved status and Pool E without any additional database write. The public API returned 200 with five pools, the CTP-bye mode, fifteen active entrants and twelve preserved fixtures, without private contact fields. The new deployment's error/fatal runtime scan found no matching logs. Live proof is saved as `par3-five-pool-refresh-live.png` in the task's visualization folder, outside the release package. Four active entrants still require pool assignments before fixtures can be synced.

## Places-per-pool saving correction

The global **Places per pool** selector previously changed only the default for new pools. Existing pool capacities remained unchanged unless a separate **Apply to all** button was pressed, so saving could appear to revert a selection of three back to four. The selector now immediately updates every pool's capacity and the submitted values. The extra apply button was removed. Individual pool controls remain available; the global selector displays **Mixed sizes** when individual capacities differ, and choosing a global size again resets all pools to that size.

All 95 Par 3 checks pass, including direct global selection of three, the saved refresh retaining three, mixed individual overrides, new-pool inheritance, explicit standard-versus-CTP-bye validation, database capacity preservation and rejection of unsafe changes after results. Scoped ESLint and the production build, including TypeScript, pass. No migration or backend change was required.

The release contains 264 runtime files with only `components/admin/Par3FormatControl.tsx` changed. Manifest `.vercel/par3-pool-size-release-manifest.json`, SHA-256 `2e33b0a6a6da5d7d99fc06ee555db8960b3b695272943bcd72deeba2940023df`. Production deployment `dpl_9gz4C3D8gEzmeTbYBDzDgKrhtGzD`, URL https://cgs-website-mfu0n63rm-dwehl28s-projects.vercel.app, Singapore `sin1`. The previous deployment remains available for rollback.

Deployment reached `READY` with all existing aliases assigned. The live global selector was changed from four to three and immediately updated every individual pool. The first save exposed a separate pre-existing incompatibility: Luke B (player 28) still held manual pool rank 4, while unallocated Blake Ellison (33) and Greg M (39) also retained rank 4. Those three obsolete manual rank overrides were cleared after verifying that no pool match, CTP confirmation or finals had started. Their original value was 4; no player was removed or moved. Other manual seeds were retained.

The subsequent authenticated save succeeded. A full live-page reload retained all five capacities at three. Database verification confirmed `pool_sizes=[3,3,3,3,3]`, `pool_size=3`, capacity 15 and the retained CTP-bye finals mode. All 41 player records and assignments were retained; only the three obsolete manual seed values and their update timestamps changed. All 42 stored pool matches, including the current competition's twelve scheduled fixtures, retained checksum `55c6e5a8087345957ca16a0838daa9dc`. The archived event retained checksum `ca68da8df1dea22618188209ba885392`. No fixture regeneration, allocation, result entry or finals generation was performed. Reload proof is saved as `par3-five-pools-three-players-live.png` outside the release package.

## Database setup and release status

The migration is `supabase/migrations/20261105083434_flexible_par3_tournament_format.sql`. It was tested in an isolated PGlite database and applied to the hosted project on 5 November 2026 with explicit user approval. Its local filename matches the version recorded by Supabase's migration service. Before/after checksums confirm both existing events, all 40 player records and all 30 existing pool matches were preserved exactly (excluding the two additive event columns).

The migration adds optional `pool_sizes` and `finals_size` fields, extends pool/rank constraints, and installs server-only transactional functions for format updates, pool allocation, fixture reconciliation, CTP selection and initial finals creation. Existing rows, results and public read policies are preserved. The new functions run as the caller and deny execution to public and ordinary signed-in users. Existing admin-session checks remain required on every server action.

The private calculator at `/clubhouse-admin/par3/format-preview` uses the same format controls and calculation rules without loading or saving tournament records. It is available after the normal admin sign-in, even if the tournament connection is unavailable. The normal organiser links to it for planning alternative formats.

Player and match triggers enforce capacities, protect running/results fixtures and coordinate changes using the event row. CTP confirmation and finals creation also verify the event's update timestamp so a result arriving during calculation cannot create a bracket from stale information. A competing administration request can be rejected; refresh the organiser and retry after the other request completes.

Before the migration is applied, existing public data remains readable with its legacy format defaults. New operations that require the migration return a setup message and do not attempt a partial fallback update.

Validation: `npm run test:par3` passes 48 format, server-action, backend, real isolated database and display-render scenarios. TypeScript, repository ESLint and the production build pass. Browser checks confirmed unequal pools of 3/5/7 calculate 15 places and 34 pool matches with eight finalists, and reject a sixteen-player finals draw exceeding that capacity. Keyboard-accessible controls and readable review/error notices were checked. The preview screenshot is saved outside the release package.

Release preparation contains 264 runtime files, with 15 source files changed since the approved CGL review deployment. The sanitized local manifest is `.vercel/par3-flexible-release-manifest.json`; its SHA-256 is `b4aedf1c00681faa0db9685d57534ed92fa17405024d6ed103a25f9246fcb7c8`. Environment files, local provisioning scripts, private documents, tests, SQL files and generated builds are excluded from the Vercel source package. The migration is a separate, explicit release step.

On 5 November 2026, the user explicitly approved the production settings/count read, additive migration and website publishing after local verification. The live database was already timing out: even `SELECT 1` failed, existing public tournament data returned its fallback, and internal monitoring queries timed out. Release work waited until recovery, after which the migration and website were successfully published.

The user separately approved GitHub sign-in and a database restart, completed the browser sign-in, and then explicitly approved a full restart of the existing CGS Website Supabase project. The database-only reboot did not restore connections; the full project restart restored successful SQL connections. No region, compute tier, billing, stored records or tournament settings were changed by these recovery actions. Recovery and preservation checks succeeded before applying the migration and publishing.

## Published release

- Vercel deployment `dpl_GFLarfuiTqXUr1SzqMN1SBjueVoX`, production, `READY`, Singapore `sin1`, all three existing aliases assigned without errors.
- Deployment URL: https://cgs-website-3fgouned8-dwehl28s-projects.vercel.app.
- Previous production deployment retained: `dpl_F1L29spkbcerybgHqBu7Q1ULo1Th`.
- Hosted migration history version: `20261105083434`, name `flexible_par3_tournament_format`; SQL SHA-256 `fb763d4e0e5bd282cb2a9f0f55bc0eb9dc1e4cdbb3eecad7e157233c5bce2581`.
- Before/after existing-record checksums: events `9b237e7060a99fc420246b5e8fbf4dc0`, players `7187bf43690d4c3bf14df2ecb579776d`, matches `9b6539aa8cf64a81f6bdb68c577123b7`.
- Five new mutating RPCs verified as invoker functions, executable by `service_role`, with execution denied to `anon` and `authenticated`. Security advisors reported existing informational private-table RLS findings and an existing Auth password-protection warning; no new function finding was reported.
- Live unauthenticated checks: homepage, Par 3 public API, both protected organiser routes, CGL home/trial, scoreboard and account setup returned 200. The Par 3 API returned `source: database`, fifteen players, no fixtures, correct retained format and no private phone/consent fields.
- Authenticated live browser verification confirmed the new format controls, five retained pools of four places, three assigned players in every pool, and working seeded/random allocation controls. No format save, player reallocation, fixture generation or finals mutation was performed during this check. The live organiser screenshot is `par3-flexible-organiser-live.png` in the task's visualization folder, outside the release package.
- The production source package excludes the migration and tests; renaming the local migration to the server-assigned history version did not alter the compiled website source. The isolated database tests passed again after that filename alignment.

Shared administrator authentication remains the existing CGS mechanism. Production operators should configure strong `CGS_ADMIN_USERNAME` and `CGS_ADMIN_PASSWORD` values; this release does not change credentials or user sessions.

## Fifteen-player presentation and confirmed course schedule

The public homepage now explains the saved five-pool, three-player format: every player plays two pool matches across three rounds, with a rotating rest; all fifteen advance; the five pool winners contest CTP for one quarter-final bye; the other fourteen play seven opening matches. The first finals stage is labelled **Opening round** in this mode, while standard sixteen-player draws retain their original label. The supplied poster calls that same Royal Adelaide stage **Wildcard Round**; its artwork is preserved unchanged.

The shared course configuration now includes explicit hole selections and the poster's stage numbers:

| Stage | Course | Holes |
| --- | --- | --- |
| R1 | Gailes Golf Course | 3, 6, 12 |
| R2 | Royal Canberra Golf Club | 8, 13, 17 |
| R3 | Royal Hobart Golf Club | 8, 11, 15 |
| R4 / pool winners CTP | Augusta National Golf Club | 12 |
| R5 / opening round | Royal Adelaide Golf Club | 7, 12, 16 |
| R6 / quarter-finals | New South Wales Golf Club | 2, 6, 17 |
| R7 / semi-finals | The Australian Golf Club | 2, 4, 11 |
| R8 / grand final | The National Golf Club (Old Course) | 4, 7, 13 |

Course and hole labels appear in public match/draw views, simulator calls, the organiser, course schedule, print packs and stream graphics. The old hero poster containing a baked-in 24-player count was replaced with the supplied course poster. Its SHA-256 is `c700e410dedd0c556e0ca1064175d02f18083bb1fdcc912bc3119300f4c68b4f`, identical to the user's attachment. The versioned poster URL has an explicit Next image local-pattern allowance, verified through the real image optimiser.

The header and sharing image now use neutral venue/event wording. Exact previously generated registration messages derive their displayed capacity from the saved format and active entrants; custom text and non-registration statuses are preserved. The no-connection fallback describes the current fifteen-player format without inventing players, fixtures or results. Player seed choices now respect the selected pool's capacity. These are display changes; no database migration, record edit, allocation, fixture sync, result or finals generation was performed for this release.

Validation: all **105 Par 3 checks pass**, including all eight course/hole mappings, generic bracket sizes, legacy draw labels, fallback behavior, registration-copy normalization, and public/stream/print rendering. Scoped ESLint and the production build with TypeScript pass. Local visual checks covered the hero, format progression, eight-course schedule and stream photo crops.

Production deployment `dpl_2Hp9QPMd3svV6j7WrYQLthDYqZac`, URL https://cgs-website-j0massu0e-dwehl28s-projects.vercel.app, reached **READY** in Singapore `sin1`; all three existing aliases were assigned without errors. The previous pool-size correction deployment remains available for rollback. The source package contains 264 runtime files, with 13 changed from that preceding release; manifest `.vercel/par3-course-schedule-release-manifest.json`, SHA-256 `491c8355afa6083c88464660da06b0fc7f62ad9ec7a10cabef0a9a842af93863`. Private files, environment values, operational scripts, tests, SQL and generated builds are excluded.

Live checks passed for the homepage, public API, course stream, original poster and optimised poster. Every course and hole selection is present; the downloaded poster matches the attachment's checksum. The database response reports five capacities of three, fifteen active entrants, fifteen fixtures and **Sold out**, without private contact/consent fields. During this presentation work the organiser completed the previously unfinished pool assignments and fixtures; these were not changed by the release. An authenticated page reload confirmed all five saved pools, the new eight-stage course disclosure, **Opening round** print link and **Augusta National Golf Club / Hole 12** CTP label. Screenshot proof is saved as `par3-fifteen-player-format-published.png` and `par3-course-schedule-published.png` in the task's visualization folder, outside the release package.
