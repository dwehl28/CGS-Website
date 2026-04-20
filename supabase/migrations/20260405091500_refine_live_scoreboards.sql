alter table public.competition_scoreboards
  add column if not exists leaderboard_mode text not null default 'gross';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competition_scoreboards_leaderboard_mode_check'
  ) then
    alter table public.competition_scoreboards
      add constraint competition_scoreboards_leaderboard_mode_check
      check (leaderboard_mode in ('gross', 'net'));
  end if;
end
$$;

alter table public.competition_score_entries
  add column if not exists gross_score numeric(10, 2);

alter table public.competition_score_entries
  add column if not exists handicap_strokes numeric(10, 2) not null default 0;

alter table public.competition_score_entries
  add column if not exists is_cgs_member boolean not null default false;

update public.competition_score_entries
set gross_score = score_sort
where gross_score is null;

create index if not exists competition_score_entries_live_ranking_idx
  on public.competition_score_entries (competition_id, gross_score asc, handicap_strokes asc, updated_at desc);
