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
values
  (
    'cgs-team-semi-final-royal-troon-back-12',
    'CGS Team Semi Final - Royal Troon Back 12',
    'CGS team semi final configured for the Royal Troon Old Course back 12 holes from the yellow tees.',
    'CGS Team Finals',
    'Royal Troon Old Course - Yellow Tees',
    'Semi final',
    3,
    12,
    null,
    false,
    true,
    'Team Ambrose over holes 7-18 at Royal Troon Old Course from the yellow tees. Either allocated team member can submit the shared team score.',
    timezone('utc', now())
  ),
  (
    'cgs-team-grand-final-royal-portrush-full-18',
    'CGS Team Grand Final - Royal Portrush',
    'CGS team grand final configured for the Royal Portrush Dunluce Links full 18 holes from the green/white tees.',
    'CGS Team Finals',
    'Royal Portrush Dunluce Links - Green/White Tees',
    'Grand final',
    3,
    18,
    null,
    false,
    true,
    'Team Ambrose over the full 18 at Royal Portrush Dunluce Links from the green/white tee setup. Either allocated team member can submit the shared team score.',
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

with semi_final_event as (
  select id
  from public.cgs_ambrose_events
  where slug = 'cgs-team-semi-final-royal-troon-back-12'
),
seed_holes(display_order, hole_number, hole_label, par, yardage_yards, stroke_index) as (
  values
    (1, 7, 'Hole 7 - Tel-el-Kebir', 4, 371, 9),
    (2, 8, 'Hole 8 - Postage Stamp', 3, 114, 18),
    (3, 9, 'Hole 9 - The Monk', 4, 375, 5),
    (4, 10, 'Hole 10 - Sandhills', 4, 367, 10),
    (5, 11, 'Hole 11 - The Railway', 4, 375, 1),
    (6, 12, 'Hole 12 - The Fox', 4, 377, 6),
    (7, 13, 'Hole 13 - Burmah', 4, 382, 12),
    (8, 14, 'Hole 14 - Alton', 3, 167, 15),
    (9, 15, 'Hole 15 - Crosbie', 4, 402, 3),
    (10, 16, 'Hole 16 - Well', 5, 504, 8),
    (11, 17, 'Hole 17 - Rabbit', 3, 167, 13),
    (12, 18, 'Hole 18 - Craigend', 4, 344, 17)
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
  semi_final_event.id,
  seed_holes.display_order,
  seed_holes.hole_number,
  seed_holes.hole_label,
  seed_holes.par,
  seed_holes.yardage_yards,
  seed_holes.stroke_index,
  timezone('utc', now())
from semi_final_event, seed_holes
on conflict (event_id, hole_number) do update
set
  display_order = excluded.display_order,
  hole_label = excluded.hole_label,
  par = excluded.par,
  yardage_yards = excluded.yardage_yards,
  stroke_index = excluded.stroke_index,
  updated_at = timezone('utc', now());

with grand_final_event as (
  select id
  from public.cgs_ambrose_events
  where slug = 'cgs-team-grand-final-royal-portrush-full-18'
),
seed_holes(display_order, hole_number, hole_label, par, yardage_yards, stroke_index) as (
  values
    (1, 1, 'Hole 1 - Hughies', 4, 371, 7),
    (2, 2, 'Hole 2 - Giant''s Grave', 5, 520, 13),
    (3, 3, 'Hole 3 - Islay', 3, 140, 17),
    (4, 4, 'Hole 4 - Fred Daly''s', 4, 442, 1),
    (5, 5, 'Hole 5 - White Rocks', 4, 369, 15),
    (6, 6, 'Hole 6 - Harry Colt''s', 3, 177, 11),
    (7, 7, 'Hole 7 - Curran Point', 5, 538, 5),
    (8, 8, 'Hole 8 - Dunluce', 4, 376, 9),
    (9, 9, 'Hole 9 - Tavern', 4, 415, 3),
    (10, 10, 'Hole 10 - Himalayas', 4, 358, 16),
    (11, 11, 'Hole 11 - P.G. Stevenson''s', 5, 456, 8),
    (12, 12, 'Hole 12 - Dhu Varren', 5, 475, 12),
    (13, 13, 'Hole 13 - Feather Bed', 3, 160, 18),
    (14, 14, 'Hole 14 - Causeway', 4, 367, 2),
    (15, 15, 'Hole 15 - Skerries', 4, 358, 10),
    (16, 16, 'Hole 16 - Calamity Corner', 3, 195, 4),
    (17, 17, 'Hole 17 - Purgatory', 4, 355, 14),
    (18, 18, 'Hole 18 - Babington''s', 4, 404, 6)
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
  grand_final_event.id,
  seed_holes.display_order,
  seed_holes.hole_number,
  seed_holes.hole_label,
  seed_holes.par,
  seed_holes.yardage_yards,
  seed_holes.stroke_index,
  timezone('utc', now())
from grand_final_event, seed_holes
on conflict (event_id, hole_number) do update
set
  display_order = excluded.display_order,
  hole_label = excluded.hole_label,
  par = excluded.par,
  yardage_yards = excluded.yardage_yards,
  stroke_index = excluded.stroke_index,
  updated_at = timezone('utc', now());
