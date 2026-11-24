begin;

create table public.cgl_event_enrolments (
  week_id uuid not null references public.cgl_weeks(id),
  member_id uuid not null references public.cgl_members(id),
  sgt_player_id text not null,
  event_ids text[] not null,
  state text not null check (state in ('in_progress','confirmed','failed')),
  evidence text not null,
  reviewed_by text not null,
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  primary key (week_id,member_id)
);
create index cgl_event_enrolments_member_idx on public.cgl_event_enrolments(member_id);

create table public.cgl_qualifying_cards (
  season_id uuid not null references public.cgl_seasons(id),
  member_id uuid not null references public.cgl_members(id),
  sgt_player_id text not null,
  scorecard_id text not null,
  path text not null check(path in ('established','new')),
  holes smallint not null check(holes in (9,18)),
  played_at timestamptz not null,
  source_url text not null,
  primary key(season_id,scorecard_id)
);
create index cgl_qualifying_cards_member_idx on public.cgl_qualifying_cards(season_id,member_id);

create table public.cgl_event_reviews (
  week_id uuid primary key references public.cgl_weeks(id),
  calculation_id uuid not null references public.cgl_calculations(id),
  opened_at timestamptz not null default now(),
  review_until timestamptz not null default (now()+interval '48 hours')
);
create table public.cgl_event_disputes (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.cgl_event_reviews(week_id),
  details text not null,
  state text not null default 'open' check(state in ('open','resolved')),
  created_at timestamptz not null default now(),
  resolution_target_at timestamptz not null,
  resolved_at timestamptz
);
create index cgl_event_disputes_open_idx on public.cgl_event_disputes(week_id) where state='open';

alter table public.cgl_event_enrolments enable row level security;
alter table public.cgl_qualifying_cards enable row level security;
alter table public.cgl_event_reviews enable row level security;
alter table public.cgl_event_disputes enable row level security;
revoke all on public.cgl_event_enrolments,public.cgl_event_reviews,public.cgl_event_disputes,public.cgl_qualifying_cards from public,anon,authenticated;
grant select,insert,update on public.cgl_event_enrolments,public.cgl_event_reviews,public.cgl_event_disputes,public.cgl_qualifying_cards to service_role;

create function public.cgl_verify_guest_sgt(p_member_id uuid,p_username text,p_sgt_id text,p_source text,p_actor text,p_reason text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_member public.cgl_members;
begin
  select * into v_member from public.cgl_members where id=p_member_id for update;
  if not found or v_member.account_id is not null or v_member.sgt_username is null or lower(v_member.sgt_username)<>lower(p_username)
    or p_sgt_id !~ '^[0-9]{8,30}$' or p_source !~ '^https://(www\.)?simulatorgolftour\.com/' or length(trim(p_reason))<5 then
    raise exception 'Verify the guest checkout username and unique ID against an official SGT profile';
  end if;
  if v_member.sgt_verified_at is not null then
    if v_member.sgt_id is distinct from p_sgt_id then raise exception 'An existing verified SGT identity cannot be switched here'; end if;
  else
    update public.cgl_members set sgt_id=p_sgt_id,sgt_verified_at=now(),updated_at=now() where id=p_member_id;
    insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,after_data)
      values(p_actor,'verify_guest_sgt','member',p_member_id::text,p_reason,jsonb_build_object('sgt_id',p_sgt_id,'source_url',p_source));
  end if;
  return jsonb_build_object('member_id',p_member_id,'sgt_id',p_sgt_id);
end $$;

create function public.cgl_record_qualifying_card(p_record jsonb,p_actor text,p_reason text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_card public.cgl_qualifying_cards; v_existing public.cgl_qualifying_cards;
begin
  v_card:=jsonb_populate_record(null::public.cgl_qualifying_cards,p_record);
  perform 1 from public.cgl_members where id=v_card.member_id and sgt_id=v_card.sgt_player_id and sgt_verified_at is not null for update;
  if not found or v_card.played_at>now() or length(trim(p_reason))<5 then raise exception 'Verified player, historical scorecard and reason required'; end if;
  if exists(select 1 from public.cgl_qualifying_cards where season_id=v_card.season_id and member_id=v_card.member_id and path<>v_card.path) then
    raise exception 'Use the same qualification pathway for all approved cards for this player';
  end if;
  insert into public.cgl_qualifying_cards select v_card.* on conflict(season_id,scorecard_id) do nothing;
  if not found then
    select * into v_existing from public.cgl_qualifying_cards where season_id=v_card.season_id and scorecard_id=v_card.scorecard_id;
    if v_existing is distinct from v_card then raise exception 'This scorecard is already recorded with different qualification details'; end if;
  else
    insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,after_data) values(p_actor,'record_qualifying_card','member',v_card.member_id::text,p_reason,to_jsonb(v_card));
  end if;
  return to_jsonb(v_card);
end $$;

create function public.cgl_seed_season_one(p_season jsonb,p_weeks jsonb,p_actor text,p_reason text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_season public.cgl_seasons; v_new jsonb; v_week jsonb; v_created int:=0;
begin
  perform pg_advisory_xact_lock(2027,1);
  if length(trim(p_reason))<5 or p_season->>'slug' is distinct from 'hidden-gems-tour-2027'
    or p_season->>'year' is distinct from '2027' or p_season->>'season_number' is distinct from '1'
    or p_season#>>'{config,regulation}' is distinct from 'hidden-gems-2027-v1'
    or jsonb_array_length(p_weeks)<>13 then raise exception 'Invalid Season 1 draft'; end if;
  select * into v_season from public.cgl_seasons where year=2027 and season_number=1 for update;
  if found then
    if v_season.status<>'draft' or v_season.config->>'regulation' is distinct from 'hidden-gems-2027-v1' then
      raise exception 'An existing Season 1 record needs administrator review; nothing was replaced';
    end if;
  else
    v_new:=public.cgl_admin_save('season',p_season||jsonb_build_object('id',gen_random_uuid(),'status','draft'),p_actor,p_reason);
    select * into v_season from public.cgl_seasons where id=(v_new->>'id')::uuid;
  end if;
  for v_week in select value from jsonb_array_elements(p_weeks) loop
    if not exists(select 1 from public.cgl_weeks where season_id=v_season.id and week_number=(v_week->>'week_number')::int) then
      perform public.cgl_admin_save('week',v_week||jsonb_build_object('id',gen_random_uuid(),'season_id',v_season.id,'status','draft'),p_actor,p_reason);
      v_created:=v_created+1;
    end if;
  end loop;
  if (select count(*) from public.cgl_weeks where season_id=v_season.id)<>13 then raise exception 'Expected 13 Season 1 fixtures'; end if;
  return jsonb_build_object('season_id',v_season.id,'created_weeks',v_created);
end $$;

create function public.cgl_hidden_gems_season_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' and old.config->>'regulation'='hidden-gems-2027-v1' and
    (new.config->>'regulation' is distinct from old.config->>'regulation' or new.year<>old.year or new.season_number<>old.season_number) then
    raise exception 'Season 1 launch rules cannot be removed';
  end if;
  if new.config->>'regulation'='hidden-gems-2027-v1' then
    if new.format<>'world_tour' then raise exception 'Season 1 requires two different courses'; end if;
    if new.status<>'draft' and (new.config->'schedule_approved' is distinct from 'true'::jsonb
      or (new.config->>'entry_opens_at')::timestamptz is null
      or new.starts_at is null or new.ends_at is null
      or not coalesce((new.config->>'entry_opens_at')::timestamptz < new.starts_at
        and (new.config->>'calendar_ends_at')::timestamptz between new.starts_at and new.ends_at,false)) then
      raise exception 'Approve the Season 1 schedule before it can be released';
    end if;
    if new.status in ('closed','archived') and new.ends_at>now() then
      raise exception 'Open Season 1 submission windows must be honoured';
    end if;
  end if;
  return new;
end $$;
create trigger cgl_hidden_gems_season_guard before insert or update on public.cgl_seasons
for each row execute function public.cgl_hidden_gems_season_guard();

create function public.cgl_hidden_gems_week_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_season public.cgl_seasons; v_a jsonb:=new.config->'course_a'; v_b jsonb:=new.config->'course_b';
begin
  select * into v_season from public.cgl_seasons where id=new.season_id;
  if v_season.config->>'regulation' is distinct from 'hidden-gems-2027-v1' or new.status='draft' then return new; end if;
  if v_season.status='draft' or new.config->'event_approved' is distinct from 'true'::jsonb
    or new.opens_at is null or new.closes_at is null or new.opens_at<v_season.starts_at or new.closes_at>v_season.ends_at
    or new.opens_at is distinct from (new.config->>'verified_opens_at')::timestamptz
    or new.closes_at is distinct from (new.config->>'verified_closes_at')::timestamptz
    or new.sgt_tournament_id is null or new.sgt_tournament_id !~ '^[0-9]+$'
    or coalesce(new.config->>'sgt_tournament_b_id','') !~ '^[0-9]*$'
    or new.config->>'sgt_tournament_b_id'=new.sgt_tournament_id
    or v_a->'verified' is distinct from 'true'::jsonb or v_b->'verified' is distinct from 'true'::jsonb
    or nullif(v_a->>'sgtCourseId','') is null or nullif(v_b->>'sgtCourseId','') is null
    or v_a->>'sgtCourseId'=v_b->>'sgtCourseId'
    or coalesce(v_a->>'segment','') not in ('front_9','back_9') or coalesce(v_b->>'segment','') not in ('front_9','back_9')
    or nullif(v_a->>'tee','') is null or nullif(v_b->>'tee','') is null
    or (new.phase='championship' and (new.conditions='{}' or coalesce(new.config->>'ctp_hole','') !~ '^(A|B):([1-9]|1[0-8])$')) then
    raise exception 'Approve actual SGT event, distinct course builds, nines, tees and playing settings before release';
  end if;
  if tg_op='UPDATE' and old.status<>'draft' and (old.config->'course_a',old.config->'course_b',old.sgt_tournament_id,old.config->>'sgt_tournament_b_id',old.conditions,old.config->>'ctp_hole')
    is distinct from (new.config->'course_a',new.config->'course_b',new.sgt_tournament_id,new.config->>'sgt_tournament_b_id',new.conditions,new.config->>'ctp_hole') then
    raise exception 'Return this fixture to draft for event re-verification';
  end if;
  return new;
end $$;
create trigger cgl_hidden_gems_week_guard before insert or update on public.cgl_weeks
for each row execute function public.cgl_hidden_gems_week_guard();

create function public.cgl_hidden_gems_checkout_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.plan_code='casual_season' and exists(select 1 from public.cgl_seasons s where s.id=new.season_id
    and s.config->>'regulation'='hidden-gems-2027-v1'
    and (s.config->'schedule_approved' is distinct from 'true'::jsonb or coalesce((s.config->>'entry_opens_at')::timestamptz,'infinity'::timestamptz)>now())) then
    raise exception 'Season 1 entry is not open yet';
  end if;
  return new;
end $$;
create trigger cgl_hidden_gems_checkout_guard before insert on public.cgl_square_checkout_intents
for each row execute function public.cgl_hidden_gems_checkout_guard();

create function public.cgl_save_event_enrolment(p_week_id uuid,p_member_id uuid,p_player_id text,p_event_ids text[],p_state text,p_evidence text,p_actor text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_week public.cgl_weeks; v_member public.cgl_members; v_old public.cgl_event_enrolments; v_new public.cgl_event_enrolments;
begin
  select * into v_week from public.cgl_weeks where id=p_week_id for update;
  if not found or v_week.status not in ('published','open') or v_week.closes_at<=now() or
    array_remove(array[v_week.sgt_tournament_id,v_week.config->>'sgt_tournament_b_id'],null) is distinct from p_event_ids then
    raise exception 'Enrolment requires a released fixture with the exact current SGT event IDs';
  end if;
  select * into v_member from public.cgl_members where id=p_member_id;
  if not found or v_member.sgt_id is distinct from p_player_id or v_member.sgt_verified_at is null or v_member.eligibility<>'active' then
    raise exception 'The verified, active SGT identity is required';
  end if;
  if length(trim(p_evidence))<5 then raise exception 'Record SGT confirmation evidence or a reason'; end if;
  select * into v_old from public.cgl_event_enrolments where week_id=p_week_id and member_id=p_member_id;
  insert into public.cgl_event_enrolments(week_id,member_id,sgt_player_id,event_ids,state,evidence,reviewed_by,confirmed_at)
    values(p_week_id,p_member_id,p_player_id,p_event_ids,p_state,p_evidence,p_actor,case when p_state='confirmed' then now() end)
    on conflict(week_id,member_id) do update set sgt_player_id=excluded.sgt_player_id,event_ids=excluded.event_ids,state=excluded.state,
      evidence=excluded.evidence,reviewed_by=excluded.reviewed_by,updated_at=now(),confirmed_at=case when v_old.state='confirmed'
        and v_old.event_ids=p_event_ids and v_old.sgt_player_id=p_player_id and p_state='confirmed' then v_old.confirmed_at else excluded.confirmed_at end
    returning * into v_new;
  if p_state='confirmed' then
    insert into public.cgl_notifications(member_id,kind,title,body,source_key)
      values(p_member_id,'sgt_enrolment','SGT enrolment confirmed',v_week.name||': you are enrolled in SGT. Play both approved nines within the published window.',
        'sgt-enrolment:'||p_week_id||':'||p_member_id||':'||array_to_string(p_event_ids,',')) on conflict(source_key) do nothing;
  end if;
  insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,before_data,after_data)
    values(p_actor,'save_enrolment','week',p_week_id::text,p_evidence,to_jsonb(v_old),to_jsonb(v_new));
  return to_jsonb(v_new);
end $$;

create function public.cgl_update_event_review(p_week_id uuid,p_action text,p_dispute_id uuid,p_actor text,p_reason text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_week public.cgl_weeks; v_calc public.cgl_calculations; v_review public.cgl_event_reviews; v_dispute public.cgl_event_disputes; v_snapshot jsonb; v_result jsonb;
begin
  select * into v_week from public.cgl_weeks where id=p_week_id for update;
  if not found or v_week.phase<>'championship' or v_week.status='draft' or v_week.closes_at is null or now()<=v_week.closes_at or v_week.results_published then
    raise exception 'Review starts after submissions close and before finalisation';
  end if;
  if length(trim(p_reason))<5 then raise exception 'Document the reason'; end if;
  case p_action
    when 'open_review' then
      select * into v_calc from public.cgl_calculations where week_id=p_week_id and published_at is null order by created_at desc,id desc limit 1;
      select coalesce(jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at) order by id),'[]') into v_snapshot from public.cgl_results where week_id=p_week_id and state='verified';
      if v_calc.id is null or v_calc.source_snapshot<>v_snapshot or exists(select 1 from public.cgl_results where week_id=p_week_id and state='pending') then
        raise exception 'Calculate provisional results from current reviewed scores first';
      end if;
      insert into public.cgl_event_reviews(week_id,calculation_id) values(p_week_id,v_calc.id)
        on conflict(week_id) do update set calculation_id=excluded.calculation_id,
          opened_at=case when cgl_event_reviews.calculation_id=excluded.calculation_id then cgl_event_reviews.opened_at else now() end,
          review_until=case when cgl_event_reviews.calculation_id=excluded.calculation_id then cgl_event_reviews.review_until else now()+interval '48 hours' end
        returning * into v_review;
      v_result:=to_jsonb(v_review);
    when 'log_dispute' then
      select * into v_review from public.cgl_event_reviews where week_id=p_week_id;
      if not found then raise exception 'Open provisional review before logging a dispute'; end if;
      insert into public.cgl_event_disputes(week_id,details,resolution_target_at)
        select p_week_id,p_reason,((v_review.review_until at time zone 'Australia/Brisbane')+make_interval(days=>day_number)) at time zone 'Australia/Brisbane'
        from generate_series(1,10) day_number where extract(isodow from (v_review.review_until at time zone 'Australia/Brisbane')+make_interval(days=>day_number))<=5
        order by day_number offset 4 limit 1 returning * into v_dispute;
      v_result:=to_jsonb(v_dispute);
    when 'extend_dispute' then
      update public.cgl_event_disputes set resolution_target_at=greatest(resolution_target_at,now())+interval '7 days'
        where id=p_dispute_id and week_id=p_week_id and state='open' returning * into v_dispute;
      if not found then raise exception 'Open dispute not found for this round'; end if;
      v_result:=to_jsonb(v_dispute);
    when 'resolve_dispute' then
      update public.cgl_event_disputes set state='resolved',resolved_at=now() where id=p_dispute_id and week_id=p_week_id and state='open' returning * into v_dispute;
      if not found then raise exception 'Open dispute not found for this round'; end if;
      v_result:=to_jsonb(v_dispute);
    else raise exception 'Invalid review action';
  end case;
  insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,after_data) values(p_actor,p_action,'week',p_week_id::text,p_reason,v_result);
  return v_result;
end $$;

create function public.cgl_hidden_gems_final_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_week public.cgl_weeks; v_review public.cgl_event_reviews;
begin
  if new.published_at is null then return new; end if;
  select w.* into v_week from public.cgl_weeks w join public.cgl_seasons s on s.id=w.season_id
    where w.id=new.week_id and s.config->>'regulation'='hidden-gems-2027-v1' for update of w;
  if not found then return new; end if;
  select * into v_review from public.cgl_event_reviews where week_id=new.week_id;
  if v_week.status='draft' or v_week.closes_at is null or now()<=v_week.closes_at or v_review.review_until is null or now()<v_review.review_until
    or exists(select 1 from public.cgl_event_disputes where week_id=new.week_id and state='open') then
    raise exception 'The 48-hour review period and all disputes for this round must be resolved before finalisation';
  end if;
  if not exists(select 1 from public.cgl_calculations c where c.id=v_review.calculation_id and c.source_snapshot=new.source_snapshot
    and c.rules_version=new.rules_version and c.points_version=new.points_version and c.rows=new.rows and c.awards=new.awards) then
    raise exception 'The reviewed scores or points changed; reopen provisional review';
  end if;
  insert into public.cgl_notifications(member_id,kind,title,body,source_key)
    select distinct (entry->>'playerId')::uuid,'result_final','Round results are final',v_week.name||' official results are published.','final-result:'||new.week_id||':'||(entry->>'playerId')
    from jsonb_array_elements(new.rows) entry on conflict(source_key) do nothing;
  return new;
end $$;
create trigger cgl_hidden_gems_final_guard before insert on public.cgl_calculations
for each row execute function public.cgl_hidden_gems_final_guard();

create function public.cgl_hidden_gems_cash_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_season public.cgl_seasons; v_grade text; v_award text; v_amount int;
begin
  if new.kind<>'cash' then return new; end if;
  select * into v_season from public.cgl_seasons where id=new.season_id and config->>'regulation'='hidden-gems-2027-v1' for share;
  if not found then return new; end if;
  v_grade:=split_part(new.category,':',1); v_award:=split_part(new.category,':',2);
  v_amount:=(v_season.config#>>array['prize_cents',v_grade,v_award])::int;
  if v_season.ends_at is null or v_season.ends_at>=now() or v_amount is null or new.amount<>v_amount
    or new.source_key <> 'season-one-cash:'||new.season_id||':'||new.category
    or (select count(*) from public.cgl_weeks where season_id=new.season_id and phase='championship' and results_published)<>10 then
    raise exception 'Season 1 cash prizes require the approved amounts and ten final championship rounds';
  end if;
  return new;
end $$;
create trigger cgl_hidden_gems_cash_guard before insert or update on public.cgl_prizes
for each row execute function public.cgl_hidden_gems_cash_guard();

revoke all on function public.cgl_seed_season_one(jsonb,jsonb,text,text),public.cgl_save_event_enrolment(uuid,uuid,text,text[],text,text,text),
 public.cgl_update_event_review(uuid,text,uuid,text,text),public.cgl_record_qualifying_card(jsonb,text,text),public.cgl_hidden_gems_season_guard(),public.cgl_hidden_gems_week_guard(),
 public.cgl_hidden_gems_checkout_guard(),public.cgl_hidden_gems_final_guard(),public.cgl_hidden_gems_cash_guard(),
 public.cgl_verify_guest_sgt(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.cgl_seed_season_one(jsonb,jsonb,text,text),public.cgl_save_event_enrolment(uuid,uuid,text,text[],text,text,text),
 public.cgl_update_event_review(uuid,text,uuid,text,text),public.cgl_record_qualifying_card(jsonb,text,text),
 public.cgl_verify_guest_sgt(uuid,text,text,text,text,text) to service_role;

commit;
