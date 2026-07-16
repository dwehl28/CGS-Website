alter table public.cgs_ambrose_entries
  add column if not exists drive_distance_meters numeric(6, 1),
  add column if not exists iron_club text not null default '',
  add column if not exists iron_distance_meters numeric(6, 1);

alter table public.cgs_ambrose_entries
  add constraint cgs_ambrose_entries_drive_distance_check
  check (drive_distance_meters is null or drive_distance_meters between 0 and 500)
  not valid;

alter table public.cgs_ambrose_entries
  add constraint cgs_ambrose_entries_iron_distance_check
  check (iron_distance_meters is null or iron_distance_meters between 0 and 300)
  not valid;
