update public.top_dog_fixtures fixtures
set is_match_of_night = (fixtures.display_order = 1), updated_at = timezone('utc', now())
from public.top_dog_rounds rounds
join public.top_dog_seasons seasons on seasons.id = rounds.season_id
where fixtures.round_id = rounds.id
  and rounds.round_number = 3
  and seasons.slug = 'top-dog-season-4';

update public.top_dog_rounds rounds
set status = 'live', is_current = true, updated_at = timezone('utc', now())
from public.top_dog_seasons seasons
where rounds.season_id = seasons.id
  and rounds.round_number = 3
  and seasons.slug = 'top-dog-season-4';

update public.top_dog_stream_state stream_state
set
  round_id = rounds.id,
  featured_fixture_id = fixtures.id,
  scorebug_fixture_id = fixtures.id,
  updated_at = timezone('utc', now())
from public.top_dog_seasons seasons
join public.top_dog_rounds rounds
  on rounds.season_id = seasons.id and rounds.round_number = 3
join public.top_dog_fixtures fixtures
  on fixtures.round_id = rounds.id and fixtures.display_order = 1
where stream_state.season_id = seasons.id
  and seasons.slug = 'top-dog-season-4';
