alter table public.cgs_par3_events
  alter column max_players set default 32,
  alter column pool_count set default 8;

update public.cgs_par3_events
set
  title = 'CGS Par 3 Championship',
  summary = 'A 32-player, three-hole match-play championship with eight pools and a single-elimination Round of 16.',
  max_players = 32,
  pool_count = 8,
  current_phase = case when current_phase = 'ctp' then 'pools' else current_phase end,
  updated_at = timezone('utc', now())
where slug = 'par-3-showdown-2026';
