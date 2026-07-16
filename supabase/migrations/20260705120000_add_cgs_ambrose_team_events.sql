create table if not exists public.cgs_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  email text not null default '',
  handle text not null unique,
  display_name text not null default '',
  nickname text not null default '',
  avatar_url text not null default '',
  handicap numeric(5, 1),
  role text not null default 'player',
  is_public boolean not null default true,
  season_stats jsonb not null default '{}'::jsonb,
  constraint cgs_profiles_role_check check (role in ('player', 'admin'))
);

create table if not exists public.cgs_ambrose_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  season_label text not null default 'CGS Ambrose',
  course_name text not null default 'GSPro course TBC',
  status_label text not null default 'Ambrose team event',
  bay_count integer not null default 3,
  hole_count integer not null default 18,
  starts_at timestamptz,
  is_live boolean not null default false,
  is_published boolean not null default false,
  scoring_notes text not null default 'Team Ambrose. Either allocated team member can enter the team hole result.',
  constraint cgs_ambrose_events_bay_count_check check (bay_count between 1 and 3),
  constraint cgs_ambrose_events_hole_count_check check (hole_count between 1 and 18)
);

create table if not exists public.cgs_ambrose_teams (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.cgs_ambrose_events (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  display_order integer not null default 99,
  name text not null,
  short_name text not null default '',
  accent_color text not null default '#62d7ff',
  bay_label text not null default 'Bay TBC',
  starting_hole integer,
  is_featured boolean not null default false
);

create table if not exists public.cgs_ambrose_team_members (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.cgs_ambrose_events (id) on delete cascade,
  team_id bigint not null references public.cgs_ambrose_teams (id) on delete cascade,
  profile_id uuid not null references public.cgs_profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  display_order integer not null default 99,
  role_label text not null default 'Player',
  unique (event_id, profile_id),
  unique (team_id, profile_id)
);

create table if not exists public.cgs_ambrose_holes (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.cgs_ambrose_events (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  display_order integer not null default 99,
  hole_number integer not null,
  hole_label text not null,
  par integer not null default 4,
  unique (event_id, hole_number),
  constraint cgs_ambrose_holes_par_check check (par between 3 and 6)
);

create table if not exists public.cgs_ambrose_entries (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.cgs_ambrose_events (id) on delete cascade,
  team_id bigint not null references public.cgs_ambrose_teams (id) on delete cascade,
  hole_id bigint not null references public.cgs_ambrose_holes (id) on delete cascade,
  submitted_by uuid references public.cgs_profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  gross_strokes integer,
  score_to_par numeric(5, 2),
  putts integer,
  fairway_hit boolean,
  green_in_regulation boolean,
  penalties integer not null default 0,
  drive_player_id uuid references public.cgs_profiles (id) on delete set null,
  approach_player_id uuid references public.cgs_profiles (id) on delete set null,
  putt_player_id uuid references public.cgs_profiles (id) on delete set null,
  notes text,
  updated_by_admin boolean not null default false,
  unique (team_id, hole_id),
  constraint cgs_ambrose_entries_gross_check check (gross_strokes is null or gross_strokes between 1 and 20),
  constraint cgs_ambrose_entries_putts_check check (putts is null or putts between 0 and 10),
  constraint cgs_ambrose_entries_penalties_check check (penalties between 0 and 20)
);

create index if not exists cgs_profiles_handle_idx
  on public.cgs_profiles (handle);

create index if not exists cgs_ambrose_events_public_idx
  on public.cgs_ambrose_events (is_published, is_live desc, updated_at desc);

create index if not exists cgs_ambrose_events_slug_idx
  on public.cgs_ambrose_events (slug);

create index if not exists cgs_ambrose_teams_event_idx
  on public.cgs_ambrose_teams (event_id, display_order asc);

create index if not exists cgs_ambrose_team_members_event_idx
  on public.cgs_ambrose_team_members (event_id, team_id, display_order asc);

create index if not exists cgs_ambrose_team_members_profile_idx
  on public.cgs_ambrose_team_members (profile_id, event_id);

create index if not exists cgs_ambrose_holes_event_idx
  on public.cgs_ambrose_holes (event_id, display_order asc);

create index if not exists cgs_ambrose_entries_event_team_idx
  on public.cgs_ambrose_entries (event_id, team_id, hole_id);

create index if not exists cgs_ambrose_entries_contribution_idx
  on public.cgs_ambrose_entries (drive_player_id, approach_player_id, putt_player_id);

alter table public.cgs_profiles enable row level security;
alter table public.cgs_ambrose_events enable row level security;
alter table public.cgs_ambrose_teams enable row level security;
alter table public.cgs_ambrose_team_members enable row level security;
alter table public.cgs_ambrose_holes enable row level security;
alter table public.cgs_ambrose_entries enable row level security;

drop policy if exists "Profiles are public or owned" on public.cgs_profiles;
create policy "Profiles are public or owned"
  on public.cgs_profiles
  for select
  to anon, authenticated
  using (is_public = true or auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.cgs_profiles;
create policy "Users can insert own profile"
  on public.cgs_profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.cgs_profiles;
create policy "Users can update own profile"
  on public.cgs_profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Public can read published Ambrose events" on public.cgs_ambrose_events;
create policy "Public can read published Ambrose events"
  on public.cgs_ambrose_events
  for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "Public can read teams for published Ambrose events" on public.cgs_ambrose_teams;
create policy "Public can read teams for published Ambrose events"
  on public.cgs_ambrose_teams
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.cgs_ambrose_events events
      where events.id = cgs_ambrose_teams.event_id
        and events.is_published = true
    )
  );

drop policy if exists "Public can read members for published Ambrose events" on public.cgs_ambrose_team_members;
create policy "Public can read members for published Ambrose events"
  on public.cgs_ambrose_team_members
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.cgs_ambrose_events events
      where events.id = cgs_ambrose_team_members.event_id
        and events.is_published = true
    )
  );

drop policy if exists "Public can read holes for published Ambrose events" on public.cgs_ambrose_holes;
create policy "Public can read holes for published Ambrose events"
  on public.cgs_ambrose_holes
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.cgs_ambrose_events events
      where events.id = cgs_ambrose_holes.event_id
        and events.is_published = true
    )
  );

drop policy if exists "Public can read entries for published Ambrose events" on public.cgs_ambrose_entries;
create policy "Public can read entries for published Ambrose events"
  on public.cgs_ambrose_entries
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.cgs_ambrose_events events
      where events.id = cgs_ambrose_entries.event_id
        and events.is_published = true
    )
  );

grant select, insert, update on public.cgs_profiles to authenticated;
grant select on public.cgs_profiles to anon;
grant select on public.cgs_ambrose_events to anon, authenticated;
grant select on public.cgs_ambrose_teams to anon, authenticated;
grant select on public.cgs_ambrose_team_members to anon, authenticated;
grant select on public.cgs_ambrose_holes to anon, authenticated;
grant select on public.cgs_ambrose_entries to anon, authenticated;

insert into public.cgs_ambrose_events (
  slug,
  title,
  summary,
  season_label,
  course_name,
  status_label,
  bay_count,
  hole_count,
  is_live,
  is_published,
  updated_at
)
values (
  'cgs-ambrose-sim-night',
  'CGS Ambrose Sim Night',
  'Team Ambrose competition built for three GSPro bays, shared team entry, live leaderboard movement, and stream-ready player profile data.',
  'CGS Team Event',
  'GSPro course TBC',
  'Ambrose setup',
  3,
  18,
  true,
  true,
  timezone('utc', now())
)
on conflict (slug) do update
set
  title = excluded.title,
  summary = excluded.summary,
  season_label = excluded.season_label,
  course_name = excluded.course_name,
  status_label = excluded.status_label,
  bay_count = excluded.bay_count,
  hole_count = excluded.hole_count,
  is_live = excluded.is_live,
  is_published = excluded.is_published,
  updated_at = timezone('utc', now());

with ambrose_event as (
  select id from public.cgs_ambrose_events where slug = 'cgs-ambrose-sim-night'
),
seed_teams(display_order, name, short_name, accent_color, bay_label, starting_hole) as (
  values
    (1, 'Bay 1 Team', 'B1', '#62d7ff', 'Bay 1', 1),
    (2, 'Bay 2 Team', 'B2', '#ffbe18', 'Bay 2', 1),
    (3, 'Bay 3 Team', 'B3', '#b9f24b', 'Bay 3', 1)
)
insert into public.cgs_ambrose_teams (
  event_id,
  display_order,
  name,
  short_name,
  accent_color,
  bay_label,
  starting_hole,
  updated_at
)
select
  ambrose_event.id,
  seed_teams.display_order,
  seed_teams.name,
  seed_teams.short_name,
  seed_teams.accent_color,
  seed_teams.bay_label,
  seed_teams.starting_hole,
  timezone('utc', now())
from ambrose_event, seed_teams
where not exists (
  select 1
  from public.cgs_ambrose_teams existing
  where existing.event_id = ambrose_event.id
    and existing.name = seed_teams.name
);

with ambrose_event as (
  select id from public.cgs_ambrose_events where slug = 'cgs-ambrose-sim-night'
),
seed_holes as (
  select
    generate_series(1, 18) as hole_number
)
insert into public.cgs_ambrose_holes (
  event_id,
  display_order,
  hole_number,
  hole_label,
  par,
  updated_at
)
select
  ambrose_event.id,
  seed_holes.hole_number,
  seed_holes.hole_number,
  'Hole ' || seed_holes.hole_number,
  4,
  timezone('utc', now())
from ambrose_event, seed_holes
where not exists (
  select 1
  from public.cgs_ambrose_holes existing
  where existing.event_id = ambrose_event.id
    and existing.hole_number = seed_holes.hole_number
);

do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cgs_ambrose_events'
  ) then
    alter publication supabase_realtime add table public.cgs_ambrose_events;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cgs_ambrose_teams'
  ) then
    alter publication supabase_realtime add table public.cgs_ambrose_teams;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cgs_ambrose_team_members'
  ) then
    alter publication supabase_realtime add table public.cgs_ambrose_team_members;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cgs_ambrose_holes'
  ) then
    alter publication supabase_realtime add table public.cgs_ambrose_holes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cgs_ambrose_entries'
  ) then
    alter publication supabase_realtime add table public.cgs_ambrose_entries;
  end if;
end
$$;
