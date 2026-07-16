create table if not exists public.round_stat_rounds (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  course_name text not null default '',
  format_label text not null default 'Team Ambrose',
  holes_label text not null default '',
  status_label text not null default 'Stats tracking',
  starts_at timestamptz,
  is_live boolean not null default false,
  is_published boolean not null default false
);

create table if not exists public.round_stat_teams (
  id bigint generated always as identity primary key,
  round_id bigint not null references public.round_stat_rounds (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  display_order integer not null default 99,
  name text not null,
  short_name text not null default '',
  accent_color text not null default '#62d7ff',
  players text[] not null default '{}'
);

create table if not exists public.round_stat_holes (
  id bigint generated always as identity primary key,
  round_id bigint not null references public.round_stat_rounds (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  display_order integer not null default 99,
  hole_number integer not null,
  hole_label text not null,
  par_label text not null default 'Par TBD'
);

create table if not exists public.round_stat_entries (
  id bigint generated always as identity primary key,
  round_id bigint not null references public.round_stat_rounds (id) on delete cascade,
  team_id bigint not null references public.round_stat_teams (id) on delete cascade,
  hole_id bigint not null references public.round_stat_holes (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  score_to_par numeric(5, 2),
  putts integer,
  fairway_hit boolean,
  green_in_regulation boolean,
  penalties integer not null default 0,
  drive_player text,
  approach_player text,
  putt_player text,
  notes text,
  constraint round_stat_entries_team_hole_unique unique (team_id, hole_id)
);

create index if not exists round_stat_rounds_public_idx
  on public.round_stat_rounds (is_published, is_live desc, updated_at desc);

create index if not exists round_stat_rounds_slug_idx
  on public.round_stat_rounds (slug);

create index if not exists round_stat_teams_round_idx
  on public.round_stat_teams (round_id, display_order asc);

create index if not exists round_stat_holes_round_idx
  on public.round_stat_holes (round_id, display_order asc);

create index if not exists round_stat_entries_round_team_idx
  on public.round_stat_entries (round_id, team_id, hole_id);

alter table public.round_stat_rounds enable row level security;
alter table public.round_stat_teams enable row level security;
alter table public.round_stat_holes enable row level security;
alter table public.round_stat_entries enable row level security;

drop policy if exists "Public can read published stat rounds" on public.round_stat_rounds;
create policy "Public can read published stat rounds"
  on public.round_stat_rounds
  for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "Public can read teams for published stat rounds" on public.round_stat_teams;
create policy "Public can read teams for published stat rounds"
  on public.round_stat_teams
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.round_stat_rounds rounds
      where rounds.id = round_stat_teams.round_id
        and rounds.is_published = true
    )
  );

drop policy if exists "Public can read holes for published stat rounds" on public.round_stat_holes;
create policy "Public can read holes for published stat rounds"
  on public.round_stat_holes
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.round_stat_rounds rounds
      where rounds.id = round_stat_holes.round_id
        and rounds.is_published = true
    )
  );

drop policy if exists "Public can read entries for published stat rounds" on public.round_stat_entries;
create policy "Public can read entries for published stat rounds"
  on public.round_stat_entries
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.round_stat_rounds rounds
      where rounds.id = round_stat_entries.round_id
        and rounds.is_published = true
    )
  );

grant select on public.round_stat_rounds to anon, authenticated;
grant select on public.round_stat_teams to anon, authenticated;
grant select on public.round_stat_holes to anon, authenticated;
grant select on public.round_stat_entries to anon, authenticated;

insert into public.round_stat_rounds (
  slug,
  title,
  summary,
  course_name,
  format_label,
  holes_label,
  status_label,
  starts_at,
  is_live,
  is_published,
  updated_at
)
values (
  'cabot-cliff-back-12-ambrose',
  'Cabot Cliff Back 12 Ambrose',
  'Prototype stat-tracked CGS round for the upcoming back-12 Ambrose night. Admin can enter score-to-par, putting, fairway, green, penalty, and player contribution data hole by hole.',
  'Cabot Cliff',
  'Team Ambrose',
  'Back 12 holes',
  'Stats prototype',
  null,
  true,
  true,
  timezone('utc', now())
)
on conflict (slug) do update
set
  title = excluded.title,
  summary = excluded.summary,
  course_name = excluded.course_name,
  format_label = excluded.format_label,
  holes_label = excluded.holes_label,
  status_label = excluded.status_label,
  is_live = true,
  is_published = true,
  updated_at = timezone('utc', now());

with stat_round as (
  select id from public.round_stat_rounds where slug = 'cabot-cliff-back-12-ambrose'
),
seed_teams(display_order, name, short_name, accent_color, players) as (
  values
    (1, 'Ball Fondlers', 'BF', '#b9f24b', array['Royce', 'Jaye', 'Crosso']),
    (2, 'Better Than Most', 'BTM', '#62d7ff', array['Hitman', 'Dylan', 'Tyrese']),
    (3, 'Home in a Bunker', 'HIB', '#ffbe18', array['Ben', 'Matt', 'Travis']),
    (4, 'Pin Seekers', 'PS', '#ff9148', array['Daniel', 'Jarred', 'Justin']),
    (5, 'Rough Riders', 'RR', '#d39a6c', array['Troy', 'Andrew', 'Matt C']),
    (6, 'Mulligan Menace', 'MM', '#00a7c4', array['Player A', 'Player B', 'Player C'])
)
insert into public.round_stat_teams (
  round_id,
  display_order,
  name,
  short_name,
  accent_color,
  players,
  updated_at
)
select
  stat_round.id,
  seed_teams.display_order,
  seed_teams.name,
  seed_teams.short_name,
  seed_teams.accent_color,
  seed_teams.players,
  timezone('utc', now())
from stat_round, seed_teams
where not exists (
  select 1
  from public.round_stat_teams existing
  where existing.round_id = stat_round.id
    and existing.name = seed_teams.name
);

with stat_round as (
  select id from public.round_stat_rounds where slug = 'cabot-cliff-back-12-ambrose'
),
seed_holes(display_order, hole_number, hole_label, par_label) as (
  values
    (1, 7, 'Hole 7', 'Par TBD'),
    (2, 8, 'Hole 8', 'Par TBD'),
    (3, 9, 'Hole 9', 'Par TBD'),
    (4, 10, 'Hole 10', 'Par TBD'),
    (5, 11, 'Hole 11', 'Par TBD'),
    (6, 12, 'Hole 12', 'Par TBD'),
    (7, 13, 'Hole 13', 'Par TBD'),
    (8, 14, 'Hole 14', 'Par TBD'),
    (9, 15, 'Hole 15', 'Par TBD'),
    (10, 16, 'Hole 16', 'Par TBD'),
    (11, 17, 'Hole 17', 'Par TBD'),
    (12, 18, 'Hole 18', 'Par TBD')
)
insert into public.round_stat_holes (
  round_id,
  display_order,
  hole_number,
  hole_label,
  par_label,
  updated_at
)
select
  stat_round.id,
  seed_holes.display_order,
  seed_holes.hole_number,
  seed_holes.hole_label,
  seed_holes.par_label,
  timezone('utc', now())
from stat_round, seed_holes
where not exists (
  select 1
  from public.round_stat_holes existing
  where existing.round_id = stat_round.id
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
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'round_stat_rounds'
  ) then
    alter publication supabase_realtime add table public.round_stat_rounds;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'round_stat_teams'
  ) then
    alter publication supabase_realtime add table public.round_stat_teams;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'round_stat_holes'
  ) then
    alter publication supabase_realtime add table public.round_stat_holes;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'round_stat_entries'
  ) then
    alter publication supabase_realtime add table public.round_stat_entries;
  end if;
end
$$;
