update public.top_dog_rounds rounds
set
  score_direction = case when rounds.round_number = 3 then 'higher_wins' else 'lower_wins' end,
  differential_divisor = case when rounds.round_number = 3 then 2 else 1 end,
  updated_at = timezone('utc', now())
from public.top_dog_seasons seasons
where rounds.season_id = seasons.id
  and seasons.slug = 'top-dog-season-4'
  and rounds.round_number between 1 and 3;

update public.cgs_teams
set
  name = 'Fondlers',
  short_name = 'FONDL',
  updated_at = timezone('utc', now())
where slug = 'founders';
