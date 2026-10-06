alter table public.competition_scoreboards
  add column if not exists longest_drive_leader text,
  add column if not exists bunker_boi_leader text;
