alter table public.cgs_ambrose_holes
  add column if not exists yardage_yards integer,
  add column if not exists stroke_index integer;

insert into public.cgs_ambrose_events (
  slug,
  title,
  summary,
  season_label,
  course_name,
  status_label,
  bay_count,
  hole_count,
  starts_at,
  is_live,
  is_published,
  scoring_notes,
  updated_at
)
values (
  'cgs-round-8-st-enodoc-back-12',
  'Round 8 - St Enodoc Back 12',
  'CGS Round 8 configured for the St Enodoc Church Course back 12 holes from the blue tees.',
  'CGS Round 8',
  'St Enodoc Church Course - Blue Tees',
  'Back 12 Ambrose',
  3,
  12,
  null,
  true,
  true,
  'Team Ambrose over holes 7-18 at St Enodoc Church Course from the blue tees. Either allocated team member can submit the shared team score.',
  timezone('utc', now())
)
on conflict (slug) do update
set
  title = excluded.title,
  summary = excluded.summary,
  season_label = excluded.season_label,
  course_name = excluded.course_name,
  status_label = excluded.status_label,
  bay_count = excluded.bay_count,
  hole_count = excluded.hole_count,
  starts_at = excluded.starts_at,
  is_live = excluded.is_live,
  is_published = excluded.is_published,
  scoring_notes = excluded.scoring_notes,
  updated_at = timezone('utc', now());

with round_8_event as (
  select id from public.cgs_ambrose_events where slug = 'cgs-round-8-st-enodoc-back-12'
),
seed_holes(display_order, hole_number, hole_label, par, yardage_yards, stroke_index) as (
  values
    (1, 7, 'Hole 7', 4, 395, 4),
    (2, 8, 'Hole 8', 3, 165, 16),
    (3, 9, 'Hole 9', 4, 393, 10),
    (4, 10, 'Hole 10', 4, 457, 1),
    (5, 11, 'Hole 11', 3, 232, 13),
    (6, 12, 'Hole 12', 4, 396, 7),
    (7, 13, 'Hole 13', 4, 395, 3),
    (8, 14, 'Hole 14', 4, 382, 15),
    (9, 15, 'Hole 15', 3, 168, 18),
    (10, 16, 'Hole 16', 5, 560, 9),
    (11, 17, 'Hole 17', 3, 206, 12),
    (12, 18, 'Hole 18', 4, 469, 6)
)
insert into public.cgs_ambrose_holes (
  event_id,
  display_order,
  hole_number,
  hole_label,
  par,
  yardage_yards,
  stroke_index,
  updated_at
)
select
  round_8_event.id,
  seed_holes.display_order,
  seed_holes.hole_number,
  seed_holes.hole_label,
  seed_holes.par,
  seed_holes.yardage_yards,
  seed_holes.stroke_index,
  timezone('utc', now())
from round_8_event, seed_holes
on conflict (event_id, hole_number) do update
set
  display_order = excluded.display_order,
  hole_label = excluded.hole_label,
  par = excluded.par,
  yardage_yards = excluded.yardage_yards,
  stroke_index = excluded.stroke_index,
  updated_at = timezone('utc', now());
