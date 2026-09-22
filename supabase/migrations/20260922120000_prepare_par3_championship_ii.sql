alter table public.cgs_par3_events
  add column if not exists entry_fee_cents integer not null default 3000;

alter table public.cgs_par3_players
  add column if not exists ctp_distance_cm integer;

alter table public.cgs_par3_players
  drop constraint if exists cgs_par3_players_ctp_distance_cm_check;

alter table public.cgs_par3_players
  add constraint cgs_par3_players_ctp_distance_cm_check
  check (ctp_distance_cm is null or ctp_distance_cm between 0 and 100000);

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
  registrations_open,
  entry_fee_cents
)
values (
  'par-3-championship-ii-2026',
  'CGS Par 3 Championship II',
  'A 24-player match-play championship with six pools, two closest-to-pin contests, and a single-elimination Round of 16.',
  '2026-11-07T07:00:00Z',
  '2026-11-07T06:30:00Z',
  'The Tee Lounge',
  '2892-2896 Logan Rd, Underwood QLD 4119',
  'https://crossodoggolf.com/#register',
  'https://www.youtube.com/@CrossodogGolfSociety',
  'Registrations open',
  'Secure one of 24 places, then follow every fixture, simulator call, table, and finals matchup live.',
  'registrations',
  24,
  6,
  4,
  true,
  false,
  true,
  3000
)
on conflict (slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  starts_at = excluded.starts_at,
  warmup_at = excluded.warmup_at,
  venue_name = excluded.venue_name,
  venue_address = excluded.venue_address,
  registration_url = excluded.registration_url,
  youtube_url = excluded.youtube_url,
  max_players = excluded.max_players,
  pool_count = excluded.pool_count,
  pool_size = excluded.pool_size,
  entry_fee_cents = excluded.entry_fee_cents,
  is_published = true,
  updated_at = timezone('utc', now());
