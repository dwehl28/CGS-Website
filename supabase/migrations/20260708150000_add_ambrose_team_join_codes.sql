alter table public.cgs_ambrose_teams
  add column if not exists created_by uuid references public.cgs_profiles (id) on delete set null,
  add column if not exists join_code_hash text not null default '';

create index if not exists cgs_ambrose_teams_created_by_idx
  on public.cgs_ambrose_teams (created_by);
