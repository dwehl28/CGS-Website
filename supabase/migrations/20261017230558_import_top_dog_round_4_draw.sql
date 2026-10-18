update public.top_dog_rounds rounds
set
  is_current = false,
  updated_at = timezone('utc', now())
from public.top_dog_seasons seasons
where rounds.season_id = seasons.id
  and seasons.slug = 'top-dog-season-4';

insert into public.top_dog_rounds (
  season_id,
  round_number,
  name,
  scheduled_at,
  venue,
  course_name,
  status,
  is_current,
  score_direction,
  differential_divisor,
  updated_at
)
select
  seasons.id,
  4,
  'Round 4 - 12 Hole Scramble',
  timestamptz '2026-10-19 19:00:00+10',
  'The Tee Lounge',
  'Jaspar Park Lodge, Canada',
  'waiting',
  true,
  'lower_wins',
  1,
  timezone('utc', now())
from public.top_dog_seasons seasons
where seasons.slug = 'top-dog-season-4'
on conflict (season_id, round_number) do update
set
  name = excluded.name,
  scheduled_at = excluded.scheduled_at,
  venue = excluded.venue,
  course_name = excluded.course_name,
  status = excluded.status,
  is_current = excluded.is_current,
  score_direction = excluded.score_direction,
  differential_divisor = excluded.differential_divisor,
  updated_at = timezone('utc', now());

create temporary table top_dog_round_4_fixture_import (
  display_order integer not null,
  home_slug text not null,
  away_slug text not null,
  scheduled_at timestamptz,
  simulator_bay text not null,
  is_match_of_night boolean not null
) on commit drop;

insert into top_dog_round_4_fixture_import values
  (1, 'founders', 'juniors', timestamptz '2026-10-19 19:00:00+10', 'YouTube', true),
  (2, 'scenes', 'nice-pair', timestamptz '2026-10-19 19:00:00+10', 'Bay 2', false),
  (3, 'home-in-a-bunker', 'off-the-ladies', timestamptz '2026-10-19 19:00:00+10', 'Bay 1', false),
  (4, 'team-tommy', '2-putt-shakars', null, 'Free play', false),
  (5, 'bogey-brothers', 'fore-skins', null, 'Free play', false),
  (6, 'zig-zag', 'kingpins', null, 'Free play', false);

insert into public.top_dog_fixtures (
  round_id,
  home_team_id,
  away_team_id,
  display_order,
  scheduled_at,
  simulator_bay,
  status,
  home_score,
  away_score,
  home_score_confirmed,
  away_score_confirmed,
  current_hole,
  holes_total,
  result_note,
  is_match_of_night,
  started_at,
  finished_at,
  updated_at
)
select
  rounds.id,
  home_teams.id,
  away_teams.id,
  fixture_data.display_order,
  fixture_data.scheduled_at,
  fixture_data.simulator_bay,
  'waiting',
  0,
  0,
  false,
  false,
  0,
  12,
  'Loaded from the supplied official Round 4 draw.',
  fixture_data.is_match_of_night,
  null,
  null,
  timezone('utc', now())
from top_dog_round_4_fixture_import fixture_data
join public.top_dog_seasons seasons on seasons.slug = 'top-dog-season-4'
join public.top_dog_rounds rounds
  on rounds.season_id = seasons.id
  and rounds.round_number = 4
join public.cgs_teams home_teams on home_teams.slug = fixture_data.home_slug
join public.cgs_teams away_teams on away_teams.slug = fixture_data.away_slug
where not exists (
  select 1
  from public.top_dog_fixtures existing
  where existing.round_id = rounds.id
    and existing.display_order = fixture_data.display_order
);

update public.top_dog_fixtures fixtures
set
  home_team_id = home_teams.id,
  away_team_id = away_teams.id,
  scheduled_at = fixture_data.scheduled_at,
  simulator_bay = fixture_data.simulator_bay,
  status = 'waiting',
  home_score = 0,
  away_score = 0,
  home_score_confirmed = false,
  away_score_confirmed = false,
  current_hole = 0,
  holes_total = 12,
  result_note = 'Loaded from the supplied official Round 4 draw.',
  is_match_of_night = fixture_data.is_match_of_night,
  started_at = null,
  finished_at = null,
  updated_at = timezone('utc', now())
from top_dog_round_4_fixture_import fixture_data
join public.top_dog_seasons seasons on seasons.slug = 'top-dog-season-4'
join public.top_dog_rounds rounds
  on rounds.season_id = seasons.id
  and rounds.round_number = 4
join public.cgs_teams home_teams on home_teams.slug = fixture_data.home_slug
join public.cgs_teams away_teams on away_teams.slug = fixture_data.away_slug
where fixtures.round_id = rounds.id
  and fixtures.display_order = fixture_data.display_order;

update public.top_dog_stream_state stream_state
set
  round_id = rounds.id,
  featured_fixture_id = fixtures.id,
  scorebug_fixture_id = fixtures.id,
  updated_at = timezone('utc', now())
from public.top_dog_seasons seasons
join public.top_dog_rounds rounds
  on rounds.season_id = seasons.id
  and rounds.round_number = 4
join public.top_dog_fixtures fixtures
  on fixtures.round_id = rounds.id
  and fixtures.display_order = 1
where stream_state.season_id = seasons.id
  and seasons.slug = 'top-dog-season-4';
