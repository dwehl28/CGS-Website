-- Profile management frequently finds a player's active roster assignment.
-- Index the foreign key lookup so this remains fast as the directory grows.
create index if not exists cgs_team_members_profile_active_idx
  on public.cgs_team_members (profile_id, is_active);
