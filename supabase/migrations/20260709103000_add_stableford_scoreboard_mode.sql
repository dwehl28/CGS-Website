alter table public.competition_scoreboards
  drop constraint if exists competition_scoreboards_leaderboard_mode_check;

alter table public.competition_scoreboards
  add constraint competition_scoreboards_leaderboard_mode_check
  check (leaderboard_mode in ('gross', 'net', 'points'));

insert into public.competition_scoreboards (
  slug,
  title,
  summary,
  status_label,
  leaderboard_mode,
  location,
  format_label,
  round_label,
  cta_label,
  cta_href,
  starts_at,
  is_live,
  is_published,
  updated_at
)
values (
  'cgs-individual-stableford-mid-august',
  'CGS Individual Stableford',
  'Individual Stableford competition shell for the next CGS sim event, starting mid-August 2026. Exact date, course, tee set, and field are still TBC.',
  'Starting mid-August 2026',
  'points',
  'Course TBC',
  'Individual Stableford',
  'Next competition',
  'Open player app',
  '/play',
  null,
  false,
  true,
  timezone('utc', now())
)
on conflict (slug) do update
set
  title = excluded.title,
  summary = excluded.summary,
  status_label = excluded.status_label,
  leaderboard_mode = excluded.leaderboard_mode,
  location = excluded.location,
  format_label = excluded.format_label,
  round_label = excluded.round_label,
  cta_label = excluded.cta_label,
  cta_href = excluded.cta_href,
  starts_at = excluded.starts_at,
  is_live = false,
  is_published = true,
  updated_at = timezone('utc', now());
