create table if not exists public.cgs_par3_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  starts_at timestamptz not null,
  warmup_at timestamptz not null,
  venue_name text not null,
  venue_address text not null,
  registration_url text not null,
  youtube_url text not null,
  status_label text not null default 'Registrations open',
  public_message text not null default '',
  current_phase text not null default 'registrations',
  max_players integer not null default 24,
  pool_count integer not null default 6,
  pool_size integer not null default 4,
  is_published boolean not null default true,
  is_live boolean not null default false,
  registrations_open boolean not null default true,
  knockout_data jsonb,
  knockout_generated_at timestamptz,
  constraint cgs_par3_events_phase_check
    check (current_phase in ('registrations', 'pools', 'ctp', 'knockout', 'complete')),
  constraint cgs_par3_events_max_players_check check (max_players between 2 and 64),
  constraint cgs_par3_events_pool_count_check check (pool_count between 1 and 16),
  constraint cgs_par3_events_pool_size_check check (pool_size between 2 and 8)
);

create table if not exists public.cgs_par3_players (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.cgs_par3_events (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  display_order integer not null default 99,
  name text not null,
  tee_category text not null default 'championship',
  pool_number integer,
  pool_rank_override integer,
  ctp_rank integer,
  is_withdrawn boolean not null default false,
  constraint cgs_par3_players_tee_category_check
    check (tee_category in ('championship', 'ladies', 'junior')),
  constraint cgs_par3_players_pool_number_check
    check (pool_number is null or pool_number between 1 and 6),
  constraint cgs_par3_players_pool_rank_override_check
    check (pool_rank_override is null or pool_rank_override between 1 and 4),
  constraint cgs_par3_players_ctp_rank_check
    check (ctp_rank is null or ctp_rank between 1 and 6)
);

create table if not exists public.cgs_par3_player_private (
  player_id bigint primary key references public.cgs_par3_players (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  phone text not null default '',
  consent boolean not null default false
);

create table if not exists public.cgs_par3_pool_matches (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.cgs_par3_events (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  pool_number integer not null,
  match_number integer not null,
  player1_id bigint not null references public.cgs_par3_players (id) on delete cascade,
  player2_id bigint not null references public.cgs_par3_players (id) on delete cascade,
  winner_id bigint references public.cgs_par3_players (id) on delete set null,
  status text not null default 'scheduled',
  bay_number integer,
  constraint cgs_par3_pool_matches_pool_number_check check (pool_number between 1 and 6),
  constraint cgs_par3_pool_matches_players_order_check check (player1_id < player2_id),
  constraint cgs_par3_pool_matches_winner_check
    check (winner_id is null or winner_id = player1_id or winner_id = player2_id),
  constraint cgs_par3_pool_matches_status_check
    check (status in ('scheduled', 'live', 'complete')),
  constraint cgs_par3_pool_matches_bay_number_check
    check (bay_number is null or bay_number between 1 and 3),
  unique (event_id, player1_id, player2_id)
);

create index if not exists cgs_par3_events_public_idx
  on public.cgs_par3_events (is_published, starts_at);

create index if not exists cgs_par3_players_event_pool_idx
  on public.cgs_par3_players (event_id, pool_number, display_order);

create index if not exists cgs_par3_pool_matches_event_pool_idx
  on public.cgs_par3_pool_matches (event_id, pool_number, match_number);

alter table public.cgs_par3_events enable row level security;
alter table public.cgs_par3_players enable row level security;
alter table public.cgs_par3_player_private enable row level security;
alter table public.cgs_par3_pool_matches enable row level security;

drop policy if exists "Public can read published Par 3 events" on public.cgs_par3_events;
create policy "Public can read published Par 3 events"
  on public.cgs_par3_events
  for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "Public can read Par 3 players" on public.cgs_par3_players;
create policy "Public can read Par 3 players"
  on public.cgs_par3_players
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.cgs_par3_events events
      where events.id = cgs_par3_players.event_id
        and events.is_published = true
    )
  );

drop policy if exists "Public can read Par 3 pool matches" on public.cgs_par3_pool_matches;
create policy "Public can read Par 3 pool matches"
  on public.cgs_par3_pool_matches
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.cgs_par3_events events
      where events.id = cgs_par3_pool_matches.event_id
        and events.is_published = true
    )
  );

insert into public.cgs_par3_events (
  slug,
  title,
  summary,
  starts_at,
  warmup_at,
  venue_name,
  venue_address,
  registration_url,
  youtube_url,
  status_label,
  public_message,
  current_phase,
  max_players,
  pool_count,
  pool_size,
  is_published,
  is_live,
  registrations_open
)
values (
  'par-3-showdown-2026',
  'CGS Par 3 Showdown',
  'A 24-player, three-hole match-play tournament with six pools, a closest-to-pin shootout, and a single-elimination final bracket.',
  '2026-09-12T08:00:00Z',
  '2026-09-12T07:30:00Z',
  'The Tee Lounge',
  '2892-2896 Logan Rd, Underwood QLD 4119',
  'https://crossodoggolfs-shop.bigcartel.com',
  'https://www.youtube.com/@CrossodogGolfSociety',
  'Registrations open',
  'Secure your place through the CGS shop. Tournament updates and live results will appear here.',
  'registrations',
  24,
  6,
  4,
  true,
  false,
  true
)
on conflict (slug) do nothing;

do $$
begin
  alter publication supabase_realtime add table public.cgs_par3_events;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.cgs_par3_players;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.cgs_par3_pool_matches;
exception
  when duplicate_object then null;
end
$$;
