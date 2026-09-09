alter table public.cgs_par3_events
  alter column max_players set default 20,
  alter column pool_count set default 5;

update public.cgs_par3_events
set
  title = 'CGS Par 3 Championship',
  summary = 'A 20-player match-play championship with five pools, a closest-to-pin playoff, and a single-elimination Round of 16.',
  starts_at = '2026-09-12T08:00:00Z',
  warmup_at = '2026-09-12T07:30:00Z',
  status_label = 'Pool draw locked',
  public_message = 'The draw is locked. Follow fixtures, tables, results, the CTP playoff, and every finals matchup live.',
  current_phase = 'pools',
  max_players = 20,
  pool_count = 5,
  pool_size = 4,
  registrations_open = false,
  is_published = true,
  is_live = false,
  knockout_data = null,
  knockout_generated_at = null,
  updated_at = timezone('utc', now())
where slug = 'par-3-showdown-2026';

with event as (
  select id
  from public.cgs_par3_events
  where slug = 'par-3-showdown-2026'
)
update public.cgs_par3_players players
set
  pool_number = null,
  ctp_rank = null,
  is_withdrawn = true,
  updated_at = timezone('utc', now())
from event
where players.event_id = event.id
  and lower(players.name) not in (
    'wade', 'dan', 'blake', 'ryobi',
    'jayden', 'crossdog', 'wombat', 'ben d',
    'jarrad', 'ricky', 'butters', 'penguin',
    'macka', 'harry', 'caity', 'chipper',
    'hitman', 'dylan', 'ben w', 'mystery player'
  );

with event as (
  select id
  from public.cgs_par3_events
  where slug = 'par-3-showdown-2026'
),
seed_players(display_order, name, pool_number) as (
  values
    (1, 'Wade', 1), (2, 'Dan', 1), (3, 'Blake', 1), (4, 'Ryobi', 1),
    (5, 'Jayden', 2), (6, 'Crossdog', 2), (7, 'Wombat', 2), (8, 'Ben D', 2),
    (9, 'Jarrad', 3), (10, 'Ricky', 3), (11, 'Butters', 3), (12, 'Penguin', 3),
    (13, 'Macka', 4), (14, 'Harry', 4), (15, 'Caity', 4), (16, 'Chipper', 4),
    (17, 'Hitman', 5), (18, 'Dylan', 5), (19, 'Ben W', 5), (20, 'Mystery Player', 5)
)
insert into public.cgs_par3_players (
  event_id,
  display_order,
  name,
  tee_category,
  pool_number,
  pool_rank_override,
  ctp_rank,
  is_withdrawn,
  updated_at
)
select
  event.id,
  seed_players.display_order,
  seed_players.name,
  'championship',
  seed_players.pool_number,
  null,
  null,
  false,
  timezone('utc', now())
from event, seed_players
where not exists (
  select 1
  from public.cgs_par3_players existing
  where existing.event_id = event.id
    and lower(existing.name) = lower(seed_players.name)
);

with event as (
  select id
  from public.cgs_par3_events
  where slug = 'par-3-showdown-2026'
),
seed_players(display_order, name, pool_number) as (
  values
    (1, 'Wade', 1), (2, 'Dan', 1), (3, 'Blake', 1), (4, 'Ryobi', 1),
    (5, 'Jayden', 2), (6, 'Crossdog', 2), (7, 'Wombat', 2), (8, 'Ben D', 2),
    (9, 'Jarrad', 3), (10, 'Ricky', 3), (11, 'Butters', 3), (12, 'Penguin', 3),
    (13, 'Macka', 4), (14, 'Harry', 4), (15, 'Caity', 4), (16, 'Chipper', 4),
    (17, 'Hitman', 5), (18, 'Dylan', 5), (19, 'Ben W', 5), (20, 'Mystery Player', 5)
)
update public.cgs_par3_players players
set
  display_order = seed_players.display_order,
  pool_number = seed_players.pool_number,
  pool_rank_override = null,
  ctp_rank = null,
  is_withdrawn = false,
  updated_at = timezone('utc', now())
from event, seed_players
where players.event_id = event.id
  and lower(players.name) = lower(seed_players.name);

delete from public.cgs_par3_pool_matches matches
using public.cgs_par3_events events
where matches.event_id = events.id
  and events.slug = 'par-3-showdown-2026';

with event as (
  select id
  from public.cgs_par3_events
  where slug = 'par-3-showdown-2026'
),
ranked_players as (
  select
    players.id,
    players.pool_number,
    row_number() over (
      partition by players.pool_number
      order by players.display_order, players.id
    ) as seed_number
  from public.cgs_par3_players players
  join event on event.id = players.event_id
  where players.pool_number between 1 and 5
    and players.is_withdrawn = false
),
pairings(match_number, first_seed, second_seed) as (
  values
    (1, 1, 4),
    (2, 2, 3),
    (3, 1, 3),
    (4, 4, 2),
    (5, 1, 2),
    (6, 3, 4)
)
insert into public.cgs_par3_pool_matches (
  event_id,
  pool_number,
  match_number,
  player1_id,
  player2_id,
  winner_id,
  status,
  bay_number,
  updated_at
)
select
  event.id,
  first_player.pool_number,
  pairings.match_number,
  least(first_player.id, second_player.id),
  greatest(first_player.id, second_player.id),
  null,
  'scheduled',
  null,
  timezone('utc', now())
from event
cross join pairings
join ranked_players first_player
  on first_player.seed_number = pairings.first_seed
join ranked_players second_player
  on second_player.pool_number = first_player.pool_number
  and second_player.seed_number = pairings.second_seed
where first_player.pool_number between 1 and 5;
