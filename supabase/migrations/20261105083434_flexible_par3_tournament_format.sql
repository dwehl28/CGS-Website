-- Prepared locally; apply this migration before publishing flexible organiser controls.
-- Existing formats and results retain their values. New RPCs are server-only.
alter table public.cgs_par3_events
  add column if not exists pool_sizes jsonb,
  add column if not exists finals_size integer not null default 16;

create or replace function public.cgs_par3_valid_pool_sizes(p_sizes jsonb, p_count integer, p_size integer, p_max integer)
returns boolean language plpgsql immutable security invoker set search_path = public, pg_temp as $$
declare v integer; total integer := 0; item jsonb;
begin
  if p_sizes is null then return true; end if;
  if jsonb_typeof(p_sizes) <> 'array' or jsonb_array_length(p_sizes) <> p_count then return false; end if;
  for item in select value from jsonb_array_elements(p_sizes) loop
    if jsonb_typeof(item) <> 'number' or item::text !~ '^[0-9]+$' then return false; end if;
    v := item::text::integer;
    if v < 2 or v > 8 then return false; end if;
    total := total + v;
  end loop;
  return total between 2 and 64 and total = p_max and p_size = (select max(value::text::integer) from jsonb_array_elements(p_sizes));
exception when others then return false;
end $$;

alter table public.cgs_par3_events
  add constraint cgs_par3_events_pool_sizes_check check(public.cgs_par3_valid_pool_sizes(pool_sizes,pool_count,pool_size,max_players)),
  add constraint cgs_par3_events_finals_size_check check(finals_size in (2,4,8,16,32,64) and (pool_sizes is null or finals_size<=max_players));
alter table public.cgs_par3_players
  drop constraint if exists cgs_par3_players_pool_number_check,
  drop constraint if exists cgs_par3_players_pool_rank_override_check,
  drop constraint if exists cgs_par3_players_ctp_rank_check;
alter table public.cgs_par3_players
  add constraint cgs_par3_players_pool_number_check check(pool_number is null or pool_number between 1 and 16),
  add constraint cgs_par3_players_pool_rank_override_check check(pool_rank_override is null or pool_rank_override between 1 and 8),
  add constraint cgs_par3_players_ctp_rank_check check(ctp_rank is null or ctp_rank between 1 and 64);
alter table public.cgs_par3_pool_matches drop constraint if exists cgs_par3_pool_matches_pool_number_check;
alter table public.cgs_par3_pool_matches
  add constraint cgs_par3_pool_matches_pool_number_check check(pool_number between 1 and 16),
  add constraint cgs_par3_pool_matches_match_number_check check(match_number between 1 and 28) not valid;

-- Serialize player changes with format/draw changes, and enforce capacity even for
-- simultaneous signups. This trigger does not change any existing tournament rows.
create or replace function public.cgs_par3_guard_player_format()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
declare e public.cgs_par3_events%rowtype; capacity integer; allocation_changed boolean; old_pool integer;
begin
  select * into e from public.cgs_par3_events where id=case when tg_op='DELETE' then old.event_id else new.event_id end for update;
  if not found then return case when tg_op='DELETE' then old else new end; end if;
  if tg_op='UPDATE' and new.event_id <> old.event_id then raise exception 'A player cannot be moved between events.'; end if;
  allocation_changed := tg_op in ('INSERT','DELETE');
  if tg_op='UPDATE' then allocation_changed := new.pool_number is distinct from old.pool_number or new.is_withdrawn is distinct from old.is_withdrawn; end if;
  if tg_op <> 'INSERT' then old_pool := old.pool_number; end if;
  if e.knockout_data is not null and (allocation_changed or (tg_op='UPDATE' and (new.pool_rank_override is distinct from old.pool_rank_override or new.ctp_rank is distinct from old.ctp_rank or new.display_order is distinct from old.display_order))) then
    raise exception 'Pool allocations and qualifiers cannot change after finals are generated.';
  end if;
  if allocation_changed and exists(select 1 from public.cgs_par3_pool_matches m where m.event_id=e.id and (m.pool_number=old_pool or (tg_op<>'DELETE' and m.pool_number=new.pool_number)) and (m.status<>'scheduled' or m.winner_id is not null)) then
    raise exception 'Pool allocations cannot change after a match starts or results are recorded.';
  end if;
  if tg_op <> 'DELETE' then
    if new.pool_number is not null and (new.pool_number < 1 or new.pool_number > e.pool_count) then raise exception 'Choose an active tournament pool.'; end if;
    capacity := case when new.pool_number is null then 8 else coalesce((e.pool_sizes->>(new.pool_number-1))::integer,e.pool_size) end;
    if new.pool_rank_override is not null and new.pool_rank_override > capacity then raise exception 'Manual rank exceeds the pool capacity.'; end if;
    if not new.is_withdrawn then
      if (select count(*) from public.cgs_par3_players p where p.event_id=e.id and not p.is_withdrawn and p.id<>new.id) >= e.max_players then raise exception 'The tournament field is full.'; end if;
      if new.pool_number is not null and (select count(*) from public.cgs_par3_players p where p.event_id=e.id and not p.is_withdrawn and p.pool_number=new.pool_number and p.id<>new.id) >= capacity then raise exception 'This pool is already at capacity.'; end if;
    end if;
  end if;
  update public.cgs_par3_events set updated_at=clock_timestamp() where id=e.id;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger cgs_par3_guard_player_format before insert or update or delete on public.cgs_par3_players for each row execute function public.cgs_par3_guard_player_format();

create or replace function public.cgs_par3_guard_match_format()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
declare e public.cgs_par3_events%rowtype;
begin
  select * into e from public.cgs_par3_events where id=case when tg_op='DELETE' then old.event_id else new.event_id end for update;
  if not found then return case when tg_op='DELETE' then old else new end; end if;
  if e.knockout_data is not null then raise exception 'Pool fixtures and results are locked after finals are generated.'; end if;
  if tg_op='DELETE' and (old.status<>'scheduled' or old.winner_id is not null) then raise exception 'Live matches and recorded results cannot be deleted.'; end if;
  if tg_op<>'DELETE' then
    if new.pool_number > e.pool_count then raise exception 'Choose an active tournament pool.'; end if;
    if not exists(select 1 from public.cgs_par3_players p where p.id=new.player1_id and p.event_id=e.id and p.pool_number=new.pool_number and not p.is_withdrawn)
       or not exists(select 1 from public.cgs_par3_players p where p.id=new.player2_id and p.event_id=e.id and p.pool_number=new.pool_number and not p.is_withdrawn) then
      raise exception 'Both match players must be active in this tournament pool.';
    end if;
  end if;
  update public.cgs_par3_events set updated_at=clock_timestamp() where id=e.id;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger cgs_par3_guard_match_format before insert or update or delete on public.cgs_par3_pool_matches for each row execute function public.cgs_par3_guard_match_format();

create or replace function public.cgs_par3_update_format(p_event_id bigint,p_pool_sizes jsonb,p_finals_size integer)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare e public.cgs_par3_events%rowtype; pool_count_new integer; capacity integer; total integer; sizes_old jsonb; active_count integer;
begin
  select * into e from public.cgs_par3_events where id=p_event_id for update;
  if not found then raise exception 'Par 3 event not found.'; end if;
  if p_pool_sizes is null or jsonb_typeof(p_pool_sizes)<>'array' then raise exception 'Enter the pool capacities.'; end if;
  pool_count_new := jsonb_array_length(p_pool_sizes);
  if pool_count_new not between 1 and 16 then raise exception 'Choose between 1 and 16 pools.'; end if;
  if exists(select 1 from jsonb_array_elements(p_pool_sizes) x where jsonb_typeof(x)<>'number' or x::text !~ '^[2-8]$') then raise exception 'Every pool needs an integer capacity from 2 to 8.'; end if;
  select sum(value::text::integer),max(value::text::integer) into total,capacity from jsonb_array_elements(p_pool_sizes);
  if total>64 or p_finals_size not in(2,4,8,16,32,64) or p_finals_size>total or p_finals_size is null then raise exception 'Choose a power-of-two finals field that fits within the tournament capacity.'; end if;
  select coalesce(e.pool_sizes,jsonb_agg(e.pool_size)) into sizes_old from generate_series(1,e.pool_count);
  if p_pool_sizes=sizes_old and p_finals_size=e.finals_size then return; end if;
  if e.knockout_data is not null then raise exception 'The format cannot change after finals are generated.'; end if;
  if exists(select 1 from public.cgs_par3_pool_matches where event_id=e.id and (status<>'scheduled' or winner_id is not null)) then raise exception 'The format cannot change after a match starts or results are recorded.'; end if;
  if exists(select 1 from public.cgs_par3_players where event_id=e.id and ctp_rank is not null) then raise exception 'Clear CTP qualifiers before changing the format.'; end if;
  select count(*) into active_count from public.cgs_par3_players where event_id=e.id and not is_withdrawn;
  if active_count>total then raise exception 'The new capacity is smaller than the registered field.'; end if;
  if exists(select 1 from public.cgs_par3_players p where p.event_id=e.id and (p.pool_number>pool_count_new or p.pool_rank_override>coalesce((p_pool_sizes->>(p.pool_number-1))::integer,8))) then raise exception 'Move players and adjust manual seeds before removing or shrinking a pool.'; end if;
  if exists(select 1 from public.cgs_par3_players p where p.event_id=e.id and not p.is_withdrawn and p.pool_number is not null group by p.pool_number having count(*)>(p_pool_sizes->>(p.pool_number-1))::integer) then raise exception 'An assigned pool has more players than its new capacity.'; end if;
  delete from public.cgs_par3_pool_matches where event_id=e.id and pool_number>pool_count_new;
  update public.cgs_par3_events set pool_sizes=p_pool_sizes,pool_count=pool_count_new,pool_size=capacity,max_players=total,finals_size=p_finals_size,
    summary=format('A %s-player match-play championship with %s pools and a %s-player single-elimination finals draw.',total,pool_count_new,p_finals_size),
    registrations_open=case when active_count>=total then false when e.status_label='Sold out' then true else e.registrations_open end,
    status_label=case when active_count>=total then 'Sold out' when e.status_label='Sold out' then 'Registrations open' else e.status_label end,
    updated_at=clock_timestamp() where id=e.id;
end $$;

create or replace function public.cgs_par3_allocate_pools(p_event_id bigint,p_assignments jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare e public.cgs_par3_events%rowtype; active_count integer; a record;
begin
  select * into e from public.cgs_par3_events where id=p_event_id for update;
  if not found then raise exception 'Par 3 event not found.'; end if;
  if e.knockout_data is not null or exists(select 1 from public.cgs_par3_pool_matches where event_id=e.id and (status<>'scheduled' or winner_id is not null)) then raise exception 'Pools cannot be reallocated after a match starts or finals are generated.'; end if;
  select count(*) into active_count from public.cgs_par3_players where event_id=e.id and not is_withdrawn;
  if jsonb_typeof(p_assignments)<>'array' or jsonb_array_length(p_assignments)<>active_count or active_count<e.pool_count*2 then raise exception 'Allocate every active player once, with at least two players per pool.'; end if;
  if exists(select 1 from jsonb_to_recordset(p_assignments) as x(player_id bigint,pool_number integer) left join public.cgs_par3_players p on p.id=x.player_id and p.event_id=e.id and not p.is_withdrawn where p.id is null or x.pool_number is null or x.pool_number not between 1 and e.pool_count)
     or (select count(distinct player_id) from jsonb_to_recordset(p_assignments) as x(player_id bigint))<>active_count then raise exception 'Allocation must contain each active tournament player exactly once.'; end if;
  for a in select n as pool_number,count(x.player_id) as n from generate_series(1,e.pool_count) n left join jsonb_to_recordset(p_assignments) as x(player_id bigint,pool_number integer) on x.pool_number=n group by n loop
    if a.n<2 or a.n>coalesce((e.pool_sizes->>(a.pool_number-1))::integer,e.pool_size) then raise exception 'Each allocated pool must have at least two players and fit its capacity.'; end if;
  end loop;
  delete from public.cgs_par3_pool_matches where event_id=e.id;
  update public.cgs_par3_players set ctp_rank=null,updated_at=clock_timestamp() where event_id=e.id and ctp_rank is not null;
  update public.cgs_par3_players set pool_number=null,pool_rank_override=null,ctp_rank=null,updated_at=clock_timestamp() where event_id=e.id and not is_withdrawn;
  for a in select * from jsonb_to_recordset(p_assignments) as x(player_id bigint,pool_number integer) loop
    update public.cgs_par3_players set pool_number=a.pool_number,updated_at=clock_timestamp() where id=a.player_id and event_id=e.id;
  end loop;
end $$;

create or replace function public.cgs_par3_sync_pool_fixtures(p_event_id bigint,p_fixtures jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare e public.cgs_par3_events%rowtype; pool integer; n integer; expected integer; rows_count integer; changed boolean;
begin
  select * into e from public.cgs_par3_events where id=p_event_id for update;
  if not found then raise exception 'Par 3 event not found.'; end if;
  if e.knockout_data is not null then raise exception 'Pool fixtures cannot change after finals are generated.'; end if;
  if p_fixtures is null or jsonb_typeof(p_fixtures)<>'array' then raise exception 'Supply the calculated round-robin fixtures.'; end if;
  if exists(select 1 from public.cgs_par3_players where event_id=e.id and not is_withdrawn and (pool_number is null or pool_number>e.pool_count)) then raise exception 'Assign every active player to a pool first.'; end if;
  if exists(select 1 from jsonb_to_recordset(p_fixtures) as x(pool_number integer,match_number integer,player1_id bigint,player2_id bigint) where x.pool_number is null or x.pool_number not between 1 and e.pool_count or x.match_number is null or x.match_number not between 1 and 28 or x.player1_id is null or x.player2_id is null or x.player1_id>=x.player2_id) then raise exception 'Invalid fixture data.'; end if;
  if exists(select 1 from jsonb_to_recordset(p_fixtures) as x(pool_number integer,match_number integer,player1_id bigint,player2_id bigint)
    left join public.cgs_par3_players p1 on p1.id=x.player1_id and p1.event_id=e.id and not p1.is_withdrawn and p1.pool_number=x.pool_number
    left join public.cgs_par3_players p2 on p2.id=x.player2_id and p2.event_id=e.id and not p2.is_withdrawn and p2.pool_number=x.pool_number
    where p1.id is null or p2.id is null) then raise exception 'Fixture players must be active in their assigned pool.'; end if;
  for pool in 1..e.pool_count loop
    select count(*) into n from public.cgs_par3_players where event_id=e.id and not is_withdrawn and pool_number=pool;
    if n<2 or n>coalesce((e.pool_sizes->>(pool-1))::integer,e.pool_size) then raise exception 'Every pool needs at least two players and must fit its capacity.'; end if;
    expected := n*(n-1)/2;
    select count(*) into rows_count from jsonb_to_recordset(p_fixtures) as x(pool_number integer) where x.pool_number=pool;
    if rows_count<>expected or (select count(distinct (x.player1_id,x.player2_id)) from jsonb_to_recordset(p_fixtures) as x(pool_number integer,player1_id bigint,player2_id bigint) where x.pool_number=pool)<>expected
       or (select count(distinct x.match_number) from jsonb_to_recordset(p_fixtures) as x(pool_number integer,match_number integer) where x.pool_number=pool and x.match_number between 1 and expected)<>expected then raise exception 'The draw must contain every distinct pool pairing once.'; end if;
    select exists(
      (select player1_id,player2_id from public.cgs_par3_pool_matches where event_id=e.id and pool_number=pool except select x.player1_id,x.player2_id from jsonb_to_recordset(p_fixtures) as x(pool_number integer,player1_id bigint,player2_id bigint) where x.pool_number=pool)
      union all
      (select x.player1_id,x.player2_id from jsonb_to_recordset(p_fixtures) as x(pool_number integer,player1_id bigint,player2_id bigint) where x.pool_number=pool except select player1_id,player2_id from public.cgs_par3_pool_matches where event_id=e.id and pool_number=pool)
    ) into changed;
    if changed and exists(select 1 from public.cgs_par3_pool_matches where event_id=e.id and pool_number=pool and (status<>'scheduled' or winner_id is not null)) then raise exception 'Pool % has a live match or recorded result and cannot be reshuffled.',pool; end if;
  end loop;
  -- All validation is complete before deleting any scheduled fixture. Matching
  -- pools preserve fixture IDs, running status, bay allocations and results.
  for pool in 1..e.pool_count loop
    if (select count(*) from public.cgs_par3_pool_matches where event_id=e.id and pool_number=pool)=(select count(*) from jsonb_to_recordset(p_fixtures) as x(pool_number integer) where x.pool_number=pool)
       and not exists(select 1 from public.cgs_par3_pool_matches m where m.event_id=e.id and m.pool_number=pool and not exists(select 1 from jsonb_to_recordset(p_fixtures) as x(pool_number integer,player1_id bigint,player2_id bigint) where x.pool_number=pool and x.player1_id=m.player1_id and x.player2_id=m.player2_id)) then continue; end if;
    delete from public.cgs_par3_pool_matches where event_id=e.id and pool_number=pool;
    insert into public.cgs_par3_pool_matches(event_id,pool_number,match_number,player1_id,player2_id,status)
      select e.id,x.pool_number,x.match_number,x.player1_id,x.player2_id,'scheduled' from jsonb_to_recordset(p_fixtures) as x(pool_number integer,match_number integer,player1_id bigint,player2_id bigint) where x.pool_number=pool;
  end loop;
end $$;

create or replace function public.cgs_par3_set_ctp_qualifiers(p_event_id bigint,p_player_ids jsonb,p_expected_updated_at timestamptz)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare e public.cgs_par3_events%rowtype; item record;
begin
  select * into e from public.cgs_par3_events where id=p_event_id for update;
  if not found then raise exception 'Par 3 event not found.'; end if;
  if e.knockout_data is not null then raise exception 'CTP qualifiers cannot change after finals are generated.'; end if;
  if e.updated_at is distinct from p_expected_updated_at then raise exception 'The tournament changed. Refresh before saving qualifiers.'; end if;
  if p_player_ids is null or jsonb_typeof(p_player_ids)<>'array' or jsonb_array_length(p_player_ids)>e.finals_size then raise exception 'Invalid CTP qualifier data.'; end if;
  if exists(select 1 from jsonb_array_elements(p_player_ids) x where x<>'null'::jsonb and (jsonb_typeof(x)<>'number' or x::text !~ '^[1-9][0-9]*$')) then raise exception 'Invalid CTP player.'; end if;
  if (select count(*) from jsonb_array_elements(p_player_ids) x where x<>'null'::jsonb)<>(select count(distinct x) from jsonb_array_elements(p_player_ids) x where x<>'null'::jsonb) then raise exception 'CTP qualifiers must be distinct players.'; end if;
  if exists(select 1 from jsonb_array_elements(p_player_ids) x where x<>'null'::jsonb and not exists(select 1 from public.cgs_par3_players p where p.id=x::text::bigint and p.event_id=e.id and not p.is_withdrawn)) then raise exception 'CTP qualifier is not an active tournament player.'; end if;
  update public.cgs_par3_players set ctp_rank=null,updated_at=clock_timestamp() where event_id=e.id and ctp_rank is not null;
  for item in select value,ordinality from jsonb_array_elements(p_player_ids) with ordinality where value<>'null'::jsonb loop
    update public.cgs_par3_players set ctp_rank=item.ordinality,updated_at=clock_timestamp() where event_id=e.id and id=item.value::text::bigint;
  end loop;
end $$;

create or replace function public.cgs_par3_create_finals(p_event_id bigint,p_knockout_data jsonb,p_expected_updated_at timestamptz)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare e public.cgs_par3_events%rowtype;
begin
  select * into e from public.cgs_par3_events where id=p_event_id for update;
  if not found then raise exception 'Par 3 event not found.'; end if;
  if e.knockout_data is not null then raise exception 'Finals have already been generated. Existing results have been preserved.'; end if;
  if e.updated_at is distinct from p_expected_updated_at then raise exception 'The tournament changed. Refresh before generating finals.'; end if;
  if p_knockout_data is null or jsonb_typeof(p_knockout_data)<>'object' or jsonb_array_length(coalesce(p_knockout_data->'participant','[]'))<>e.finals_size then raise exception 'The finals draw must contain the nominated number of players.'; end if;
  update public.cgs_par3_events set knockout_data=p_knockout_data,knockout_generated_at=clock_timestamp(),current_phase='knockout',status_label=case e.finals_size when 2 then 'Grand Final' when 4 then 'Semi Finals' when 8 then 'Quarter Finals' else format('Round of %s',e.finals_size) end,updated_at=clock_timestamp() where id=e.id;
end $$;

-- Preserve existing public read policies. Mutating RPCs can only be called by
-- the server's service role after the existing admin-session check.
revoke all on function public.cgs_par3_valid_pool_sizes(jsonb,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.cgs_par3_valid_pool_sizes(jsonb,integer,integer,integer) to service_role;
revoke all on function public.cgs_par3_guard_player_format() from public,anon,authenticated;
revoke all on function public.cgs_par3_guard_match_format() from public,anon,authenticated;
revoke all on function public.cgs_par3_update_format(bigint,jsonb,integer) from public,anon,authenticated;
revoke all on function public.cgs_par3_allocate_pools(bigint,jsonb) from public,anon,authenticated;
revoke all on function public.cgs_par3_sync_pool_fixtures(bigint,jsonb) from public,anon,authenticated;
revoke all on function public.cgs_par3_set_ctp_qualifiers(bigint,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.cgs_par3_create_finals(bigint,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.cgs_par3_guard_player_format(),public.cgs_par3_guard_match_format(),public.cgs_par3_update_format(bigint,jsonb,integer),public.cgs_par3_allocate_pools(bigint,jsonb),public.cgs_par3_sync_pool_fixtures(bigint,jsonb),public.cgs_par3_set_ctp_qualifiers(bigint,jsonb,timestamptz),public.cgs_par3_create_finals(bigint,jsonb,timestamptz) to service_role;
notify pgrst,'reload schema';
