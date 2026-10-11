alter table public.top_dog_seasons
  add column if not exists score_direction text not null default 'higher_wins';

alter table public.top_dog_season_teams
  add column if not exists points_adjustment integer not null default 0,
  add column if not exists differential_adjustment integer not null default 0,
  add column if not exists adjustment_note text not null default '';

alter table public.top_dog_seasons
  alter column draw_points set default 2,
  alter column loss_points set default 1,
  alter column score_direction set default 'lower_wins';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'top_dog_seasons_score_direction_check'
      and conrelid = 'public.top_dog_seasons'::regclass
  ) then
    alter table public.top_dog_seasons
      add constraint top_dog_seasons_score_direction_check
      check (score_direction in ('higher_wins', 'lower_wins'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'top_dog_season_teams_adjustments_check'
      and conrelid = 'public.top_dog_season_teams'::regclass
  ) then
    alter table public.top_dog_season_teams
      add constraint top_dog_season_teams_adjustments_check
      check (
        points_adjustment between -99 and 99
        and differential_adjustment between -999 and 999
      );
  end if;
end;
$$;

update public.top_dog_seasons
set
  starts_on = date '2026-09-28',
  default_holes = 12,
  win_points = 3,
  draw_points = 2,
  loss_points = 1,
  score_direction = 'lower_wins',
  updated_at = timezone('utc', now())
where slug = 'top-dog-season-4';

insert into public.cgs_teams (
  slug,
  name,
  short_name,
  accent_color,
  is_active,
  updated_at
)
values
  ('bogey-brothers', 'Bogey Brothers', 'BOGEY', '#f7b82b', true, timezone('utc', now())),
  ('2-putt-shakars', '2-Putt Shakars', '2PUTT', '#24c8f2', true, timezone('utc', now())),
  ('zig-zag', 'Zig & Zag', 'ZIGZ', '#e8a83b', true, timezone('utc', now()))
on conflict (slug) do update
set
  name = excluded.name,
  short_name = excluded.short_name,
  is_active = true,
  updated_at = timezone('utc', now());

update public.cgs_teams
set name = 'Off The Ladies', updated_at = timezone('utc', now())
where slug = 'off-the-ladies';

with membership_data (
  team_slug,
  display_order,
  points_adjustment,
  differential_adjustment,
  adjustment_note
) as (
  values
    ('scenes', 1, 0, 0, ''),
    ('bogey-brothers', 2, 3, 0, 'Round 1 bye: 3 competition points'),
    ('off-the-ladies', 3, 0, 0, ''),
    ('founders', 4, 0, -1, 'Official Round 2 ladder margin reconciliation'),
    ('juniors', 5, 0, 0, ''),
    ('home-in-a-bunker', 6, 0, 0, ''),
    ('fore-skins', 7, 0, 1, 'Official Round 2 ladder margin reconciliation'),
    ('2-putt-shakars', 8, 3, 0, 'Round 1 bye: 3 competition points'),
    ('zig-zag', 9, 0, 0, ''),
    ('team-tommy', 10, 0, 0, ''),
    ('nice-pair', 11, 0, 0, ''),
    ('kingpins', 12, 0, 0, '')
)
insert into public.top_dog_season_teams (
  season_id,
  team_id,
  display_order,
  is_active,
  points_adjustment,
  differential_adjustment,
  adjustment_note,
  updated_at
)
select
  seasons.id,
  teams.id,
  membership_data.display_order,
  true,
  membership_data.points_adjustment,
  membership_data.differential_adjustment,
  membership_data.adjustment_note,
  timezone('utc', now())
from membership_data
join public.cgs_teams teams on teams.slug = membership_data.team_slug
join public.top_dog_seasons seasons on seasons.slug = 'top-dog-season-4'
on conflict (season_id, team_id) do update
set
  display_order = excluded.display_order,
  is_active = true,
  points_adjustment = excluded.points_adjustment,
  differential_adjustment = excluded.differential_adjustment,
  adjustment_note = excluded.adjustment_note,
  updated_at = timezone('utc', now());

update public.top_dog_rounds rounds
set is_current = false, updated_at = timezone('utc', now())
from public.top_dog_seasons seasons
where rounds.season_id = seasons.id
  and seasons.slug = 'top-dog-season-4';

with round_data (
  round_number,
  name,
  scheduled_at,
  course_name,
  status,
  is_current
) as (
  values
    (1, 'Round 1 - 12 Hole Scramble', timestamptz '2026-09-28 19:00:00+10', 'Payne''s Valley USA', 'final', false),
    (2, 'Round 2 - 12 Hole Scramble', timestamptz '2026-10-05 17:00:00+10', 'Legacy GC USA', 'final', false),
    (3, 'Round 3 - 12 Hole Team Stableford', timestamptz '2026-10-12 19:00:00+10', 'Ambassador GC, Canada', 'waiting', true)
)
insert into public.top_dog_rounds (
  season_id,
  round_number,
  name,
  scheduled_at,
  venue,
  course_name,
  status,
  is_current,
  updated_at
)
select
  seasons.id,
  round_data.round_number,
  round_data.name,
  round_data.scheduled_at,
  'The Tee Lounge',
  round_data.course_name,
  round_data.status,
  round_data.is_current,
  timezone('utc', now())
from round_data
join public.top_dog_seasons seasons on seasons.slug = 'top-dog-season-4'
on conflict (season_id, round_number) do update
set
  name = excluded.name,
  scheduled_at = excluded.scheduled_at,
  venue = excluded.venue,
  course_name = excluded.course_name,
  status = excluded.status,
  is_current = excluded.is_current,
  updated_at = timezone('utc', now());

create temporary table top_dog_fixture_import (
  round_number integer not null,
  display_order integer not null,
  home_slug text not null,
  away_slug text not null,
  scheduled_at timestamptz,
  simulator_bay text not null,
  status text not null,
  home_score integer not null,
  away_score integer not null,
  current_hole integer not null,
  result_note text not null,
  is_match_of_night boolean not null
) on commit drop;

insert into top_dog_fixture_import values
  (1, 1, 'founders', 'nice-pair', timestamptz '2026-09-28 19:00:00+10', 'YouTube', 'final', -4, -2, 12, 'Imported from the supplied official Round 1 results.', true),
  (1, 2, 'fore-skins', 'off-the-ladies', timestamptz '2026-09-28 18:00:00+10', 'Bay 2', 'final', -5, -6, 12, 'Imported from the supplied official Round 1 results.', false),
  (1, 3, 'kingpins', 'home-in-a-bunker', timestamptz '2026-09-28 18:00:00+10', 'Bay 1', 'final', 1, -7, 12, 'Imported from the supplied official Round 1 results.', false),
  (1, 4, 'team-tommy', 'zig-zag', null, 'Free play', 'final', -6, -7, 12, 'Zig & Zag score inferred from the official Round 2 ladder; the result graphic listed TBC.', false),
  (1, 5, 'scenes', 'juniors', null, 'Free play', 'final', -5, 2, 12, 'Imported from the supplied official Round 1 results.', false),
  (2, 1, 'home-in-a-bunker', 'scenes', timestamptz '2026-10-05 17:00:00+10', 'YouTube', 'final', -9, -11, 12, 'Imported from the supplied official Round 2 results.', true),
  (2, 2, 'juniors', 'kingpins', timestamptz '2026-10-05 17:00:00+10', 'Bay 2', 'final', -14, 1, 12, 'Imported from the supplied official Round 2 results.', false),
  (2, 3, 'bogey-brothers', 'zig-zag', timestamptz '2026-10-05 17:00:00+10', 'Bay 1', 'final', -16, -8, 12, 'Imported from the supplied official Round 2 results.', false),
  (2, 4, 'team-tommy', 'founders', timestamptz '2026-10-05 19:00:00+10', 'YouTube', 'final', -9, -9, 12, 'Imported from the supplied official Round 2 results.', false),
  (2, 5, 'nice-pair', 'fore-skins', timestamptz '2026-10-05 19:00:00+10', 'Bay 2', 'final', -5, -8, 12, 'Imported from the supplied official Round 2 results.', false),
  (2, 6, 'off-the-ladies', '2-putt-shakars', null, 'Free play', 'final', -11, -9, 12, 'Imported from the supplied official Round 2 results.', false),
  (3, 1, 'founders', 'off-the-ladies', timestamptz '2026-10-12 19:00:00+10', 'YouTube', 'waiting', 0, 0, 0, 'First fixture loaded from the supplied Round 3 draw.', true),
  (3, 2, 'home-in-a-bunker', 'nice-pair', timestamptz '2026-10-12 19:00:00+10', 'Bay 2', 'waiting', 0, 0, 0, 'Second fixture loaded from the supplied Round 3 draw.', false);

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
  fixture_data.status,
  fixture_data.home_score,
  fixture_data.away_score,
  fixture_data.current_hole,
  12,
  fixture_data.result_note,
  fixture_data.is_match_of_night,
  case when fixture_data.status = 'final' then fixture_data.scheduled_at end,
  case when fixture_data.status = 'final' and fixture_data.scheduled_at is not null
    then fixture_data.scheduled_at + interval '2 hours'
  end,
  timezone('utc', now())
from top_dog_fixture_import fixture_data
join public.top_dog_seasons seasons on seasons.slug = 'top-dog-season-4'
join public.top_dog_rounds rounds
  on rounds.season_id = seasons.id
  and rounds.round_number = fixture_data.round_number
join public.cgs_teams home_teams on home_teams.slug = fixture_data.home_slug
join public.cgs_teams away_teams on away_teams.slug = fixture_data.away_slug
on conflict do nothing;

update public.top_dog_fixtures fixtures
set
  home_team_id = home_teams.id,
  away_team_id = away_teams.id,
  display_order = fixture_data.display_order,
  scheduled_at = fixture_data.scheduled_at,
  simulator_bay = fixture_data.simulator_bay,
  status = fixture_data.status,
  home_score = fixture_data.home_score,
  away_score = fixture_data.away_score,
  current_hole = fixture_data.current_hole,
  holes_total = 12,
  result_note = fixture_data.result_note,
  is_match_of_night = fixture_data.is_match_of_night,
  started_at = case when fixture_data.status = 'final' then fixture_data.scheduled_at end,
  finished_at = case when fixture_data.status = 'final' and fixture_data.scheduled_at is not null
    then fixture_data.scheduled_at + interval '2 hours'
  end,
  updated_at = timezone('utc', now())
from top_dog_fixture_import fixture_data
join public.top_dog_seasons seasons on seasons.slug = 'top-dog-season-4'
join public.top_dog_rounds rounds
  on rounds.season_id = seasons.id
  and rounds.round_number = fixture_data.round_number
join public.cgs_teams home_teams on home_teams.slug = fixture_data.home_slug
join public.cgs_teams away_teams on away_teams.slug = fixture_data.away_slug
where fixtures.round_id = rounds.id
  and least(fixtures.home_team_id, fixtures.away_team_id) = least(home_teams.id, away_teams.id)
  and greatest(fixtures.home_team_id, fixtures.away_team_id) = greatest(home_teams.id, away_teams.id);

update public.top_dog_stream_state stream_state
set
  round_id = rounds.id,
  featured_fixture_id = fixtures.id,
  scorebug_fixture_id = fixtures.id,
  updated_at = timezone('utc', now())
from public.top_dog_seasons seasons
join public.top_dog_rounds rounds
  on rounds.season_id = seasons.id
  and rounds.round_number = 3
join public.top_dog_fixtures fixtures
  on fixtures.round_id = rounds.id
  and fixtures.display_order = 1
where stream_state.season_id = seasons.id
  and seasons.slug = 'top-dog-season-4';
