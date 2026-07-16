do $$
declare
  demo_profile_ids uuid[];
  demo_team_ids bigint[];
begin
  select coalesce(array_agg(id), array[]::bigint[])
  into demo_team_ids
  from public.cgs_ambrose_teams
  where lower(trim(name)) in ('test team', 'demo team')
    or lower(trim(short_name)) in ('test', 'demo');

  select coalesce(array_agg(id), array[]::uuid[])
  into demo_profile_ids
  from public.cgs_profiles
  where lower(trim(handle)) in ('bob', 'kevin', 'bob-test', 'kevin-test')
    or lower(trim(display_name)) in ('bob', 'kevin')
    or lower(trim(nickname)) in ('bob', 'kevin')
    or lower(trim(email)) in (
      'bob@example.com',
      'kevin@example.com',
      'bob@crossodoggolf.com',
      'kevin@crossodoggolf.com'
    );

  delete from public.cgs_ambrose_entries
  where team_id = any(demo_team_ids);

  update public.cgs_ambrose_entries
  set
    submitted_by = case when submitted_by = any(demo_profile_ids) then null else submitted_by end,
    drive_player_id = case when drive_player_id = any(demo_profile_ids) then null else drive_player_id end,
    approach_player_id = case when approach_player_id = any(demo_profile_ids) then null else approach_player_id end,
    putt_player_id = case when putt_player_id = any(demo_profile_ids) then null else putt_player_id end,
    updated_at = timezone('utc', now())
  where submitted_by = any(demo_profile_ids)
    or drive_player_id = any(demo_profile_ids)
    or approach_player_id = any(demo_profile_ids)
    or putt_player_id = any(demo_profile_ids);

  delete from public.cgs_ambrose_team_members
  where team_id = any(demo_team_ids)
    or profile_id = any(demo_profile_ids);

  update public.cgs_ambrose_teams
  set
    created_by = null,
    join_code_hash = '',
    updated_at = timezone('utc', now())
  where created_by = any(demo_profile_ids);

  delete from public.cgs_ambrose_teams
  where id = any(demo_team_ids);

  delete from public.cgs_profiles
  where id = any(demo_profile_ids);
end $$;
