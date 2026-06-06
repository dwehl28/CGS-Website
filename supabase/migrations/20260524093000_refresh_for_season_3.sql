update public.clubhouse_updates
set
  is_pinned = false,
  is_published = false,
  updated_at = timezone('utc', now())
where title in (
  'Season 2 is now underway',
  'The CGS Major stays locked for 2 May',
  'Birdie Hunters open as reigning champions'
);

insert into public.clubhouse_updates (
  title,
  summary,
  status_label,
  cta_label,
  cta_href,
  starts_at,
  is_pinned,
  is_published,
  updated_at
)
select
  'Season 3 starts Monday night',
  'Season 3 starts Monday 25 May at 7pm AEST with seven CGS teams, new faces, new team combinations, and the Ambrose format back in play.',
  'Season 3 launch',
  'View Season 3',
  '/events/season-3',
  '2026-05-25T19:00:00+10:00',
  true,
  true,
  timezone('utc', now())
where not exists (
  select 1 from public.clubhouse_updates where title = 'Season 3 starts Monday night'
);

insert into public.clubhouse_updates (
  title,
  summary,
  status_label,
  cta_label,
  cta_href,
  starts_at,
  is_pinned,
  is_published,
  updated_at
)
select
  'Season 2 Results are now posted',
  'Season 2 is complete. The A Grade Grand Final, B Grade Finals, and first CGS Major results are now collected in the results archive.',
  'Season 2 results',
  'Open archive',
  '/events/season-2',
  '2026-05-24T08:55:00+10:00',
  false,
  true,
  timezone('utc', now())
where not exists (
  select 1 from public.clubhouse_updates where title = 'Season 2 Results are now posted'
);

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
  'season-3-ambrose',
  'Season 3 Ambrose',
  'The Season 3 scoreboard shell is ready for seven CGS teams as the Ambrose competition starts Monday 25 May at 7pm AEST.',
  'Season 3',
  'gross',
  'Tee Lounge',
  'Team Ambrose',
  'Round 1',
  'View Season 3',
  '/events/season-3',
  '2026-05-25T19:00:00+10:00',
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
  is_published = true,
  updated_at = timezone('utc', now());
