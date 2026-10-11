# CGS Top Dog League Night Control

## Architecture

The control centre extends the existing Next.js admin, Supabase project, custom CGS admin session, and Vercel deployment. It does not introduce a second application or database.

- Admin route: `/clubhouse-admin/top-dog/live`
- Core service: `lib/top-dog.ts`
- Production service: `lib/top-dog-production.ts`
- Admin APIs: `/api/admin/top-dog/*`
- Public read-only feed: `/api/top-dog/[season]`
- OBS routes: `/stream/top-dog/[season]/*`
- Database migrations: `supabase/migrations/20261011015217_add_top_dog_league_control.sql` and `20261011021407_add_top_dog_production_modules.sql`

The browser never receives the Supabase service-role key. Admin writes pass through same-origin, authenticated route handlers. Public overlays can read only published season, team, fixture, ladder, and sanitized stream-state data. Sponsor notes, interview prompts, checklists, content logs, and operations logs remain admin-only.

## OBS Sources

Use a 1920 x 1080 browser source with a transparent background.

- `scorebug`: persistent compact match score
- `ticker`: persistent rotating lower ticker
- `match`: universal central graphic source
- `ladder`: official and projected ladder source
- `prize`, `jackpot`, `sponsor`, `subscribe`, `interview`, `result`, `wrap-up`, `doghouse`, `shot-of-night`, `butters-board`, `up-next`, `match-of-night`, `stat-of-week`: optional dedicated central sources

The stream state permits one major central graphic at a time. The scorebug and ticker can remain visible independently. Realtime Postgres changes trigger immediate refreshes, with timed HTTP refreshes as a recovery fallback.

## Reliability

- Every fixture command writes a pre-change history record and supports Undo.
- Production actions write to `top_dog_operations_log`.
- Destructive jackpot reset requires confirmation.
- Content markers export to CSV.
- A league-night JSON backup is available from the Production Desk.
- Missing display values fall back safely instead of crashing an overlay.
- Existing historical scoreboards remain linked and untouched.

## Future SGT / GSPro Integration

SGT is optional. Manual operation remains the authoritative fallback.

The integration boundary is `top_dog_seasons.integration_config`. A future adapter should be added under `lib/integrations/sgt/` and call the existing Top Dog services rather than writing directly from a page component. The adapter should map external identifiers onto existing records:

1. Resolve an SGT player to `cgs_profiles`.
2. Resolve an SGT team to `cgs_teams` and `top_dog_season_teams`.
3. Resolve an SGT round to `top_dog_rounds`.
4. Resolve a head-to-head result to `top_dog_fixtures` through a validated import command.
5. Preserve the external source ID and last imported revision in `integration_config` or a future additive mapping table.

Imports should be idempotent, preview changes before applying them, retain the manual audit trail, and never make a live overlay depend directly on SGT availability.
