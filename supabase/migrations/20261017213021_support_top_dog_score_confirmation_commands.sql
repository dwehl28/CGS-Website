create or replace function public.apply_top_dog_fixture_command(
  p_fixture_id bigint,
  p_command text,
  p_payload jsonb default '{}'::jsonb
)
returns public.top_dog_fixtures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fixture public.top_dog_fixtures;
  v_history public.top_dog_fixture_history;
  v_now timestamptz := timezone('utc', now());
begin
  select *
  into v_fixture
  from public.top_dog_fixtures
  where id = p_fixture_id
  for update;

  if not found then
    raise exception 'Top Dog fixture % was not found', p_fixture_id;
  end if;

  if p_command = 'undo' then
    select *
    into v_history
    from public.top_dog_fixture_history
    where fixture_id = p_fixture_id
    order by id desc
    limit 1
    for update;

    if not found then
      return v_fixture;
    end if;

    if v_history.action = 'official_import_boundary' then
      return v_fixture;
    end if;

    if v_history.action = 'match_of_night' then
      update public.top_dog_fixtures
      set is_match_of_night = false, updated_at = v_now
      where round_id = v_fixture.round_id
        and is_match_of_night = true;
    end if;

    update public.top_dog_fixtures
    set
      round_id = coalesce((v_history.snapshot ->> 'round_id')::bigint, round_id),
      home_team_id = coalesce((v_history.snapshot ->> 'home_team_id')::bigint, home_team_id),
      away_team_id = coalesce((v_history.snapshot ->> 'away_team_id')::bigint, away_team_id),
      display_order = coalesce((v_history.snapshot ->> 'display_order')::integer, display_order),
      scheduled_at = (v_history.snapshot ->> 'scheduled_at')::timestamptz,
      simulator_bay = coalesce(v_history.snapshot ->> 'simulator_bay', ''),
      status = coalesce(v_history.snapshot ->> 'status', 'waiting'),
      home_score = coalesce((v_history.snapshot ->> 'home_score')::integer, 0),
      away_score = coalesce((v_history.snapshot ->> 'away_score')::integer, 0),
      home_score_confirmed = coalesce(
        (v_history.snapshot ->> 'home_score_confirmed')::boolean,
        coalesce(v_history.snapshot ->> 'status', 'waiting') = 'final'
      ),
      away_score_confirmed = coalesce(
        (v_history.snapshot ->> 'away_score_confirmed')::boolean,
        coalesce(v_history.snapshot ->> 'status', 'waiting') = 'final'
      ),
      current_hole = coalesce((v_history.snapshot ->> 'current_hole')::integer, 0),
      holes_total = coalesce((v_history.snapshot ->> 'holes_total')::integer, 9),
      result_note = coalesce(v_history.snapshot ->> 'result_note', ''),
      is_match_of_night = coalesce((v_history.snapshot ->> 'is_match_of_night')::boolean, false),
      started_at = (v_history.snapshot ->> 'started_at')::timestamptz,
      finished_at = (v_history.snapshot ->> 'finished_at')::timestamptz,
      updated_at = v_now
    where id = p_fixture_id
    returning * into v_fixture;

    if v_history.action = 'match_of_night'
      and nullif(v_history.snapshot ->> 'previous_match_of_night_id', '') is not null then
      update public.top_dog_fixtures
      set is_match_of_night = true, updated_at = v_now
      where id = (v_history.snapshot ->> 'previous_match_of_night_id')::bigint
        and round_id = v_fixture.round_id;
    end if;

    delete from public.top_dog_fixture_history where id = v_history.id;
    return v_fixture;
  end if;

  if p_command = 'finish'
    and (not v_fixture.home_score_confirmed or not v_fixture.away_score_confirmed) then
    raise exception 'Both team scores must be confirmed before finishing the fixture';
  end if;

  insert into public.top_dog_fixture_history (fixture_id, action, snapshot)
  values (
    p_fixture_id,
    p_command,
    case
      when p_command = 'match_of_night' then
        to_jsonb(v_fixture) || jsonb_build_object(
          'previous_match_of_night_id',
          (
            select fixtures.id
            from public.top_dog_fixtures fixtures
            where fixtures.round_id = v_fixture.round_id
              and fixtures.is_match_of_night = true
              and fixtures.id <> p_fixture_id
            limit 1
          )
        )
      else to_jsonb(v_fixture)
    end
  );

  if p_command = 'start' then
    update public.top_dog_fixtures
    set
      status = 'live',
      current_hole = greatest(current_hole, 1),
      started_at = coalesce(started_at, v_now),
      finished_at = null,
      updated_at = v_now
    where id = p_fixture_id;
  elsif p_command = 'set_score' then
    update public.top_dog_fixtures
    set
      home_score = greatest(-99, least(99, coalesce((p_payload ->> 'home_score')::integer, home_score))),
      away_score = greatest(-99, least(99, coalesce((p_payload ->> 'away_score')::integer, away_score))),
      home_score_confirmed = coalesce(
        (p_payload ->> 'home_score_confirmed')::boolean,
        home_score_confirmed
      ),
      away_score_confirmed = coalesce(
        (p_payload ->> 'away_score_confirmed')::boolean,
        away_score_confirmed
      ),
      updated_at = v_now
    where id = p_fixture_id;
  elsif p_command = 'adjust_score' then
    update public.top_dog_fixtures
    set
      home_score = greatest(-99, least(99, home_score + coalesce((p_payload ->> 'home_delta')::integer, 0))),
      away_score = greatest(-99, least(99, away_score + coalesce((p_payload ->> 'away_delta')::integer, 0))),
      home_score_confirmed = case
        when coalesce((p_payload ->> 'home_delta')::integer, 0) <> 0 then true
        else home_score_confirmed
      end,
      away_score_confirmed = case
        when coalesce((p_payload ->> 'away_delta')::integer, 0) <> 0 then true
        else away_score_confirmed
      end,
      updated_at = v_now
    where id = p_fixture_id;
  elsif p_command = 'next_hole' then
    update public.top_dog_fixtures
    set
      status = case when status = 'waiting' then 'live' else status end,
      current_hole = least(holes_total, current_hole + 1),
      started_at = coalesce(started_at, v_now),
      updated_at = v_now
    where id = p_fixture_id;
  elsif p_command = 'previous_hole' then
    update public.top_dog_fixtures
    set
      current_hole = greatest(0, current_hole - 1),
      updated_at = v_now
    where id = p_fixture_id;
  elsif p_command = 'finish' then
    update public.top_dog_fixtures
    set
      status = 'final',
      finished_at = v_now,
      updated_at = v_now
    where id = p_fixture_id;
  elsif p_command = 'reopen' then
    update public.top_dog_fixtures
    set
      status = 'live',
      started_at = coalesce(started_at, v_now),
      finished_at = null,
      updated_at = v_now
    where id = p_fixture_id;
  elsif p_command = 'match_of_night' then
    update public.top_dog_fixtures
    set is_match_of_night = false, updated_at = v_now
    where round_id = v_fixture.round_id
      and is_match_of_night = true;

    update public.top_dog_fixtures
    set is_match_of_night = true, updated_at = v_now
    where id = p_fixture_id;

    update public.top_dog_stream_state stream_state
    set
      featured_fixture_id = p_fixture_id,
      scorebug_fixture_id = coalesce(stream_state.scorebug_fixture_id, p_fixture_id),
      updated_at = v_now
    where stream_state.season_id = (
      select rounds.season_id
      from public.top_dog_rounds rounds
      where rounds.id = v_fixture.round_id
    );
  else
    raise exception 'Unsupported Top Dog fixture command: %', p_command;
  end if;

  select * into v_fixture from public.top_dog_fixtures where id = p_fixture_id;
  return v_fixture;
end;
$$;

revoke all on function public.apply_top_dog_fixture_command(bigint, text, jsonb) from public;
revoke all on function public.apply_top_dog_fixture_command(bigint, text, jsonb) from anon, authenticated;
grant execute on function public.apply_top_dog_fixture_command(bigint, text, jsonb) to service_role;
