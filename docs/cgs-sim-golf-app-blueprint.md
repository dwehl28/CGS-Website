# CGS Sim Golf App Blueprint

## Project Placement

Build the first version inside the existing `D:\cgs-website` Next.js project.

Reasons:
- The site already has Supabase, admin pages, public scoreboards, stat tracking, and OBS-ready browser source routes.
- Player profiles, public pages, stream assets, and competition data need the same database.
- A phone-installable PWA can be shipped from the same codebase before committing to App Store or Play Store native apps.
- A separate native app can later consume the same Supabase schema and API routes if CGS needs app store distribution.

## Product Shape

The product should become a CGS competition companion app:

- Player login and profile
- Admin-created competitions
- Admin-assigned players and teams
- Mobile score entry during GSPro sim rounds
- Configurable scoring formats
- Live leaderboard and stat snapshots
- Public player profile pages
- OBS browser source overlays that update live

## Recommended Route Map

Player-facing:
- `/play` - player home and current competition entry point
- `/play/competitions` - competitions assigned to the logged-in player
- `/play/rounds/[roundId]` - mobile score entry for a live round
- `/players/[handle]` - public player profile

Admin:
- `/clubhouse-admin/competitions` - create competitions, choose scoring, assign players and teams
- `/clubhouse-admin/members` - manage player accounts and profile details
- `/clubhouse-admin/stream` - choose active overlays and featured players

Public and stream:
- `/competitions/[slug]` - public competition page
- `/stream/competition/[slug]/leaderboard` - OBS leaderboard source
- `/stream/competition/[slug]/player/[handle]` - OBS player intro/profile card
- `/stream/competition/[slug]/match` - OBS match status source

Existing routes like `/scoreboard/[slug]/stream` can either be kept as legacy routes or redirected once the new system replaces the older scoreboard model.

## Core Database Model

Use Supabase Auth for login accounts and Supabase Postgres for competition state.

Suggested tables:

- `profiles`
  - `id uuid primary key references auth.users`
  - `handle`
  - `display_name`
  - `avatar_url`
  - `handicap_index`
  - `home_location`
  - `bio`
  - `is_public`
  - `role`

- `competitions`
  - `id`
  - `slug`
  - `title`
  - `season_label`
  - `simulator`
  - `course_name`
  - `status`
  - `scoring_format`
  - `team_mode`
  - `handicap_mode`
  - `is_live`
  - `is_published`
  - `starts_at`

- `competition_teams`
  - `id`
  - `competition_id`
  - `name`
  - `short_name`
  - `accent_color`

- `competition_players`
  - `id`
  - `competition_id`
  - `profile_id`
  - `team_id`
  - `playing_handicap`
  - `tee_group`
  - `status`

- `courses`
  - `id`
  - `simulator`
  - `name`
  - `tee_name`
  - `hole_count`
  - `holes jsonb`

- `rounds`
  - `id`
  - `competition_id`
  - `profile_id`
  - `team_id`
  - `course_id`
  - `status`
  - `current_hole`
  - `gross_total`
  - `net_total`
  - `stableford_points`
  - `match_status`

- `hole_scores`
  - `id`
  - `round_id`
  - `hole_number`
  - `par`
  - `gross_strokes`
  - `score_to_par`
  - `putts`
  - `fairway_hit`
  - `green_in_regulation`
  - `penalties`
  - `notes`

- `stream_widgets`
  - `id`
  - `competition_id`
  - `widget_type`
  - `title`
  - `config jsonb`
  - `is_active`

## Scoring Formats

The admin should choose from controlled scoring modes first, not free-form scoring formulas.

Initial modes:
- Stroke play, gross
- Stroke play, net
- Stableford
- Team aggregate
- Best ball
- Ambrose / scramble
- Match play
- Skins, later

Each mode should produce a normalized competition snapshot so public pages and OBS overlays do not need custom logic for every format.

## GSPro Integration

The first version should be manual entry.

GSPro has an official Open Connect interface, but the public documentation describes a local socket flow for launch monitor shot data going into GSPro and simple responses from GSPro back to a connected client. It does not appear to provide a ready-made public scorecard export that this app can depend on for the MVP.

Future path:
- Keep the manual score model as the source of truth.
- Later investigate whether a local Windows bridge can read useful GSPro session data.
- If a bridge is viable, send data from the simulator PC into the CGS app through a secured API route.

## MVP Build Order

1. Add player accounts and profiles.
2. Add admin competition builder.
3. Add admin player and team assignment.
4. Add mobile round entry for assigned players.
5. Add scoring snapshot logic for gross, net, stableford, team, and Ambrose modes.
6. Add public player profile pages.
7. Add OBS leaderboard and player overlay routes.
8. Add PWA install support.

## Current Build Decisions

- Day-one scoring format: team Ambrose.
- Team entry rule: either allocated team member can enter the shared team score and contribution data for both players. Existing CGS admins can also enter or correct any team score.
- Signup rule: anyone can create an account. Admin allocation controls whether they can enter a live team round.
- Public profile fields: photo, handicap, current team, nickname, and calculated season stats.
- Simulator capacity: up to three GSPro bays active at once.
- Primary stream overlay: a full-screen transparent-background player intro graphic, opened by player-specific URL, centered on the stream while the player is introduced. It should show nickname, handicap, team/bay, live Ambrose shot contributions, average drive, go-to irons, best result, biggest weakness, and uploaded player photo. The overlay animates in and automatically hides after 10 seconds.

## App Store Submission Decisions

- Business name: Crossodog Golf.
- App name: CGS Golf.
- Subtitle: Golf Scoring and Data track.
- Pricing: free.
- Availability: Australia only.
- Beta path: TestFlight before public App Store release.
- Review access: provide an Apple review demo login.
- Privacy: publish and submit the CGS privacy URL.
- Account deletion: available inside the signed-in player app.
- Developer account note: if Crossodog Golf should display as the App Store seller name, Apple requires organization enrollment for the legal entity. Individual enrollment displays the account holder's legal name as seller.

## Remaining Decisions

- Should players be able to edit previous holes for the whole event, or only the current/next hole?
- Should late score edits be visibly flagged on the stream overlay?
- Should reserve/substitute players be added as a separate role outside the two active scoring players?
- Which exact profile stat fields should admins maintain for broadcast intros beyond calculated Ambrose contribution counts?
