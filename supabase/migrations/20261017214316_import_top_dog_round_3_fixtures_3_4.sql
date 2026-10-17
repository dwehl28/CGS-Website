insert into public.top_dog_fixtures (
  round_id, home_team_id, away_team_id, display_order, scheduled_at,
  simulator_bay, status, home_score, away_score, home_score_confirmed,
  away_score_confirmed, current_hole, holes_total, result_note,
  is_match_of_night, started_at, finished_at, updated_at
)
select
  rounds.id, home_team.id, away_team.id, 3,
  timestamptz '2026-10-12 19:00:00+10', 'Bay 1', 'final', 50, 39,
  true, true, 12, 12, 'Imported from the supplied official Round 3 results.',
  false, timestamptz '2026-10-12 19:00:00+10',
  timestamptz '2026-10-12 21:00:00+10', timezone('utc', now())
from public.top_dog_seasons seasons
join public.top_dog_rounds rounds
  on rounds.season_id = seasons.id and rounds.round_number = 3
join public.cgs_teams home_team on home_team.slug = 'fore-skins'
join public.cgs_teams away_team on away_team.slug = 'juniors'
where seasons.slug = 'top-dog-season-4'
  and not exists (
    select 1 from public.top_dog_fixtures existing
    where existing.round_id = rounds.id
      and least(existing.home_team_id, existing.away_team_id) = least(home_team.id, away_team.id)
      and greatest(existing.home_team_id, existing.away_team_id) = greatest(home_team.id, away_team.id)
  );

insert into public.top_dog_fixtures (
  round_id, home_team_id, away_team_id, display_order, scheduled_at,
  simulator_bay, status, home_score, away_score, home_score_confirmed,
  away_score_confirmed, current_hole, holes_total, result_note,
  is_match_of_night, started_at, finished_at, updated_at
)
select
  rounds.id, home_team.id, away_team.id, 4,
  null, 'Free play', 'final', 53, 9,
  true, true, 12, 12, 'Imported from the supplied official Round 3 results.',
  false, timestamptz '2026-10-12 19:00:00+10',
  timestamptz '2026-10-12 21:00:00+10', timezone('utc', now())
from public.top_dog_seasons seasons
join public.top_dog_rounds rounds
  on rounds.season_id = seasons.id and rounds.round_number = 3
join public.cgs_teams home_team on home_team.slug = 'team-tommy'
join public.cgs_teams away_team on away_team.slug = 'kingpins'
where seasons.slug = 'top-dog-season-4'
  and not exists (
    select 1 from public.top_dog_fixtures existing
    where existing.round_id = rounds.id
      and least(existing.home_team_id, existing.away_team_id) = least(home_team.id, away_team.id)
      and greatest(existing.home_team_id, existing.away_team_id) = greatest(home_team.id, away_team.id)
  );
