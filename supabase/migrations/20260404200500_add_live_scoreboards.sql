create table if not exists public.competition_scoreboards (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  status_label text not null default 'Scoreboard',
  location text,
  format_label text,
  round_label text,
  cta_label text,
  cta_href text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_live boolean not null default false,
  is_published boolean not null default false
);

create table if not exists public.competition_score_entries (
  id bigint generated always as identity primary key,
  competition_id bigint not null references public.competition_scoreboards (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  position integer not null default 99,
  player_name text not null,
  score_display text not null,
  score_sort numeric(10, 2) not null default 0,
  thru_label text,
  status_label text,
  highlight_note text,
  is_featured boolean not null default false
);

create index if not exists competition_scoreboards_live_idx
  on public.competition_scoreboards (is_published, is_live desc, updated_at desc);

create index if not exists competition_scoreboards_slug_idx
  on public.competition_scoreboards (slug);

create index if not exists competition_score_entries_competition_idx
  on public.competition_score_entries (competition_id, position asc, score_sort asc, updated_at desc);

alter table public.competition_scoreboards enable row level security;
alter table public.competition_score_entries enable row level security;

drop policy if exists "Public can read published competition scoreboards" on public.competition_scoreboards;
create policy "Public can read published competition scoreboards"
  on public.competition_scoreboards
  for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "Public can read entries for published competition scoreboards" on public.competition_score_entries;
create policy "Public can read entries for published competition scoreboards"
  on public.competition_score_entries
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.competition_scoreboards boards
      where boards.id = competition_score_entries.competition_id
        and boards.is_published = true
    )
  );

grant select on public.competition_scoreboards to anon, authenticated;
grant select on public.competition_score_entries to anon, authenticated;

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
      and tablename = 'competition_scoreboards'
  ) then
    alter publication supabase_realtime add table public.competition_scoreboards;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'competition_score_entries'
  ) then
    alter publication supabase_realtime add table public.competition_score_entries;
  end if;
end
$$;
