alter table public.competition_score_entries
  add column if not exists photo_url text not null default '';
