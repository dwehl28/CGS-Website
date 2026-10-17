insert into public.top_dog_fixture_history (fixture_id, action, snapshot, changed_by)
select
  fixtures.id,
  'official_import_boundary',
  to_jsonb(fixtures),
  'official_round_3_import'
from public.top_dog_fixtures fixtures
join public.top_dog_rounds rounds on rounds.id = fixtures.round_id
join public.top_dog_seasons seasons on seasons.id = rounds.season_id
where rounds.round_number = 3
  and seasons.slug = 'top-dog-season-4'
  and not exists (
    select 1
    from public.top_dog_fixture_history existing
    where existing.fixture_id = fixtures.id
      and existing.action = 'official_import_boundary'
  );
