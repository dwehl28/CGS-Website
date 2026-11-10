-- Reusable finals with all entrants advancing and one pool-winners CTP bye.
-- This migration changes no existing event format, player, fixture or registration.
alter table public.cgs_par3_events add column if not exists finals_format text not null default 'standard';
alter table public.cgs_par3_events add constraint cgs_par3_events_finals_format_check check(finals_format in ('standard','pool_winners_ctp_bye'));
alter table public.cgs_par3_events drop constraint if exists cgs_par3_events_finals_size_check;
alter table public.cgs_par3_events add constraint cgs_par3_events_finals_size_check check(
  finals_size in (2,4,8,16,32,64)
  and (finals_format='standard' or finals_size>=4)
  and (pool_sizes is null or finals_size-case when finals_format='pool_winners_ctp_bye' then 1 else 0 end <= max_players)
);
-- An optional fourth argument preserves the current format for older callers.
drop function public.cgs_par3_update_format(bigint,jsonb,integer);

create or replace function public.cgs_par3_update_format(p_event_id bigint,p_pool_sizes jsonb,p_finals_size integer,p_finals_format text default null)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare e public.cgs_par3_events%rowtype; pool_count_new integer; capacity integer; total integer; sizes_old jsonb; active_count integer; mode text; structural_change boolean;
begin
  select * into e from public.cgs_par3_events where id=p_event_id for update;
  if not found then raise exception 'Par 3 event not found.'; end if;
  mode := coalesce(p_finals_format,e.finals_format);
  if mode not in ('standard','pool_winners_ctp_bye') then raise exception 'Choose a valid finals format.'; end if;
  if mode='pool_winners_ctp_bye' and p_finals_size<4 then raise exception 'The CTP bye format needs at least a four-slot finals draw.'; end if;
  if p_pool_sizes is null or jsonb_typeof(p_pool_sizes)<>'array' then raise exception 'Enter the pool capacities.'; end if;
  pool_count_new := jsonb_array_length(p_pool_sizes);
  if pool_count_new not between 1 and 16 then raise exception 'Choose between 1 and 16 pools.'; end if;
  if mode='pool_winners_ctp_bye' and p_finals_size-1<pool_count_new*2 then raise exception 'The CTP bye field needs at least two entrants in every nominated pool.'; end if;
  if exists(select 1 from jsonb_array_elements(p_pool_sizes) x where jsonb_typeof(x)<>'number' or x::text !~ '^[2-8]$') then raise exception 'Every pool needs an integer capacity from 2 to 8.'; end if;
  select sum(value::text::integer),max(value::text::integer) into total,capacity from jsonb_array_elements(p_pool_sizes);
  if total>64 or p_finals_size not in(2,4,8,16,32,64) or (p_finals_size-case when mode='pool_winners_ctp_bye' then 1 else 0 end)>total or p_finals_size is null then raise exception 'Choose a power-of-two finals field that fits within the tournament capacity.'; end if;
  select coalesce(e.pool_sizes,jsonb_agg(e.pool_size)) into sizes_old from generate_series(1,e.pool_count);
  structural_change := p_pool_sizes<>sizes_old or p_finals_size<>e.finals_size;
  if not structural_change and mode=e.finals_format then return; end if;
  if e.knockout_data is not null then raise exception 'The format cannot change after finals are generated.'; end if;
  if structural_change and exists(select 1 from public.cgs_par3_pool_matches where event_id=e.id and (status<>'scheduled' or winner_id is not null)) then raise exception 'The format cannot change after a match starts or results are recorded.'; end if;
  if exists(select 1 from public.cgs_par3_players where event_id=e.id and ctp_rank is not null) then raise exception 'Clear CTP qualifiers before changing the format.'; end if;
  if not structural_change then
    update public.cgs_par3_events set finals_format=mode,updated_at=clock_timestamp() where id=e.id;
    return;
  end if;
  select count(*) into active_count from public.cgs_par3_players where event_id=e.id and not is_withdrawn;
  if active_count>total then raise exception 'The new capacity is smaller than the registered field.'; end if;
  if exists(select 1 from public.cgs_par3_players p where p.event_id=e.id and (p.pool_number>pool_count_new or p.pool_rank_override>coalesce((p_pool_sizes->>(p.pool_number-1))::integer,8))) then raise exception 'Move players and adjust manual seeds before removing or shrinking a pool.'; end if;
  if exists(select 1 from public.cgs_par3_players p where p.event_id=e.id and not p.is_withdrawn and p.pool_number is not null group by p.pool_number having count(*)>(p_pool_sizes->>(p.pool_number-1))::integer) then raise exception 'An assigned pool has more players than its new capacity.'; end if;
  delete from public.cgs_par3_pool_matches where event_id=e.id and pool_number>pool_count_new;
  update public.cgs_par3_events set pool_sizes=p_pool_sizes,pool_count=pool_count_new,pool_size=capacity,max_players=total,finals_size=p_finals_size,finals_format=mode,
    summary=format('A %s-player match-play championship with %s pools and a %s-player single-elimination finals draw.',total,pool_count_new,p_finals_size),
    registrations_open=case when active_count>=total then false when e.status_label='Sold out' then true else e.registrations_open end,
    status_label=case when active_count>=total then 'Sold out' when e.status_label='Sold out' then 'Registrations open' else e.status_label end,
    updated_at=clock_timestamp() where id=e.id;
end $$;

-- Derive eligible winners using the same complete manual ranks or results /
-- head-to-head / display-order rules used by the public tables. The caller locks
-- the event before checking these rows, so CTP confirmation cannot race a score.
create or replace function public.cgs_par3_completed_pool_winners(p_event_id bigint)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.cgs_par3_events%rowtype; pool integer; n integer; manual_count integer; winner bigint; winners jsonb := '[]';
begin
  select * into e from public.cgs_par3_events where id=p_event_id;
  if not found then raise exception 'Par 3 event not found.'; end if;
  if exists(select 1 from public.cgs_par3_players where event_id=e.id and not is_withdrawn and (pool_number is null or pool_number>e.pool_count)) then raise exception 'Assign every active player to a pool first.'; end if;
  for pool in 1..e.pool_count loop
    select count(*),count(pool_rank_override) into n,manual_count from public.cgs_par3_players where event_id=e.id and pool_number=pool and not is_withdrawn;
    if n<2 or n>coalesce((e.pool_sizes->>(pool-1))::integer,e.pool_size) then raise exception 'Every pool must contain between two players and its nominated capacity.'; end if;
    if manual_count>0 then
      if manual_count<>n or (select count(distinct pool_rank_override) from public.cgs_par3_players where event_id=e.id and pool_number=pool and not is_withdrawn and pool_rank_override between 1 and n)<>n then raise exception 'Complete or clear the manual pool rankings before confirming CTP.'; end if;
      select id into winner from public.cgs_par3_players where event_id=e.id and pool_number=pool and not is_withdrawn and pool_rank_override=1;
    else
      if (select count(*) from public.cgs_par3_pool_matches where event_id=e.id and pool_number=pool)<>n*(n-1)/2
        or exists(select 1 from public.cgs_par3_pool_matches m left join public.cgs_par3_players p1 on p1.id=m.player1_id and p1.event_id=e.id and p1.pool_number=pool and not p1.is_withdrawn left join public.cgs_par3_players p2 on p2.id=m.player2_id and p2.event_id=e.id and p2.pool_number=pool and not p2.is_withdrawn where m.event_id=e.id and m.pool_number=pool and (m.status<>'complete' or m.winner_id is null or p1.id is null or p2.id is null or m.winner_id not in(m.player1_id,m.player2_id))) then raise exception 'Complete or manually seed every pool before confirming CTP.'; end if;
      with player_wins as (
        select p.id,p.display_order,(select count(*) from public.cgs_par3_pool_matches m where m.event_id=e.id and m.pool_number=pool and m.winner_id=p.id) as wins
        from public.cgs_par3_players p where p.event_id=e.id and p.pool_number=pool and not p.is_withdrawn
      ), ranked as (
        select p.*,(select count(*) from public.cgs_par3_pool_matches m join player_wins other on other.id=case when m.player1_id=p.id then m.player2_id else m.player1_id end and other.wins=p.wins where m.event_id=e.id and m.pool_number=pool and m.winner_id=p.id) as head_to_head_wins from player_wins p
      ) select id into winner from ranked order by wins desc,head_to_head_wins desc,display_order,id limit 1;
    end if;
    winners := winners || jsonb_build_array(winner);
  end loop;
  return winners;
end $$;

create or replace function public.cgs_par3_set_ctp_qualifiers(p_event_id bigint,p_player_ids jsonb,p_expected_updated_at timestamptz)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.cgs_par3_events%rowtype; item record; winners jsonb; selected integer;
begin
  select * into e from public.cgs_par3_events where id=p_event_id for update;
  if not found then raise exception 'Par 3 event not found.'; end if;
  if e.knockout_data is not null then raise exception 'CTP qualifiers cannot change after finals are generated.'; end if;
  if e.updated_at is distinct from p_expected_updated_at then raise exception 'The tournament changed. Refresh before saving qualifiers.'; end if;
  if p_player_ids is null or jsonb_typeof(p_player_ids)<>'array' or jsonb_array_length(p_player_ids)>e.finals_size then raise exception 'Invalid CTP qualifier data.'; end if;
  if exists(select 1 from jsonb_array_elements(p_player_ids) x where x<>'null'::jsonb and (jsonb_typeof(x)<>'number' or x::text !~ '^[1-9][0-9]*$')) then raise exception 'Invalid CTP player.'; end if;
  select count(*) into selected from jsonb_array_elements(p_player_ids) x where x<>'null'::jsonb;
  if selected<>(select count(distinct x) from jsonb_array_elements(p_player_ids) x where x<>'null'::jsonb) then raise exception 'CTP qualifiers must be distinct players.'; end if;
  if exists(select 1 from jsonb_array_elements(p_player_ids) x where x<>'null'::jsonb and not exists(select 1 from public.cgs_par3_players p where p.id=x::text::bigint and p.event_id=e.id and not p.is_withdrawn)) then raise exception 'CTP qualifier is not an active tournament player.'; end if;
  if e.finals_format='pool_winners_ctp_bye' and selected>0 then
    if selected<>1 or jsonb_array_length(p_player_ids)<>1 or p_player_ids->0='null'::jsonb then raise exception 'Confirm exactly one pool-winner CTP bye recipient.'; end if;
    if (select count(*) from public.cgs_par3_players where event_id=e.id and not is_withdrawn)<>e.finals_size-1 then raise exception 'The CTP bye format needs exactly one fewer entrant than finals slots.'; end if;
    winners := public.cgs_par3_completed_pool_winners(e.id);
    if not winners @> jsonb_build_array((p_player_ids->>0)::bigint) then raise exception 'The CTP bye recipient must be a confirmed pool winner.'; end if;
  end if;
  update public.cgs_par3_players set ctp_rank=null,updated_at=clock_timestamp() where event_id=e.id and ctp_rank is not null;
  for item in select value,ordinality from jsonb_array_elements(p_player_ids) with ordinality where value<>'null'::jsonb loop
    update public.cgs_par3_players set ctp_rank=item.ordinality,updated_at=clock_timestamp() where event_id=e.id and id=item.value::text::bigint;
  end loop;
end $$;

create or replace function public.cgs_par3_create_finals(p_event_id bigint,p_knockout_data jsonb,p_expected_updated_at timestamptz)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  e public.cgs_par3_events%rowtype; expected integer; active_count integer; ctp_winner bigint; winner_participant bigint;
  winners jsonb; first_round bigint; second_round bigint; bye jsonb; bye_opponent bigint; first_matches jsonb; opening_ids jsonb; target_match jsonb;
begin
  select * into e from public.cgs_par3_events where id=p_event_id for update;
  if not found then raise exception 'Par 3 event not found.'; end if;
  if e.knockout_data is not null then raise exception 'Finals have already been generated. Existing results have been preserved.'; end if;
  if e.updated_at is distinct from p_expected_updated_at then raise exception 'The tournament changed. Refresh before generating finals.'; end if;
  expected := e.finals_size-case when e.finals_format='pool_winners_ctp_bye' then 1 else 0 end;
  if p_knockout_data is null or jsonb_typeof(p_knockout_data)<>'object' or jsonb_typeof(p_knockout_data->'participant')<>'array' or jsonb_array_length(coalesce(p_knockout_data->'participant','[]'))<>expected then raise exception 'The finals draw must contain the nominated number of players.'; end if;
  if e.finals_format='pool_winners_ctp_bye' then
    select count(*) into active_count from public.cgs_par3_players where event_id=e.id and not is_withdrawn;
    if active_count<>expected then raise exception 'The CTP bye format needs exactly one fewer entrant than finals slots.'; end if;
    winners := public.cgs_par3_completed_pool_winners(e.id);
    if (select count(*) from public.cgs_par3_players where event_id=e.id and ctp_rank is not null)<>1 then raise exception 'Confirm exactly one pool-winner CTP bye recipient.'; end if;
    select id into ctp_winner from public.cgs_par3_players where event_id=e.id and not is_withdrawn and ctp_rank=1;
    if ctp_winner is null or not winners @> jsonb_build_array(ctp_winner) then raise exception 'The CTP bye recipient must be a confirmed pool winner.'; end if;
    if exists(select 1 from jsonb_array_elements(p_knockout_data->'participant') p where jsonb_typeof(p->'id') is distinct from 'number' or p->>'id' !~ '^[0-9]+$' or jsonb_typeof(p->'par3PlayerId') is distinct from 'number' or p->>'par3PlayerId' !~ '^[1-9][0-9]*$') then raise exception 'Every finals participant needs a valid player identity.'; end if;
    if (select count(distinct p->>'id') from jsonb_array_elements(p_knockout_data->'participant') p)<>expected
      or (select count(distinct p->>'par3PlayerId') from jsonb_array_elements(p_knockout_data->'participant') p)<>expected
      or exists(select 1 from jsonb_array_elements(p_knockout_data->'participant') p where not exists(select 1 from public.cgs_par3_players active where active.id=(p->>'par3PlayerId')::bigint and active.event_id=e.id and not active.is_withdrawn)) then raise exception 'The finals draw must include every active player exactly once.'; end if;
    select (p->>'id')::bigint into winner_participant from jsonb_array_elements(p_knockout_data->'participant') p where (p->>'par3PlayerId')::bigint=ctp_winner;
    if jsonb_typeof(p_knockout_data->'stage') is distinct from 'array' or jsonb_array_length(p_knockout_data->'stage')<>1 or p_knockout_data->'stage'->0->>'type'<>'single_elimination' or (p_knockout_data->'stage'->0->'settings'->>'size')::integer<>e.finals_size then raise exception 'Use the nominated single-elimination finals size.'; end if;
    if jsonb_typeof(p_knockout_data->'round') is distinct from 'array' or jsonb_typeof(p_knockout_data->'match') is distinct from 'array' then raise exception 'The finals rounds and matches are missing.'; end if;
    if (select count(*) from jsonb_array_elements(p_knockout_data->'round') r where r->>'number'='1')<>1 or (select count(*) from jsonb_array_elements(p_knockout_data->'round') r where r->>'number'='2')<>1 then raise exception 'The opening round and next round must each be present once.'; end if;
    select (r->>'id')::bigint into first_round from jsonb_array_elements(p_knockout_data->'round') r where r->>'number'='1';
    select (r->>'id')::bigint into second_round from jsonb_array_elements(p_knockout_data->'round') r where r->>'number'='2';
    select coalesce(jsonb_agg(m),'[]') into first_matches from jsonb_array_elements(p_knockout_data->'match') m where (m->>'round_id')::bigint=first_round;
    if jsonb_array_length(first_matches)<>e.finals_size/2 then raise exception 'The opening round has the wrong number of matches.'; end if;
    if (select count(*) from jsonb_array_elements(first_matches) m where (m->'opponent1'='null'::jsonb)<>(m->'opponent2'='null'::jsonb))<>1 then raise exception 'The opening draw must contain exactly one genuine bye.'; end if;
    select m into bye from jsonb_array_elements(first_matches) m where (m->'opponent1'='null'::jsonb)<>(m->'opponent2'='null'::jsonb);
    bye_opponent := coalesce(bye->'opponent1'->>'id',bye->'opponent2'->>'id')::bigint;
    if bye_opponent is distinct from winner_participant then raise exception 'The confirmed CTP winner must receive the bye.'; end if;
    select coalesce(jsonb_agg(o),'[]') into opening_ids from jsonb_array_elements(first_matches) m cross join lateral jsonb_array_elements(jsonb_build_array(m->'opponent1',m->'opponent2')) o where o<>'null'::jsonb;
    if jsonb_array_length(opening_ids)<>expected or exists(select 1 from jsonb_array_elements(opening_ids) o where jsonb_typeof(o->'id') is distinct from 'number' or o->>'id' !~ '^[0-9]+$')
      or (select count(distinct o->>'id') from jsonb_array_elements(opening_ids) o)<>expected
      or exists(select 1 from jsonb_array_elements(opening_ids) o where not exists(select 1 from jsonb_array_elements(p_knockout_data->'participant') p where p->>'id'=o->>'id')) then raise exception 'Every remaining entrant must play one opening match.'; end if;
    if (select count(*) from jsonb_array_elements(first_matches) m where m->'opponent1'<>'null'::jsonb and m->'opponent2'<>'null'::jsonb)<>e.finals_size/2-1 then raise exception 'The opening draw has the wrong number of playable matches.'; end if;
    if exists(select 1 from jsonb_array_elements(first_matches) m where m<>bye and ((m->>'status')::integer is distinct from 2 or m->'opponent1'->>'result' is not null or m->'opponent2'->>'result' is not null or m->'opponent1'->>'score' is not null or m->'opponent2'->>'score' is not null or coalesce((m->'opponent1'->>'forfeit')::boolean,false) or coalesce((m->'opponent2'->>'forfeit')::boolean,false))) then raise exception 'Opening matches must be unplayed before the finals draw is created.'; end if;
    if (bye->>'status')::integer is distinct from 0 or coalesce(bye->'opponent1'->>'result',bye->'opponent2'->>'result','')<>'win' then raise exception 'The bye must use automatic advancement rather than a played match.'; end if;
    select m into target_match from jsonb_array_elements(p_knockout_data->'match') m where (m->>'round_id')::bigint=second_round and (m->>'number')::integer=ceil((bye->>'number')::numeric/2)::integer;
    if target_match is null or coalesce(target_match->'opponent1'->>'id','')<>winner_participant::text and coalesce(target_match->'opponent2'->>'id','')<>winner_participant::text then raise exception 'The CTP winner must advance automatically to the next round.'; end if;
    if jsonb_array_length(p_knockout_data->'match')<>e.finals_size-1
      or (select count(*) from jsonb_array_elements(p_knockout_data->'match') m where (m->>'round_id')::bigint<>first_round and (coalesce(m->'opponent1'->>'id','')=winner_participant::text or coalesce(m->'opponent2'->>'id','')=winner_participant::text))<>1
      or exists(select 1 from jsonb_array_elements(p_knockout_data->'match') m where (m->>'round_id')::bigint<>first_round and (
        m->'opponent1' is null or m->'opponent2' is null or m->'opponent1'='null'::jsonb or m->'opponent2'='null'::jsonb
        or m->'opponent1'->>'id' is not null and m->'opponent1'->>'id'<>winner_participant::text
        or m->'opponent2'->>'id' is not null and m->'opponent2'->>'id'<>winner_participant::text
        or (m->>'status')::integer is distinct from (case when m=target_match then 1 else 0 end)
        or m->'opponent1'->>'result' is not null or m->'opponent2'->>'result' is not null
        or m->'opponent1'->>'score' is not null or m->'opponent2'->>'score' is not null
      )) then raise exception 'Only the CTP bye recipient may already appear in a later round; all other finals matches must remain unplayed.'; end if;
  end if;
  update public.cgs_par3_events set knockout_data=p_knockout_data,knockout_generated_at=clock_timestamp(),current_phase='knockout',status_label=case e.finals_size when 2 then 'Grand Final' when 4 then 'Semi Finals' when 8 then 'Quarter Finals' else format('Round of %s',e.finals_size) end,updated_at=clock_timestamp() where id=e.id;
end $$;

revoke all on function public.cgs_par3_update_format(bigint,jsonb,integer,text) from public,anon,authenticated;
revoke all on function public.cgs_par3_completed_pool_winners(bigint) from public,anon,authenticated;
revoke all on function public.cgs_par3_set_ctp_qualifiers(bigint,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.cgs_par3_create_finals(bigint,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.cgs_par3_update_format(bigint,jsonb,integer,text),public.cgs_par3_completed_pool_winners(bigint),public.cgs_par3_set_ctp_qualifiers(bigint,jsonb,timestamptz),public.cgs_par3_create_finals(bigint,jsonb,timestamptz) to service_role;
notify pgrst,'reload schema';

