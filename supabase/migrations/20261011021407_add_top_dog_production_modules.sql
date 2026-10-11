create table if not exists public.cgs_sponsors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  slug text not null unique,
  name text not null,
  logo_url text not null default '',
  website_url text not null default '',
  promo_code text not null default '',
  prize_supplied text not null default '',
  campaign text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  constraint cgs_sponsors_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint cgs_sponsors_name_check check (char_length(trim(name)) between 1 and 120)
);

create table if not exists public.top_dog_prizes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  season_id bigint not null references public.top_dog_seasons (id) on delete cascade,
  round_id bigint not null references public.top_dog_rounds (id) on delete cascade,
  category text not null,
  custom_category text not null default '',
  profile_id uuid references public.cgs_profiles (id) on delete set null,
  team_id bigint references public.cgs_teams (id) on delete set null,
  display_name text not null default '',
  result_value text not null default '',
  prize text not null default '',
  sponsor_id bigint references public.cgs_sponsors (id) on delete set null,
  notes text not null default '',
  winner_status text not null default 'tracking',
  constraint top_dog_prizes_category_check check (
    category in (
      'best_team',
      'longest_drive',
      'ctp',
      'bunker_boy',
      'shot_of_night',
      'player_of_night',
      'sponsor_prize',
      'custom'
    )
  ),
  constraint top_dog_prizes_winner_status_check check (
    winner_status in ('tracking', 'leader', 'winner')
  )
);

create table if not exists public.top_dog_jackpots (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  season_id bigint not null unique references public.top_dog_seasons (id) on delete cascade,
  round_id bigint references public.top_dog_rounds (id) on delete set null,
  default_amount numeric(10, 2) not null default 100,
  current_amount numeric(10, 2) not null default 100,
  selected_profile_id uuid references public.cgs_profiles (id) on delete set null,
  selected_team_id bigint references public.cgs_teams (id) on delete set null,
  selected_name text not null default '',
  status text not null default 'idle',
  started_at timestamptz,
  constraint top_dog_jackpots_amount_check check (
    default_amount >= 0 and current_amount >= 0
  ),
  constraint top_dog_jackpots_status_check check (
    status in ('idle', 'selected', 'reveal', 'countdown', 'miss', 'won', 'rollover')
  )
);

create table if not exists public.top_dog_jackpot_attempts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  jackpot_id bigint not null references public.top_dog_jackpots (id) on delete cascade,
  round_id bigint references public.top_dog_rounds (id) on delete set null,
  profile_id uuid references public.cgs_profiles (id) on delete set null,
  team_id bigint references public.cgs_teams (id) on delete set null,
  player_name text not null default '',
  amount numeric(10, 2) not null default 0,
  result text not null default 'pending',
  attempted_at timestamptz not null default timezone('utc', now()),
  constraint top_dog_jackpot_attempts_amount_check check (amount >= 0),
  constraint top_dog_jackpot_attempts_result_check check (
    result in ('pending', 'success', 'miss', 'rollover')
  )
);

create table if not exists public.top_dog_sponsor_activations (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  season_id bigint not null references public.top_dog_seasons (id) on delete cascade,
  round_id bigint not null references public.top_dog_rounds (id) on delete cascade,
  sponsor_id bigint not null references public.cgs_sponsors (id) on delete restrict,
  campaign text not null default '',
  prize_supplied text not null default '',
  notes text not null default '',
  logo_displayed boolean not null default false,
  verbal_mention boolean not null default false,
  product_shown boolean not null default false,
  promo_code_shown boolean not null default false,
  winner_photographed boolean not null default false,
  sponsor_tagged boolean not null default false,
  social_post_completed boolean not null default false,
  unique (round_id, sponsor_id)
);

create table if not exists public.top_dog_interviews (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  season_id bigint not null references public.top_dog_seasons (id) on delete cascade,
  round_id bigint not null references public.top_dog_rounds (id) on delete cascade,
  fixture_id bigint references public.top_dog_fixtures (id) on delete set null,
  profile_id uuid references public.cgs_profiles (id) on delete set null,
  team_id bigint references public.cgs_teams (id) on delete set null,
  player_name text not null default '',
  team_label text not null default '',
  interview_type text not null default 'other',
  status text not null default 'queued',
  suggested_questions jsonb not null default '[]'::jsonb,
  notes text not null default '',
  constraint top_dog_interviews_type_check check (
    interview_type in ('pre_match', 'post_match', 'winner', 'prize_winner', 'other')
  ),
  constraint top_dog_interviews_status_check check (
    status in ('queued', 'live', 'complete')
  )
);

create table if not exists public.top_dog_content_clips (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  season_id bigint not null references public.top_dog_seasons (id) on delete cascade,
  round_id bigint not null references public.top_dog_rounds (id) on delete cascade,
  fixture_id bigint references public.top_dog_fixtures (id) on delete set null,
  profile_id uuid references public.cgs_profiles (id) on delete set null,
  team_id bigint references public.cgs_teams (id) on delete set null,
  marked_at timestamptz not null default timezone('utc', now()),
  tag text not null default 'other',
  player_name text not null default '',
  note text not null default '',
  constraint top_dog_content_clips_tag_check check (
    tag in (
      'great_shot',
      'fail',
      'celebration',
      'bunker_boy',
      'trash_talk',
      'interview',
      'one_putt',
      'sponsor',
      'funny_moment',
      'other'
    )
  )
);

create table if not exists public.top_dog_segments (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  season_id bigint not null references public.top_dog_seasons (id) on delete cascade,
  round_id bigint not null references public.top_dog_rounds (id) on delete cascade,
  segment_type text not null,
  title text not null default '',
  primary_text text not null default '',
  secondary_text text not null default '',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  constraint top_dog_segments_type_check check (
    segment_type in ('doghouse', 'shot_of_night', 'butters_board', 'stat_of_week')
  ),
  constraint top_dog_segments_status_check check (
    status in ('draft', 'confirmed')
  ),
  unique (round_id, segment_type)
);

create table if not exists public.top_dog_checklist_templates (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  season_id bigint not null references public.top_dog_seasons (id) on delete cascade,
  name text not null default 'League Night Standard',
  is_default boolean not null default true,
  unique (season_id, name)
);

create table if not exists public.top_dog_checklist_template_items (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  template_id bigint not null references public.top_dog_checklist_templates (id) on delete cascade,
  phase text not null,
  label text not null,
  display_order integer not null default 99,
  constraint top_dog_checklist_template_items_phase_check check (
    phase in ('before', 'during', 'after')
  ),
  unique (template_id, phase, label)
);

create table if not exists public.top_dog_round_checklist_items (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  round_id bigint not null references public.top_dog_rounds (id) on delete cascade,
  template_item_id bigint references public.top_dog_checklist_template_items (id) on delete set null,
  phase text not null,
  label text not null,
  display_order integer not null default 99,
  is_complete boolean not null default false,
  completed_at timestamptz,
  constraint top_dog_round_checklist_items_phase_check check (
    phase in ('before', 'during', 'after')
  ),
  unique (round_id, phase, label)
);

create table if not exists public.top_dog_night_recaps (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  season_id bigint not null references public.top_dog_seasons (id) on delete cascade,
  round_id bigint not null unique references public.top_dog_rounds (id) on delete cascade,
  recap_text text not null default '',
  payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.top_dog_operations_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  season_id bigint not null references public.top_dog_seasons (id) on delete cascade,
  round_id bigint references public.top_dog_rounds (id) on delete set null,
  action text not null,
  entity_type text not null default '',
  entity_id text not null default '',
  details jsonb not null default '{}'::jsonb,
  operator_label text not null default 'Butters'
);

create index if not exists cgs_sponsors_active_idx
  on public.cgs_sponsors (is_active, name);

create index if not exists top_dog_prizes_round_idx
  on public.top_dog_prizes (round_id, category, winner_status);

create index if not exists top_dog_jackpot_attempts_round_idx
  on public.top_dog_jackpot_attempts (round_id, attempted_at desc);

create index if not exists top_dog_sponsor_activations_round_idx
  on public.top_dog_sponsor_activations (round_id, sponsor_id);

create index if not exists top_dog_interviews_round_idx
  on public.top_dog_interviews (round_id, status, created_at desc);

create index if not exists top_dog_content_clips_round_idx
  on public.top_dog_content_clips (round_id, marked_at desc);

create index if not exists top_dog_segments_round_idx
  on public.top_dog_segments (round_id, segment_type);

create index if not exists top_dog_round_checklist_items_round_idx
  on public.top_dog_round_checklist_items (round_id, phase, display_order);

create index if not exists top_dog_operations_log_round_idx
  on public.top_dog_operations_log (round_id, created_at desc);

alter table public.cgs_sponsors enable row level security;
alter table public.top_dog_prizes enable row level security;
alter table public.top_dog_jackpots enable row level security;
alter table public.top_dog_jackpot_attempts enable row level security;
alter table public.top_dog_sponsor_activations enable row level security;
alter table public.top_dog_interviews enable row level security;
alter table public.top_dog_content_clips enable row level security;
alter table public.top_dog_segments enable row level security;
alter table public.top_dog_checklist_templates enable row level security;
alter table public.top_dog_checklist_template_items enable row level security;
alter table public.top_dog_round_checklist_items enable row level security;
alter table public.top_dog_night_recaps enable row level security;
alter table public.top_dog_operations_log enable row level security;

revoke all on public.cgs_sponsors from anon, authenticated;
revoke all on public.top_dog_prizes from anon, authenticated;
revoke all on public.top_dog_jackpots from anon, authenticated;
revoke all on public.top_dog_jackpot_attempts from anon, authenticated;
revoke all on public.top_dog_sponsor_activations from anon, authenticated;
revoke all on public.top_dog_interviews from anon, authenticated;
revoke all on public.top_dog_content_clips from anon, authenticated;
revoke all on public.top_dog_segments from anon, authenticated;
revoke all on public.top_dog_checklist_templates from anon, authenticated;
revoke all on public.top_dog_checklist_template_items from anon, authenticated;
revoke all on public.top_dog_round_checklist_items from anon, authenticated;
revoke all on public.top_dog_night_recaps from anon, authenticated;
revoke all on public.top_dog_operations_log from anon, authenticated;

grant all on public.cgs_sponsors to service_role;
grant all on public.top_dog_prizes to service_role;
grant all on public.top_dog_jackpots to service_role;
grant all on public.top_dog_jackpot_attempts to service_role;
grant all on public.top_dog_sponsor_activations to service_role;
grant all on public.top_dog_interviews to service_role;
grant all on public.top_dog_content_clips to service_role;
grant all on public.top_dog_segments to service_role;
grant all on public.top_dog_checklist_templates to service_role;
grant all on public.top_dog_checklist_template_items to service_role;
grant all on public.top_dog_round_checklist_items to service_role;
grant all on public.top_dog_night_recaps to service_role;
grant all on public.top_dog_operations_log to service_role;

grant usage, select on all sequences in schema public to service_role;

insert into public.top_dog_checklist_templates (season_id, name, is_default, updated_at)
select seasons.id, 'League Night Standard', true, timezone('utc', now())
from public.top_dog_seasons seasons
on conflict (season_id, name) do update
set is_default = true, updated_at = timezone('utc', now());

insert into public.top_dog_checklist_template_items (
  template_id,
  phase,
  label,
  display_order
)
select
  templates.id,
  source.phase,
  source.label,
  source.display_order
from public.top_dog_checklist_templates templates
cross join (
  values
    ('before', 'Confirm fixtures', 10),
    ('before', 'Confirm bays', 20),
    ('before', 'Confirm players', 30),
    ('before', 'Confirm substitutes', 40),
    ('before', 'Update ladder', 50),
    ('before', 'Test stream graphics', 60),
    ('before', 'Photograph prizes', 70),
    ('before', 'Confirm sponsors', 80),
    ('during', 'Match of Night selected', 10),
    ('during', 'Sponsor mentions', 20),
    ('during', 'Record Longest Drive', 30),
    ('during', 'Record CTP', 40),
    ('during', 'Record Bunker Boy', 50),
    ('during', 'Mark content clips', 60),
    ('during', 'Run One-Putt Challenge', 70),
    ('after', 'Finalise results', 10),
    ('after', 'Update ladder', 20),
    ('after', 'Winner photos', 30),
    ('after', 'Sponsor photos', 40),
    ('after', 'Save clip timestamps', 50),
    ('after', 'Prepare results post', 60),
    ('after', 'Prepare next fixtures', 70)
) as source(phase, label, display_order)
where templates.is_default = true
on conflict (template_id, phase, label) do update
set display_order = excluded.display_order;

insert into public.top_dog_jackpots (
  season_id,
  default_amount,
  current_amount,
  status,
  updated_at
)
select seasons.id, 100, 100, 'idle', timezone('utc', now())
from public.top_dog_seasons seasons
on conflict (season_id) do nothing;
