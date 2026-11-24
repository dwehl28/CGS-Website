begin;

alter table public.cgl_qualifying_cards
  add column week_id uuid references public.cgl_weeks(id),
  add column gross integer check (gross > 0);
create unique index cgl_one_completed_qualifier on public.cgl_qualifying_cards(week_id,member_id) where week_id is not null;
create unique index cgl_one_event_per_qualifier on public.cgl_weeks(season_id,sgt_tournament_id)
  where phase='qualification' and config#>>'{course_a,segment}'='full_18';

-- Convert only untouched drafts. A linked or played legacy fixture needs review.
do $$
declare v_week public.cgl_weeks; v_course record;
begin
  for v_week in select w.* from public.cgl_weeks w join public.cgl_seasons s on s.id=w.season_id
    where s.config->>'regulation'='hidden-gems-2027-v1' and w.phase='qualification' and w.status='draft'
      and not w.results_published and w.sgt_tournament_id is null and w.config->'event_approved' is distinct from 'true'::jsonb
      and w.config#>>'{course_a,segment}' is distinct from 'full_18'
      and not exists(select 1 from public.cgl_results r where r.week_id=w.id)
      and not exists(select 1 from public.cgl_event_enrolments e where e.week_id=w.id)
    order by w.id for update of w
  loop
    select * into v_course from (values (1,'Club Sports Belvédère',72),(2,'Trail Creek Golf Course',72),(3,'Gilbert Plains Country Club',71)) as q(n,name,par) where n=v_week.week_number;
    perform public.cgl_admin_save('week',jsonb_build_object('id',v_week.id,'course_name',v_course.name,'second_course_name',null,
      'conditions','{"format":"Individual stroke play","holes":18,"teeCategory":"Regular","targetYards":[6000,6300],"wind":"Calm","fairwayFirmness":"Medium","greenFirmness":"Medium","greenSpeed":10,"pinDifficulty":"Standard / medium","weather":"Clear","mulligans":false,"attempts":1}'::jsonb,
      'config',(v_week.config-array['course_b','sgt_tournament_b_id','ctp_hole'])||jsonb_build_object('event_approved',false,'course_verification','required','conditions_verification','required','course_a',jsonb_build_object('name',v_course.name,'par',v_course.par,'segment','full_18','verified',false))),
      'migration:qualifiers','Adopt the approved one-course qualification format; dates and status are unchanged');
  end loop;
end $$;

alter function public.cgl_hidden_gems_week_guard() rename to cgl_hidden_gems_two_nine_guard;
drop trigger cgl_hidden_gems_week_guard on public.cgl_weeks;
create trigger cgl_hidden_gems_two_nine_guard before insert or update on public.cgl_weeks
for each row when (new.phase<>'qualification') execute function public.cgl_hidden_gems_two_nine_guard();

create function public.cgl_full_qualifier_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_season public.cgl_seasons; v_course jsonb:=new.config->'course_a'; v_play jsonb:=new.config->'verified_play_settings';
begin
  select * into v_season from public.cgl_seasons where id=new.season_id;
  if v_season.config->>'regulation' is distinct from 'hidden-gems-2027-v1' or new.status='draft' then return new; end if;
  if v_season.status='draft' or new.config->'event_approved' is distinct from 'true'::jsonb
    or new.opens_at is null or new.closes_at is null or new.opens_at<v_season.starts_at or new.closes_at>v_season.ends_at
    or new.opens_at is distinct from (new.config->>'verified_opens_at')::timestamptz
    or new.closes_at is distinct from (new.config->>'verified_closes_at')::timestamptz
    or new.sgt_tournament_id is null or new.sgt_tournament_id !~ '^[0-9]+$'
    or new.second_course_name is not null or new.config->>'sgt_tournament_b_id' is not null
    or v_course->>'segment' is distinct from 'full_18' or v_course->'verified' is distinct from 'true'::jsonb
    or nullif(v_course->>'sgtCourseId','') is null or nullif(v_course->>'version','') is null or nullif(v_course->>'tee','') is null
    or (v_course->>'yards')::integer is null or (v_course->>'par')::integer is null
    or new.config->'handicap_counting_verified' is distinct from 'true'::jsonb
    or v_play is null or v_play is distinct from v_season.config->'qualifier_play_settings'
    or not (v_play ?& array['pins','putting','gimmies'])
    or not (new.conditions @> '{"format":"Individual stroke play","holes":18,"wind":"Calm","fairwayFirmness":"Medium","greenFirmness":"Medium","greenSpeed":10,"weather":"Clear","mulligans":false,"attempts":1}'::jsonb) then
    raise exception 'Approve the single 18-hole SGT qualifier, exact window, course build, tee and handicap settings before release';
  end if;
  if tg_op='UPDATE' and old.status<>'draft' and (old.config->'course_a',old.sgt_tournament_id,old.conditions,old.config->'verified_play_settings')
    is distinct from (new.config->'course_a',new.sgt_tournament_id,new.conditions,new.config->'verified_play_settings') then
    raise exception 'Return the qualifier to draft before changing its approved setup';
  end if;
  return new;
end $$;
create trigger cgl_full_qualifier_guard before insert or update on public.cgl_weeks
for each row when (new.phase='qualification') execute function public.cgl_full_qualifier_guard();

create function public.cgl_full_qualifier_card_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_week public.cgl_weeks;
begin
  if new.week_id is null then return new; end if;
  select * into v_week from public.cgl_weeks where id=new.week_id for share;
  if not found or v_week.season_id<>new.season_id or v_week.phase<>'qualification' or v_week.status='draft'
    or v_week.config#>>'{course_a,segment}' is distinct from 'full_18'
    or new.holes<>18 or new.gross is null or new.played_at<v_week.opens_at or new.played_at>=v_week.closes_at+interval '1 second'
    or not exists(select 1 from public.cgl_event_enrolments e where e.week_id=v_week.id and e.member_id=new.member_id
      and e.sgt_player_id=new.sgt_player_id and e.event_ids=array[v_week.sgt_tournament_id] and e.state='confirmed' and e.confirmed_at<=new.played_at) then
    raise exception 'A complete verified 18-hole scorecard and prior confirmed SGT enrolment are required';
  end if;
  return new;
end $$;
create trigger cgl_full_qualifier_card_guard before insert or update on public.cgl_qualifying_cards
for each row execute function public.cgl_full_qualifier_card_guard();

create function public.cgl_qualifier_notice() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_name text;
begin
  select w.name into v_name from public.cgl_weeks w where w.id::text=split_part(new.source_key,':',2)
    and w.phase='qualification' and w.config#>>'{course_a,segment}'='full_18';
  if found then
    new.body:=v_name||': you are enrolled in SGT. Play holes 1–18 on the approved course within the published window.';
  end if;
  return new;
end $$;
create trigger cgl_qualifier_notice before insert on public.cgl_notifications
for each row when (new.kind='sgt_enrolment' and new.source_key like 'sgt-enrolment:%') execute function public.cgl_qualifier_notice();

revoke all on function public.cgl_full_qualifier_guard(),public.cgl_full_qualifier_card_guard(),public.cgl_qualifier_notice() from public,anon,authenticated;
commit;
