update public.top_dog_fixtures fixtures
set
  display_order = 1,
  scheduled_at = timestamptz '2026-10-12 19:00:00+10',
  simulator_bay = 'YouTube',
  status = 'waiting',
  home_score = 49,
  away_score = 0,
  home_score_confirmed = true,
  away_score_confirmed = false,
  current_hole = 12,
  holes_total = 12,
  result_note = 'Fondlers submitted 49; Off The Ladies result is still TBC.',
  is_match_of_night = true,
  started_at = null,
  finished_at = null,
  updated_at = timezone('utc', now())
from public.top_dog_rounds rounds,
     public.top_dog_seasons seasons,
     public.cgs_teams home_team,
     public.cgs_teams away_team
where fixtures.round_id = rounds.id
  and rounds.season_id = seasons.id
  and seasons.slug = 'top-dog-season-4'
  and rounds.round_number = 3
  and home_team.slug = 'founders'
  and away_team.slug = 'off-the-ladies'
  and fixtures.home_team_id = home_team.id
  and fixtures.away_team_id = away_team.id;

update public.top_dog_fixtures fixtures
set
  display_order = 2,
  scheduled_at = timestamptz '2026-10-12 19:00:00+10',
  simulator_bay = 'Bay 2',
  status = 'final',
  home_score = 49,
  away_score = 34,
  home_score_confirmed = true,
  away_score_confirmed = true,
  current_hole = 12,
  holes_total = 12,
  result_note = 'Imported from the supplied official Round 3 results.',
  is_match_of_night = false,
  started_at = timestamptz '2026-10-12 19:00:00+10',
  finished_at = timestamptz '2026-10-12 21:00:00+10',
  updated_at = timezone('utc', now())
from public.top_dog_rounds rounds,
     public.top_dog_seasons seasons,
     public.cgs_teams home_team,
     public.cgs_teams away_team
where fixtures.round_id = rounds.id
  and rounds.season_id = seasons.id
  and seasons.slug = 'top-dog-season-4'
  and rounds.round_number = 3
  and home_team.slug = 'home-in-a-bunker'
  and away_team.slug = 'nice-pair'
  and fixtures.home_team_id = home_team.id
  and fixtures.away_team_id = away_team.id;
