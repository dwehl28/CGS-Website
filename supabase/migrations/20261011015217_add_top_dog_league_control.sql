create table if not exists public.cgs_teams (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  slug text not null unique,
  name text not null,
  short_name text not null default '',
  accent_color text not null default '#20c8ff',
  logo_url text not null default '',
  is_active boolean not null default true,
  constraint cgs_teams_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint cgs_teams_name_check check (char_length(trim(name)) between 1 and 100)
);

create table if not exists public.cgs_team_members (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  team_id bigint not null references public.cgs_teams (id) on delete cascade,
  profile_id uuid not null references public.cgs_profiles (id) on delete cascade,
  display_order integer not null default 99,
  role_label text not null default 'Player',
  is_active boolean not null default true,
  unique (team_id, profile_id)
);

alter table public.competition_score_entries
  add column if not exists team_id bigint references public.cgs_teams (id) on delete set null;

alter table public.cgs_ambrose_teams
  add column if not exists team_id bigint references public.cgs_teams (id) on delete set null;

alter table public.round_stat_teams
  add column if not exists team_id bigint references public.cgs_teams (id) on delete set null;

create table if not exists public.top_dog_seasons (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  slug text not null unique,
  name text not null,
  season_label text not null default '',
  starts_on date,
  ends_on date,
  default_holes integer not null default 9,
  win_points integer not null default 3,
  draw_points integer not null default 1,
  loss_points integer not null default 0,
  is_active boolean not null default false,
  is_published boolean not null default false,
  integration_config jsonb not null default '{}'::jsonb,
  constraint top_dog_seasons_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint top_dog_seasons_holes_check check (default_holes between 1 and 36),
  constraint top_dog_seasons_points_check check (
    win_points >= draw_points and draw_points >= loss_points and loss_points >= 0
  )
);

create unique index if not exists top_dog_seasons_one_active_idx
  on public.top_dog_seasons (is_active)
  where is_active = true;

create table if not exists public.top_dog_season_teams (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  season_id bigint not null references public.top_dog_seasons (id) on delete cascade,
  team_id bigint not null references public.cgs_teams (id) on delete restrict,
  display_order integer not null default 99,
  is_active boolean not null default true,
  unique (season_id, team_id)
);

create table if not exists public.top_dog_rounds (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  season_id bigint not null references public.top_dog_seasons (id) on delete cascade,
  scoreboard_id bigint references public.competition_scoreboards (id) on delete set null,
  round_number integer not null,
  name text not null,
  scheduled_at timestamptz,
  venue text not null default 'The Tee Lounge',
  course_name text not null default '',
  status text not null default 'waiting',
  is_current boolean not null default false,
  unique (season_id, round_number),
  constraint top_dog_rounds_number_check check (round_number between 1 and 99),
  constraint top_dog_rounds_status_check check (status in ('waiting', 'live', 'final'))
);

create unique index if not exists top_dog_rounds_one_current_idx
  on public.top_dog_rounds (season_id)
  where is_current = true;

create table if not exists public.top_dog_fixtures (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  round_id bigint not null references public.top_dog_rounds (id) on delete cascade,
  home_team_id bigint not null references public.cgs_teams (id) on delete restrict,
  away_team_id bigint not null references public.cgs_teams (id) on delete restrict,
  display_order integer not null default 99,
  scheduled_at timestamptz,
  simulator_bay text not null default '',
  status text not null default 'waiting',
  home_score integer not null default 0,
  away_score integer not null default 0,
  current_hole integer not null default 0,
  holes_total integer not null default 9,
  result_note text not null default '',
  is_match_of_night boolean not null default false,
  started_at timestamptz,
  finished_at timestamptz,
  constraint top_dog_fixtures_distinct_teams_check check (home_team_id <> away_team_id),
  constraint top_dog_fixtures_status_check check (status in ('waiting', 'live', 'final')),
  constraint top_dog_fixtures_scores_check check (
    home_score between -99 and 99 and away_score between -99 and 99
  ),
  constraint top_dog_fixtures_holes_check check (
    holes_total between 1 and 36 and current_hole between 0 and holes_total
  )
);

create unique index if not exists top_dog_fixtures_team_pair_idx
  on public.top_dog_fixtures (
    round_id,
    least(home_team_id, away_team_id),
    greatest(home_team_id, away_team_id)
  );

create unique index if not exists top_dog_fixtures_match_of_night_idx
  on public.top_dog_fixtures (round_id)
  where is_match_of_night = true;

create table if not exists public.top_dog_fixture_history (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  fixture_id bigint not null references public.top_dog_fixtures (id) on delete cascade,
  action text not null,
  snapshot jsonb not null,
  changed_by text not null default 'admin'
);

create table if not exists public.top_dog_stream_state (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  season_id bigint not null unique references public.top_dog_seasons (id) on delete cascade,
  round_id bigint references public.top_dog_rounds (id) on delete set null,
  featured_fixture_id bigint references public.top_dog_fixtures (id) on delete set null,
  scorebug_fixture_id bigint references public.top_dog_fixtures (id) on delete set null,
  scorebug_visible boolean not null default true,
  ticker_visible boolean not null default true,
  ticker_paused boolean not null default false,
  ticker_interval_seconds integer not null default 12,
  ticker_categories jsonb not null default '["scores", "ladder", "next_match"]'::jsonb,
  ticker_manual_message text not null default '',
  central_overlay text not null default 'none',
  central_overlay_visible boolean not null default false,
  overlay_payload jsonb not null default '{}'::jsonb,
  constraint top_dog_stream_state_ticker_interval_check check (
    ticker_interval_seconds between 4 and 120
  ),
  constraint top_dog_stream_state_overlay_check check (
    central_overlay in (
      'none',
      'match',
      'match_of_night',
      'live_ladder',
      'results_hold',
      'best_team',
      'longest_drive',
      'ctp',
      'bunker_boy',
      'one_putt_jackpot',
      'sponsor',
      'subscribe',
      'player_interview',
      'up_next',
      'match_result',
      'shot_of_night',
      'doghouse',
      'butters_board',
      'night_wrap_up',
      'stat_of_week'
    )
  )
);

create index if not exists cgs_team_members_team_idx
  on public.cgs_team_members (team_id, display_order);

create index if not exists competition_score_entries_team_idx
  on public.competition_score_entries (team_id);

create index if not exists cgs_ambrose_teams_team_idx
  on public.cgs_ambrose_teams (team_id);

create index if not exists round_stat_teams_team_idx
  on public.round_stat_teams (team_id);

create index if not exists top_dog_season_teams_season_idx
  on public.top_dog_season_teams (season_id, is_active, display_order);

create index if not exists top_dog_rounds_season_idx
  on public.top_dog_rounds (season_id, round_number);

create index if not exists top_dog_fixtures_round_idx
  on public.top_dog_fixtures (round_id, status, display_order);

create index if not exists top_dog_fixture_history_fixture_idx
  on public.top_dog_fixture_history (fixture_id, id desc);

alter table public.cgs_teams enable row level security;
alter table public.cgs_team_members enable row level security;
alter table public.top_dog_seasons enable row level security;
alter table public.top_dog_season_teams enable row level security;
alter table public.top_dog_rounds enable row level security;
alter table public.top_dog_fixtures enable row level security;
alter table public.top_dog_fixture_history enable row level security;
alter table public.top_dog_stream_state enable row level security;

revoke all on public.cgs_teams from anon, authenticated;
revoke all on public.cgs_team_members from anon, authenticated;
revoke all on public.top_dog_seasons from anon, authenticated;
revoke all on public.top_dog_season_teams from anon, authenticated;
revoke all on public.top_dog_rounds from anon, authenticated;
revoke all on public.top_dog_fixtures from anon, authenticated;
revoke all on public.top_dog_fixture_history from anon, authenticated;
revoke all on public.top_dog_stream_state from anon, authenticated;

grant select on public.cgs_teams to anon, authenticated;
grant select on public.top_dog_seasons to anon, authenticated;
grant select on public.top_dog_season_teams to anon, authenticated;
grant select on public.top_dog_rounds to anon, authenticated;
grant select on public.top_dog_fixtures to anon, authenticated;
grant select on public.top_dog_stream_state to anon, authenticated;

grant all on public.cgs_teams to service_role;
grant all on public.cgs_team_members to service_role;
grant all on public.top_dog_seasons to service_role;
grant all on public.top_dog_season_teams to service_role;
grant all on public.top_dog_rounds to service_role;
grant all on public.top_dog_fixtures to service_role;
grant all on public.top_dog_fixture_history to service_role;
grant all on public.top_dog_stream_state to service_role;

grant usage, select on all sequences in schema public to service_role;

drop policy if exists "Public can read active CGS teams" on public.cgs_teams;
create policy "Public can read active CGS teams"
  on public.cgs_teams
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Public can read published Top Dog seasons" on public.top_dog_seasons;
create policy "Public can read published Top Dog seasons"
  on public.top_dog_seasons
  for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "Public can read teams in published Top Dog seasons" on public.top_dog_season_teams;
create policy "Public can read teams in published Top Dog seasons"
  on public.top_dog_season_teams
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.top_dog_seasons seasons
      where seasons.id = top_dog_season_teams.season_id
        and seasons.is_published = true
    )
  );

drop policy if exists "Public can read rounds in published Top Dog seasons" on public.top_dog_rounds;
create policy "Public can read rounds in published Top Dog seasons"
  on public.top_dog_rounds
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.top_dog_seasons seasons
      where seasons.id = top_dog_rounds.season_id
        and seasons.is_published = true
    )
  );

drop policy if exists "Public can read fixtures in published Top Dog seasons" on public.top_dog_fixtures;
create policy "Public can read fixtures in published Top Dog seasons"
  on public.top_dog_fixtures
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.top_dog_rounds rounds
      join public.top_dog_seasons seasons on seasons.id = rounds.season_id
      where rounds.id = top_dog_fixtures.round_id
        and seasons.is_published = true
    )
  );

drop policy if exists "Public can read stream state for published Top Dog seasons" on public.top_dog_stream_state;
create policy "Public can read stream state for published Top Dog seasons"
  on public.top_dog_stream_state
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.top_dog_seasons seasons
      where seasons.id = top_dog_stream_state.season_id
        and seasons.is_published = true
    )
  );

create or replace function public.apply_top_dog_fixture_command(
  p_fixture_id bigint,
  p_command text,
  p_payload jsonb default '{}'::jsonb
)
returns public.top_dog_fixtures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture public.top_dog_fixtures;
  v_history public.top_dog_fixture_history;
  v_now timestamptz := timezone('utc', now());
begin
  select *
  into v_fixture
  from public.top_dog_fixtures
  where id = p_fixture_id
  for update;

  if not found then
    raise exception 'Top Dog fixture % was not found', p_fixture_id;
  end if;

  if p_command = 'undo' then
    select *
    into v_history
    from public.top_dog_fixture_history
    where fixture_id = p_fixture_id
    order by id desc
    limit 1
    for update;

    if not found then
      return v_fixture;
    end if;

    if v_history.action = 'match_of_night' then
      update public.top_dog_fixtures
      set is_match_of_night = false, updated_at = v_now
      where round_id = v_fixture.round_id
        and is_match_of_night = true;
    end if;

    update public.top_dog_fixtures
    set
      scheduled_at = (v_history.snapshot ->> 'scheduled_at')::timestamptz,
      simulator_bay = coalesce(v_history.snapshot ->> 'simulator_bay', ''),
      status = coalesce(v_history.snapshot ->> 'status', 'waiting'),
      home_score = coalesce((v_history.snapshot ->> 'home_score')::integer, 0),
      away_score = coalesce((v_history.snapshot ->> 'away_score')::integer, 0),
      current_hole = coalesce((v_history.snapshot ->> 'current_hole')::integer, 0),
      holes_total = coalesce((v_history.snapshot ->> 'holes_total')::integer, 9),
      result_note = coalesce(v_history.snapshot ->> 'result_note', ''),
      is_match_of_night = coalesce((v_history.snapshot ->> 'is_match_of_night')::boolean, false),
      started_at = (v_history.snapshot ->> 'started_at')::timestamptz,
      finished_at = (v_history.snapshot ->> 'finished_at')::timestamptz,
      updated_at = v_now
    where id = p_fixture_id
    returning * into v_fixture;

    if v_history.action = 'match_of_night'
      and nullif(v_history.snapshot ->> 'previous_match_of_night_id', '') is not null then
      update public.top_dog_fixtures
      set is_match_of_night = true, updated_at = v_now
      where id = (v_history.snapshot ->> 'previous_match_of_night_id')::bigint
        and round_id = v_fixture.round_id;
    end if;

    delete from public.top_dog_fixture_history where id = v_history.id;
    return v_fixture;
  end if;

  insert into public.top_dog_fixture_history (fixture_id, action, snapshot)
  values (
    p_fixture_id,
    p_command,
    case
      when p_command = 'match_of_night' then
        to_jsonb(v_fixture) || jsonb_build_object(
          'previous_match_of_night_id',
          (
            select fixtures.id
            from public.top_dog_fixtures fixtures
            where fixtures.round_id = v_fixture.round_id
              and fixtures.is_match_of_night = true
              and fixtures.id <> p_fixture_id
            limit 1
          )
        )
      else to_jsonb(v_fixture)
    end
  );

  if p_command = 'start' then
    update public.top_dog_fixtures
    set
      status = 'live',
      current_hole = greatest(current_hole, 1),
      started_at = coalesce(started_at, v_now),
      finished_at = null,
      updated_at = v_now
    where id = p_fixture_id;
  elsif p_command = 'set_score' then
    update public.top_dog_fixtures
    set
      home_score = greatest(-99, least(99, coalesce((p_payload ->> 'home_score')::integer, home_score))),
      away_score = greatest(-99, least(99, coalesce((p_payload ->> 'away_score')::integer, away_score))),
      updated_at = v_now
    where id = p_fixture_id;
  elsif p_command = 'adjust_score' then
    update public.top_dog_fixtures
    set
      home_score = greatest(-99, least(99, home_score + coalesce((p_payload ->> 'home_delta')::integer, 0))),
      away_score = greatest(-99, least(99, away_score + coalesce((p_payload ->> 'away_delta')::integer, 0))),
      updated_at = v_now
    where id = p_fixture_id;
  elsif p_command = 'next_hole' then
    update public.top_dog_fixtures
    set
      status = case when status = 'waiting' then 'live' else status end,
      current_hole = least(holes_total, current_hole + 1),
      started_at = coalesce(started_at, v_now),
      updated_at = v_now
    where id = p_fixture_id;
  elsif p_command = 'previous_hole' then
    update public.top_dog_fixtures
    set
      current_hole = greatest(0, current_hole - 1),
      updated_at = v_now
    where id = p_fixture_id;
  elsif p_command = 'finish' then
    update public.top_dog_fixtures
    set
      status = 'final',
      finished_at = v_now,
      updated_at = v_now
    where id = p_fixture_id;
  elsif p_command = 'reopen' then
    update public.top_dog_fixtures
    set
      status = 'live',
      started_at = coalesce(started_at, v_now),
      finished_at = null,
      updated_at = v_now
    where id = p_fixture_id;
  elsif p_command = 'match_of_night' then
    update public.top_dog_fixtures
    set is_match_of_night = false, updated_at = v_now
    where round_id = v_fixture.round_id
      and is_match_of_night = true;

    update public.top_dog_fixtures
    set is_match_of_night = true, updated_at = v_now
    where id = p_fixture_id;

    update public.top_dog_stream_state stream_state
    set
      featured_fixture_id = p_fixture_id,
      scorebug_fixture_id = coalesce(stream_state.scorebug_fixture_id, p_fixture_id),
      updated_at = v_now
    where stream_state.season_id = (
      select rounds.season_id
      from public.top_dog_rounds rounds
      where rounds.id = v_fixture.round_id
    );
  else
    raise exception 'Unsupported Top Dog fixture command: %', p_command;
  end if;

  select * into v_fixture from public.top_dog_fixtures where id = p_fixture_id;
  return v_fixture;
end;
$$;

revoke all on function public.apply_top_dog_fixture_command(bigint, text, jsonb) from public;
revoke all on function public.apply_top_dog_fixture_command(bigint, text, jsonb) from anon, authenticated;
grant execute on function public.apply_top_dog_fixture_command(bigint, text, jsonb) to service_role;

insert into public.top_dog_seasons (
  slug,
  name,
  season_label,
  starts_on,
  default_holes,
  is_active,
  is_published,
  updated_at
)
select
  'top-dog-season-4',
  'CGS Top Dog League',
  'Season 4',
  min(scoreboards.starts_at)::date,
  9,
  true,
  true,
  timezone('utc', now())
from public.competition_scoreboards scoreboards
where scoreboards.slug like 'top-dog-round-%'
having count(*) > 0
on conflict (slug) do update
set
  name = excluded.name,
  season_label = excluded.season_label,
  is_active = true,
  is_published = true,
  updated_at = timezone('utc', now());

with top_dog_entries as (
  select distinct on (team_slug)
    team_slug,
    player_name
  from (
    select
      lower(
        regexp_replace(
          regexp_replace(trim(entries.player_name), '[^a-zA-Z0-9]+', '-', 'g'),
          '(^-|-$)',
          '',
          'g'
        )
      ) as team_slug,
      trim(entries.player_name) as player_name,
      entries.updated_at
    from public.competition_score_entries entries
    join public.competition_scoreboards scoreboards
      on scoreboards.id = entries.competition_id
    where scoreboards.slug like 'top-dog-round-%'
      and trim(entries.player_name) <> ''
  ) candidates
  where team_slug <> ''
  order by team_slug, updated_at desc
)
insert into public.cgs_teams (slug, name, short_name, updated_at)
select
  team_slug,
  player_name,
  upper(left(regexp_replace(player_name, '[^a-zA-Z0-9]', '', 'g'), 4)),
  timezone('utc', now())
from top_dog_entries
on conflict (slug) do update
set
  name = excluded.name,
  updated_at = timezone('utc', now());

update public.competition_score_entries entries
set team_id = teams.id
from public.competition_scoreboards scoreboards,
     public.cgs_teams teams
where scoreboards.id = entries.competition_id
  and scoreboards.slug like 'top-dog-round-%'
  and teams.slug = lower(
    regexp_replace(
      regexp_replace(trim(entries.player_name), '[^a-zA-Z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    )
  );

insert into public.top_dog_season_teams (season_id, team_id, display_order, updated_at)
select
  seasons.id,
  teams.id,
  row_number() over (order by teams.name),
  timezone('utc', now())
from public.top_dog_seasons seasons
join public.cgs_teams teams on teams.is_active = true
where seasons.slug = 'top-dog-season-4'
  and exists (
    select 1
    from public.competition_score_entries entries
    join public.competition_scoreboards scoreboards
      on scoreboards.id = entries.competition_id
    where entries.team_id = teams.id
      and scoreboards.slug like 'top-dog-round-%'
  )
on conflict (season_id, team_id) do update
set is_active = true, updated_at = timezone('utc', now());

insert into public.top_dog_rounds (
  season_id,
  scoreboard_id,
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
  scoreboards.id,
  nullif(regexp_replace(coalesce(scoreboards.round_label, scoreboards.slug), '[^0-9]', '', 'g'), '')::integer,
  coalesce(nullif(scoreboards.round_label, ''), scoreboards.title),
  scoreboards.starts_at,
  coalesce(nullif(scoreboards.location, ''), 'The Tee Lounge'),
  coalesce(scoreboards.location, ''),
  case
    when scoreboards.starts_at is not null
      and scoreboards.starts_at < timezone('utc', now()) - interval '6 hours'
      then 'final'
    when scoreboards.is_live then 'live'
    else 'waiting'
  end,
  false,
  timezone('utc', now())
from public.top_dog_seasons seasons
join public.competition_scoreboards scoreboards
  on scoreboards.slug like 'top-dog-round-%'
where seasons.slug = 'top-dog-season-4'
  and nullif(regexp_replace(coalesce(scoreboards.round_label, scoreboards.slug), '[^0-9]', '', 'g'), '') is not null
on conflict (season_id, round_number) do update
set
  scoreboard_id = excluded.scoreboard_id,
  name = excluded.name,
  scheduled_at = excluded.scheduled_at,
  venue = excluded.venue,
  course_name = excluded.course_name,
  updated_at = timezone('utc', now());

insert into public.top_dog_stream_state (season_id, updated_at)
select seasons.id, timezone('utc', now())
from public.top_dog_seasons seasons
where seasons.slug = 'top-dog-season-4'
on conflict (season_id) do nothing;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'cgs_teams',
    'top_dog_seasons',
    'top_dog_season_teams',
    'top_dog_rounds',
    'top_dog_fixtures',
    'top_dog_stream_state'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end
$$;
