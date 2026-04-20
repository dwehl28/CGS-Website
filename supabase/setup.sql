create table if not exists public.membership_interest (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  full_name text not null,
  email text not null,
  membership_type text not null,
  handicap text,
  handicap_type text,
  interested_in_events text
);

create table if not exists public.contact_enquiries (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  full_name text not null,
  email text not null,
  phone text,
  enquiry_type text not null,
  preferred_contact text,
  subject text not null,
  message text not null,
  status text not null default 'new'
);

create table if not exists public.event_interest (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  event_slug text not null,
  event_name text not null,
  enquiry_type text not null,
  full_name text not null,
  email text not null,
  phone text,
  membership_status text,
  handicap text,
  notes text,
  status text not null default 'new'
);

create index if not exists membership_interest_created_at_idx
  on public.membership_interest (created_at desc);

create index if not exists contact_enquiries_created_at_idx
  on public.contact_enquiries (created_at desc);

create index if not exists event_interest_created_at_idx
  on public.event_interest (created_at desc);

create table if not exists public.clubhouse_updates (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  title text not null,
  summary text not null,
  status_label text not null default 'Clubhouse note',
  cta_label text,
  cta_href text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_pinned boolean not null default false,
  is_published boolean not null default true
);

create index if not exists clubhouse_updates_created_at_idx
  on public.clubhouse_updates (created_at desc);

create index if not exists clubhouse_updates_published_idx
  on public.clubhouse_updates (is_published, is_pinned desc, created_at desc);

create table if not exists public.competition_scoreboards (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  status_label text not null default 'Scoreboard',
  leaderboard_mode text not null default 'gross' check (leaderboard_mode in ('gross', 'net')),
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
  gross_score numeric(10, 2),
  handicap_strokes numeric(10, 2) not null default 0,
  is_cgs_member boolean not null default false,
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

create index if not exists competition_score_entries_live_ranking_idx
  on public.competition_score_entries (competition_id, gross_score asc, handicap_strokes asc, updated_at desc);

alter table public.competition_scoreboards
  add column if not exists leaderboard_mode text not null default 'gross';

alter table public.competition_score_entries
  add column if not exists gross_score numeric(10, 2);

alter table public.competition_score_entries
  add column if not exists handicap_strokes numeric(10, 2) not null default 0;

alter table public.competition_score_entries
  add column if not exists is_cgs_member boolean not null default false;

update public.competition_score_entries
set gross_score = score_sort
where gross_score is null;

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
