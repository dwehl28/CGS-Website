-- Keep the League Night Control Centre responsive as fixtures and seasons grow.
create index if not exists top_dog_fixtures_home_team_idx
  on public.top_dog_fixtures (home_team_id);

create index if not exists top_dog_fixtures_away_team_idx
  on public.top_dog_fixtures (away_team_id);

create index if not exists top_dog_rounds_scoreboard_idx
  on public.top_dog_rounds (scoreboard_id);

create index if not exists top_dog_season_teams_team_idx
  on public.top_dog_season_teams (team_id);

create index if not exists top_dog_stream_state_round_idx
  on public.top_dog_stream_state (round_id);

create index if not exists top_dog_stream_state_featured_fixture_idx
  on public.top_dog_stream_state (featured_fixture_id);

create index if not exists top_dog_stream_state_scorebug_fixture_idx
  on public.top_dog_stream_state (scorebug_fixture_id);

-- This event-trigger helper is for database administration only.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;
