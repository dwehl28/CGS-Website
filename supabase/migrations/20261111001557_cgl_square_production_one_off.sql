-- Guarded production support for verified one-off CGL payments.
-- Recurring production memberships remain disabled until provider verification.
begin;

alter table public.cgl_square_checkout_intents
  drop constraint if exists cgl_square_checkout_intents_environment_check;
alter table public.cgl_square_checkout_intents
  add constraint cgl_square_checkout_intents_environment_check
  check (environment in ('sandbox','production'));

alter table public.cgl_square_webhook_events
  drop constraint if exists cgl_square_webhook_events_environment_check;
alter table public.cgl_square_webhook_events
  add constraint cgl_square_webhook_events_environment_check
  check (environment in ('sandbox','production'));

alter table public.cgl_square_invoice_states
  drop constraint if exists cgl_square_invoice_states_environment_check;
alter table public.cgl_square_invoice_states
  add constraint cgl_square_invoice_states_environment_check
  check (environment in ('sandbox','production'));

alter table public.cgl_square_season_entitlements
  drop constraint if exists cgl_square_season_entitlements_environment_check;
alter table public.cgl_square_season_entitlements
  add constraint cgl_square_season_entitlements_environment_check
  check (environment in ('sandbox','production'));

alter table public.cgl_square_season_entitlements
  drop constraint if exists cgl_square_season_entitlements_member_id_season_id_key;
alter table public.cgl_square_season_entitlements
  add constraint cgl_square_season_entitlements_member_season_environment_key
  unique(member_id,season_id,environment);

create index if not exists cgl_payments_membership_idx
  on public.cgl_payments(membership_id);
create index if not exists cgl_payments_season_idx
  on public.cgl_payments(season_id);
create index if not exists cgl_square_checkout_membership_idx
  on public.cgl_square_checkout_intents(membership_id);
create index if not exists cgl_square_checkout_plan_idx
  on public.cgl_square_checkout_intents(plan_code);
create index if not exists cgl_square_checkout_season_idx
  on public.cgl_square_checkout_intents(season_id);
create index if not exists cgl_square_entitlement_season_idx
  on public.cgl_square_season_entitlements(season_id);

insert into public.cgl_settings(key,value)
values ('square_production','{"environment":"production","checkout_enabled":false,"recurring_enabled":false,"live_entitlements":true,"launch_approved":false}')
on conflict(key) do nothing;

update public.cgl_settings
set value = value || jsonb_build_object(
  'mode','season_boundary',
  'annual_mode','paid_term',
  'approved',true,
  'version','cgl-cancellation-2026-11-11',
  'approved_at','2026-11-11T00:00:00+10:00'
), updated_at=now(), updated_by='owner-confirmed-launch-policy'
where key='cancellation_policy';

-- Keep the existing Sandbox test path isolated after production rows become valid.
create or replace function public.cgl_prepare_square_checkout(
  p_member_id uuid,
  p_plan_code text,
  p_season_id uuid,
  p_request_key uuid,
  p_accepted_amount_cents integer default null
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_plan public.cgl_plans%rowtype;
  v_intent public.cgl_square_checkout_intents%rowtype;
  v_membership_id uuid;
  v_legal jsonb;
begin
  perform 1 from public.cgl_members where id=p_member_id for update;
  if not found then raise exception 'CGL member profile required'; end if;
  select value into v_legal from public.cgl_settings where key='legal';
  if not coalesce((
    select (value->>'testing_enabled')::boolean
    from public.cgl_settings where key='square_sandbox'
  ),false) then raise exception 'Square Sandbox testing is not enabled'; end if;

  select * into v_intent
  from public.cgl_square_checkout_intents
  where request_key=p_request_key
  for update;
  if found then
    if v_intent.environment<>'sandbox'
      or v_intent.member_id<>p_member_id
      or v_intent.plan_code<>p_plan_code
      or v_intent.season_id is distinct from p_season_id then
      raise exception 'Idempotency key belongs to another request';
    end if;
    if p_accepted_amount_cents is not null and p_accepted_amount_cents<>v_intent.amount_cents then
      raise exception 'The quoted amount has changed; request a fresh quote';
    end if;
    if v_intent.state<>'pending' then raise exception 'Checkout already completed or requires review'; end if;
    return to_jsonb(v_intent);
  end if;

  select * into v_plan from public.cgl_plans where code=p_plan_code and active;
  if not found or v_plan.price_cents<1 then raise exception 'CGL plan unavailable'; end if;
  if p_accepted_amount_cents is not null and p_accepted_amount_cents<>v_plan.price_cents then
    raise exception 'The quoted amount has changed; request a fresh quote';
  end if;
  if coalesce((v_plan.config->>'proration_required')::boolean,false) then
    raise exception 'Prorated provider checkout requires reconciliation';
  end if;
  if v_plan.auto_renew and nullif(v_plan.config->>'square_plan_variation_id','') is null then
    raise exception 'Square variation not configured';
  end if;

  select * into v_intent
  from public.cgl_square_checkout_intents
  where member_id=p_member_id and environment='sandbox' and plan_code=p_plan_code
    and season_id is not distinct from p_season_id and state='pending'
  order by created_at limit 1;
  if found then
    if p_accepted_amount_cents is not null and p_accepted_amount_cents<>v_intent.amount_cents then
      raise exception 'The quoted amount has changed; request a fresh quote';
    end if;
    return to_jsonb(v_intent);
  end if;

  if v_plan.full_member and exists(
    select 1 from public.cgl_memberships m
    join public.cgl_plans p on p.code=m.plan_code
    where m.member_id=p_member_id and m.metadata->>'environment'='sandbox'
      and p.full_member and m.state in ('pending','active','past_due','cancel_scheduled')
      and (m.paid_through is null or m.paid_through>now())
  ) then raise exception 'Existing Sandbox full membership must be reconciled before a new subscription'; end if;
  if p_plan_code='casual_registration' and exists(
    select 1 from public.cgl_memberships
    where member_id=p_member_id and metadata->>'environment'='sandbox'
      and plan_code=p_plan_code and state in ('pending','active')
      and (paid_through is null or paid_through>now())
  ) then raise exception 'Casual registration is already current or pending'; end if;
  if p_plan_code='casual_season' then
    if p_season_id is null or not exists(
      select 1 from public.cgl_seasons where id=p_season_id
        and status in ('registration','published','active')
        and (ends_at is null or ends_at>now())
    ) then raise exception 'Choose an open season'; end if;
    if not exists(
      select 1 from public.cgl_memberships
      where member_id=p_member_id and metadata->>'environment'='sandbox'
        and plan_code='casual_registration' and state='active' and paid_through>now()
    ) then raise exception 'Current paid Sandbox casual registration required'; end if;
    if exists(
      select 1 from public.cgl_square_season_entitlements
      where member_id=p_member_id and season_id=p_season_id
        and environment='sandbox' and expires_at>now()
    ) then raise exception 'Sandbox season entry is already current'; end if;
  elsif p_season_id is not null then
    raise exception 'This purchase is not a season entry';
  end if;

  insert into public.cgl_memberships(member_id,plan_code,state,metadata)
  values(
    p_member_id,p_plan_code,'pending',
    jsonb_build_object(
      'environment','sandbox',
      'square_plan_variation_id',v_plan.config->>'square_plan_variation_id',
      'price_cents',v_plan.price_cents
    )
  ) returning id into v_membership_id;
  insert into public.cgl_square_checkout_intents(
    member_id,membership_id,environment,plan_code,season_id,request_key,
    amount_cents,recurring,square_plan_variation_id,terms_snapshot
  ) values(
    p_member_id,v_membership_id,'sandbox',p_plan_code,p_season_id,p_request_key,
    v_plan.price_cents,v_plan.auto_renew,v_plan.config->>'square_plan_variation_id',
    jsonb_build_object(
      'environment','sandbox','test_only',true,'legal',v_legal,
      'cancellation_policy',(select value from public.cgl_settings where key='cancellation_policy')
    )
  ) returning * into v_intent;
  return to_jsonb(v_intent);
end $$;

-- The existing Sandbox reconciler inserts the same entitlement table. Retarget
-- its conflict guard to the new environment-aware key without duplicating the
-- large, already-tested reconciliation function in this additive migration.
do $migration$
declare
  v_definition text;
  v_old text:='on conflict(member_id,season_id) do nothing';
  v_new text:='on conflict(member_id,season_id,environment) do nothing';
begin
  select pg_get_functiondef(
    'public.cgl_reconcile_square_event(text,text,timestamptz,text,jsonb,uuid)'::regprocedure
  ) into v_definition;
  if strpos(v_definition,v_old)=0 then
    raise exception 'Existing Sandbox entitlement conflict guard was not found';
  end if;
  execute replace(v_definition,v_old,v_new);
end $migration$;

create function public.cgl_prepare_square_live_checkout(
  p_member_id uuid,
  p_plan_code text,
  p_season_id uuid,
  p_request_key uuid,
  p_accepted_amount_cents integer default null
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_plan public.cgl_plans%rowtype;
  v_intent public.cgl_square_checkout_intents%rowtype;
  v_membership_id uuid;
  v_legal jsonb;
  v_policy jsonb;
  v_live jsonb;
begin
  perform 1 from public.cgl_members where id=p_member_id for update;
  if not found then raise exception 'CGL member profile required'; end if;

  select value into v_legal from public.cgl_settings where key='legal';
  select value into v_policy from public.cgl_settings where key='cancellation_policy';
  select value into v_live from public.cgl_settings where key='square_production';
  if not coalesce((v_live->>'checkout_enabled')::boolean,false)
    or not coalesce((v_live->>'launch_approved')::boolean,false) then
    raise exception 'Square production checkout is not approved';
  end if;
  if not coalesce((v_legal->>'approved')::boolean,false)
    or nullif(v_legal->>'version','') is null then
    raise exception 'Published membership terms are required';
  end if;
  if not coalesce((v_policy->>'approved')::boolean,false) then
    raise exception 'Cancellation policy approval is required';
  end if;

  select * into v_intent
  from public.cgl_square_checkout_intents
  where request_key=p_request_key
  for update;
  if found then
    if v_intent.environment<>'production'
      or v_intent.member_id<>p_member_id
      or v_intent.plan_code<>p_plan_code
      or v_intent.season_id is distinct from p_season_id then
      raise exception 'Idempotency key belongs to another request';
    end if;
    if p_accepted_amount_cents is not null and p_accepted_amount_cents<>v_intent.amount_cents then
      raise exception 'The quoted amount has changed; request a fresh quote';
    end if;
    if v_intent.state<>'pending' then raise exception 'Checkout already completed or requires review'; end if;
    return to_jsonb(v_intent);
  end if;

  select * into v_plan from public.cgl_plans where code=p_plan_code and active;
  if not found or v_plan.price_cents<1 then raise exception 'CGL plan unavailable'; end if;
  if v_plan.auto_renew or p_plan_code not in ('casual_registration','casual_season') then
    raise exception 'Recurring Square memberships are not enabled for production';
  end if;
  if p_accepted_amount_cents is not null and p_accepted_amount_cents<>v_plan.price_cents then
    raise exception 'The quoted amount has changed; request a fresh quote';
  end if;

  select * into v_intent
  from public.cgl_square_checkout_intents
  where member_id=p_member_id and environment='production' and plan_code=p_plan_code
    and season_id is not distinct from p_season_id and state='pending'
  order by created_at limit 1 for update;
  if found then return to_jsonb(v_intent); end if;

  if p_plan_code='casual_registration' then
    if p_season_id is not null then raise exception 'This purchase is not a season entry'; end if;
    if exists(
      select 1 from public.cgl_memberships
      where member_id=p_member_id and metadata->>'environment'='production'
        and plan_code=p_plan_code and state in ('pending','active')
        and (paid_through is null or paid_through>now())
    ) then raise exception 'Casual registration is already current or pending'; end if;
  else
    if p_season_id is null or not exists(
      select 1 from public.cgl_seasons where id=p_season_id
        and status in ('registration','published','active')
        and (ends_at is null or ends_at>now())
    ) then raise exception 'Choose an open season'; end if;
    if not exists(
      select 1 from public.cgl_memberships
      where member_id=p_member_id and metadata->>'environment'='production'
        and plan_code='casual_registration' and state='active' and paid_through>now()
    ) then raise exception 'Current paid casual registration required'; end if;
    if exists(
      select 1 from public.cgl_square_season_entitlements
      where member_id=p_member_id and season_id=p_season_id
        and environment='production' and expires_at>now()
    ) then raise exception 'Season entry is already current'; end if;
  end if;

  insert into public.cgl_memberships(member_id,plan_code,state,metadata)
  values(
    p_member_id,p_plan_code,'pending',
    jsonb_build_object('environment','production','price_cents',v_plan.price_cents)
  ) returning id into v_membership_id;

  insert into public.cgl_square_checkout_intents(
    member_id,membership_id,environment,plan_code,season_id,request_key,
    amount_cents,recurring,square_plan_variation_id,terms_snapshot
  ) values(
    p_member_id,v_membership_id,'production',p_plan_code,p_season_id,p_request_key,
    v_plan.price_cents,false,null,
    jsonb_build_object(
      'environment','production','test_only',false,
      'terms_version',v_legal->>'version','legal',v_legal,
      'cancellation_policy',v_policy
    )
  ) returning * into v_intent;
  return to_jsonb(v_intent);
end $$;

create function public.cgl_enqueue_square_live_event(
  p_event_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_body_hash text,
  p_event_data jsonb
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_event public.cgl_square_webhook_events;
  v_duplicate boolean:=false;
begin
  if p_event_data->>'environment' is distinct from 'production'
    or length(p_event_id) not between 1 and 255
    or length(p_body_hash) not between 16 and 128 then
    raise exception 'Invalid production event envelope';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cgl-square:'||p_event_id,0));
  select * into v_event from public.cgl_square_webhook_events where event_id=p_event_id for update;
  if found then
    if v_event.environment<>'production' or v_event.body_hash<>p_body_hash or v_event.event_type<>p_event_type then
      raise exception 'Square event payload changed';
    end if;
    v_duplicate:=true;
    if v_event.state in ('unmatched','review') then
      update public.cgl_square_webhook_events
      set state='queued',next_attempt_at=now(),lease_token=null,lease_until=null
      where event_id=p_event_id;
    end if;
  else
    insert into public.cgl_square_webhook_events(
      event_id,event_type,occurred_at,body_hash,environment,event_data
    ) values(
      p_event_id,p_event_type,p_occurred_at,p_body_hash,'production',
      jsonb_build_object(
        'environment','production','object_id',p_event_data->>'object_id',
        'merchant_id',p_event_data->>'merchant_id','object_type',p_event_data->>'object_type'
      )
    );
  end if;
  return (
    select jsonb_build_object(
      'event_id',event_id,'state',state,'duplicate',v_duplicate,
      'queued',state in ('queued','retry')
    ) from public.cgl_square_webhook_events where event_id=p_event_id
  );
end $$;

create function public.cgl_claim_square_live_events(
  p_event_id text default null,
  p_limit integer default 10,
  p_environment text default 'production'
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_event public.cgl_square_webhook_events;
  v_result jsonb:='[]';
  v_token uuid;
begin
  if p_environment<>'production' then raise exception 'Invalid live Square environment'; end if;
  if p_limit<1 or p_limit>25 then raise exception 'Claim limit must be 1-25'; end if;
  for v_event in
    select * from public.cgl_square_webhook_events
    where environment=p_environment and (p_event_id is null or event_id=p_event_id)
      and (
        (state in ('queued','retry') and next_attempt_at<=now() and (attempts<8 or p_event_id is not null))
        or (state='processing' and lease_until<=now())
        or (p_event_id is not null and state in ('unmatched','review'))
      )
    order by next_attempt_at,created_at limit p_limit for update skip locked
  loop
    v_token:=gen_random_uuid();
    update public.cgl_square_webhook_events
    set state='processing',lease_token=v_token,lease_until=now()+interval '2 minutes',attempts=attempts+1
    where event_id=v_event.event_id;
    v_result:=v_result||jsonb_build_array(jsonb_build_object(
      'event_id',v_event.event_id,'event_type',v_event.event_type,
      'occurred_at',v_event.occurred_at,'body_hash',v_event.body_hash,
      'event_data',v_event.event_data,'lease_token',v_token,'attempts',v_event.attempts+1
    ));
  end loop;
  return v_result;
end $$;

create function public.cgl_reconcile_square_live_event(
  p_event_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_body_hash text,
  p_normalized jsonb,
  p_lease_token uuid default null
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_event public.cgl_square_webhook_events;
  v_intent public.cgl_square_checkout_intents;
  v_membership public.cgl_memberships;
  v_payment public.cgl_payments;
  v_season public.cgl_seasons;
  v_link jsonb:=p_normalized->'checkout_link';
  v_item jsonb;
  v_external text;
  v_state text;
  v_amount integer;
  v_refunded integer;
  v_paid_at timestamptz;
  v_updated timestamptz;
  v_expires timestamptz;
  v_matched boolean:=false;
  v_review boolean:=false;
begin
  if p_normalized->>'environment' is distinct from 'production' then
    raise exception 'Only verified production reconciliation is accepted';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('cgl-square:'||p_event_id,0));
  select * into v_event from public.cgl_square_webhook_events where event_id=p_event_id for update;
  if not found or v_event.environment<>'production'
    or v_event.body_hash<>p_body_hash or v_event.event_type<>p_event_type then
    raise exception 'Square event envelope changed';
  end if;
  if p_lease_token is not null and (
    v_event.lease_token is distinct from p_lease_token or v_event.state<>'processing'
  ) then raise exception 'Square worker lease lost'; end if;
  if v_event.state in ('reconciled','ignored') then
    return jsonb_build_object('duplicate',true,'state',v_event.state);
  end if;

  if nullif(v_link->>'intent_id','') is not null then
    select * into v_intent from public.cgl_square_checkout_intents
    where id::text=v_link->>'intent_id' for update;
    if v_intent.id is null or v_intent.environment<>'production' or v_intent.recurring
      or v_intent.square_order_id is distinct from v_link->>'order_id'
      or v_intent.member_id::text is distinct from v_link->>'member_id'
      or v_intent.membership_id::text is distinct from v_link->>'membership_id' then
      v_review:=true;
    else
      select * into v_membership from public.cgl_memberships
      where id=v_intent.membership_id for update;
      if v_membership.id is null or v_membership.member_id<>v_intent.member_id
        or v_membership.metadata->>'environment' is distinct from 'production' then
        v_review:=true;
      end if;
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_normalized->'payments','[]')) loop
    if v_intent.id is null or v_membership.id is null then continue; end if;
    if v_item->>'order_id' is distinct from v_intent.square_order_id then
      v_review:=true; continue;
    end if;
    v_amount:=coalesce((v_item->>'amount_cents')::integer,-1);
    v_refunded:=coalesce((v_item->>'refunded_cents')::integer,0);
    if v_item->>'currency' is distinct from 'AUD' or v_amount<>v_intent.amount_cents
      or v_refunded<0 or v_refunded>v_amount then
      v_review:=true; continue;
    end if;
    v_external:='square:production:'||(v_item->>'id');
    select * into v_payment from public.cgl_payments where external_id=v_external for update;
    if v_payment.id is not null and (
      v_payment.member_id<>v_membership.member_id
      or v_payment.membership_id<>v_membership.id
      or v_payment.amount_cents<>v_amount
      or v_payment.metadata->>'square_order_id' is distinct from v_item->>'order_id'
    ) then v_review:=true; continue; end if;

    v_paid_at:=coalesce(nullif(v_item->>'paid_at','')::timestamptz,p_occurred_at);
    v_updated:=coalesce(nullif(v_item->>'updated_at','')::timestamptz,p_occurred_at);
    v_state:=case
      when v_refunded>=v_amount and v_refunded>0 then 'refunded'
      when v_item->>'state'='COMPLETED' then 'completed'
      when v_item->>'state' in ('FAILED','CANCELED') then 'failed'
      else 'pending'
    end;

    if v_payment.id is null then
      insert into public.cgl_payments(
        member_id,membership_id,season_id,external_id,idempotency_key,kind,
        amount_cents,fee_cents,state,paid_at,metadata
      ) values(
        v_membership.member_id,v_membership.id,v_intent.season_id,v_external,v_external,
        v_intent.plan_code,v_amount,coalesce((v_item->>'fee_cents')::integer,0),v_state,
        case when v_state in ('completed','refunded') then v_paid_at else null end,
        jsonb_build_object(
          'environment','production','square_order_id',v_item->>'order_id',
          'receipt_url',v_item->>'receipt_url','provider_updated_at',v_updated,
          'version_token',v_item->>'version_token','refunded_cents',v_refunded,
          'entitlement_applied',false
        )
      ) returning * into v_payment;
    else
      update public.cgl_payments set
        state=case when state='refunded' then state else v_state end,
        paid_at=case when v_state='completed' then coalesce(paid_at,v_paid_at) else paid_at end,
        fee_cents=coalesce((v_item->>'fee_cents')::integer,fee_cents),
        metadata=metadata||jsonb_build_object(
          'provider_updated_at',v_updated,'version_token',v_item->>'version_token',
          'refunded_cents',greatest(coalesce((metadata->>'refunded_cents')::integer,0),v_refunded)
        )
      where id=v_payment.id returning * into v_payment;
    end if;
    v_matched:=true;

    if v_refunded>0 then
      update public.cgl_memberships set
        metadata=metadata||jsonb_build_object(
          'entitlement_review_required',true,
          'review_reason','Refunded production payment requires reconciliation'
        ), updated_at=now()
      where id=v_membership.id;
      update public.cgl_square_checkout_intents set state='review' where id=v_intent.id;
      v_review:=true;
      continue;
    end if;

    if v_state='completed' then
      if v_intent.plan_code='casual_registration' then
        v_expires:=v_paid_at+interval '1 year';
        update public.cgl_memberships set
          state='active',starts_at=coalesce(starts_at,v_paid_at),
          paid_through=greatest(coalesce(paid_through,v_expires),v_expires),
          next_billing_at=null,failed_at=null,updated_at=now(),
          metadata=metadata||jsonb_build_object('entitlement_applied',true)
        where id=v_membership.id;
      elsif v_intent.plan_code='casual_season' and v_intent.season_id is not null then
        select * into v_season from public.cgl_seasons where id=v_intent.season_id for update;
        if v_season.id is null or v_season.ends_at is null or v_season.ends_at<=v_paid_at then
          v_review:=true; continue;
        end if;
        v_expires:=v_season.ends_at;
        update public.cgl_memberships set
          state='active',starts_at=coalesce(starts_at,v_paid_at),paid_through=v_expires,
          next_billing_at=null,failed_at=null,updated_at=now(),
          metadata=metadata||jsonb_build_object('entitlement_applied',true)
        where id=v_membership.id;
        insert into public.cgl_square_season_entitlements(
          checkout_id,member_id,season_id,environment,paid_at,expires_at
        ) values(
          v_intent.id,v_membership.member_id,v_intent.season_id,'production',v_paid_at,v_expires
        ) on conflict(checkout_id) do nothing;
        insert into public.cgl_season_entries(
          member_id,season_id,state,source,paid_at,metadata
        ) values(
          v_membership.member_id,v_intent.season_id,'active','square',v_paid_at,
          jsonb_build_object('environment','production','checkout_id',v_intent.id)
        ) on conflict(member_id,season_id) do update set
          state='active',source='square',paid_at=coalesce(public.cgl_season_entries.paid_at,excluded.paid_at),
          metadata=public.cgl_season_entries.metadata||excluded.metadata;
      else
        v_review:=true; continue;
      end if;
      update public.cgl_payments set metadata=metadata||jsonb_build_object('entitlement_applied',true)
      where id=v_payment.id;
      update public.cgl_square_checkout_intents
      set state='completed',completed_at=coalesce(completed_at,v_paid_at)
      where id=v_intent.id;
    elsif v_state='failed' then
      update public.cgl_memberships set failed_at=v_updated,updated_at=now()
      where id=v_membership.id and state='pending';
    end if;
  end loop;

  update public.cgl_square_webhook_events set
    state=case
      when v_review then 'review'
      when v_matched then 'reconciled'
      when jsonb_array_length(coalesce(p_normalized->'payments','[]'))=0 then 'ignored'
      else 'unmatched'
    end,
    normalized=p_normalized,
    processed_at=now(),lease_token=null,lease_until=null,
    review_reason=case
      when v_review then 'Production payment requires administrator review'
      when not v_matched and jsonb_array_length(coalesce(p_normalized->'payments','[]'))>0
        then 'No verified production checkout matched this payment'
      else null
    end
  where event_id=p_event_id;

  return (
    select jsonb_build_object('duplicate',false,'state',state)
    from public.cgl_square_webhook_events where event_id=p_event_id
  );
end $$;

revoke all on function public.cgl_prepare_square_live_checkout(uuid,text,uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.cgl_enqueue_square_live_event(text,text,timestamptz,text,jsonb) from public,anon,authenticated;
revoke all on function public.cgl_claim_square_live_events(text,integer,text) from public,anon,authenticated;
revoke all on function public.cgl_reconcile_square_live_event(text,text,timestamptz,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.cgl_prepare_square_live_checkout(uuid,text,uuid,uuid,integer) to service_role;
grant execute on function public.cgl_enqueue_square_live_event(text,text,timestamptz,text,jsonb) to service_role;
grant execute on function public.cgl_claim_square_live_events(text,integer,text) to service_role;
grant execute on function public.cgl_reconcile_square_live_event(text,text,timestamptz,text,jsonb,uuid) to service_role;

commit;
