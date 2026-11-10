-- Additive, Sandbox-only billing records. Apply after the CGL foundation migration.
-- No CGS profile, Auth user, event registration or trial result is modified.
create table public.cgl_square_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.cgl_members(id),
  membership_id uuid not null references public.cgl_memberships(id),
  environment text not null default 'sandbox' check(environment='sandbox'),
  plan_code text not null references public.cgl_plans(code),
  season_id uuid references public.cgl_seasons(id),
  request_key uuid not null unique,
  amount_cents integer not null check (amount_cents > 0),
  recurring boolean not null,
  square_plan_variation_id text,
  square_link_id text unique,
  square_order_id text unique,
  payment_link_url text,
  state text not null default 'pending' check (state in ('pending','completed','review','cancelled')),
  terms_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index cgl_square_checkout_member_idx on public.cgl_square_checkout_intents(member_id,created_at desc);
create table public.cgl_square_webhook_events (
  event_id text primary key,
  event_type text not null,
  occurred_at timestamptz not null,
  body_hash text not null,
  environment text not null default 'sandbox' check(environment='sandbox'),
  event_data jsonb not null default '{}',
  normalized jsonb not null default '{}',
  state text not null default 'queued' check (state in ('queued','processing','retry','reconciled','unmatched','review','ignored')),
  attempts integer not null default 0 check(attempts>=0),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid, lease_until timestamptz, last_error_code text,
  review_reason text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index cgl_square_webhook_review_idx on public.cgl_square_webhook_events(state,created_at);
create index cgl_square_webhook_queue_idx on public.cgl_square_webhook_events(next_attempt_at,created_at) where state in ('queued','retry','processing');
create table public.cgl_square_invoice_states (
  id text primary key, membership_id uuid not null references public.cgl_memberships(id),
  environment text not null default 'sandbox' check(environment='sandbox'),
  subscription_id text not null, order_id text not null unique,
  version bigint not null default 0, state text not null,
  provider_updated_at timestamptz not null, failed_at timestamptz,
  period_start_date date, period_end_date_exclusive date,
  amount_cents integer not null check(amount_cents>=0), completed_cents integer not null check(completed_cents>=0),
  created_at timestamptz not null default now(), metadata jsonb not null default '{}'
);
create index cgl_square_invoice_membership_idx on public.cgl_square_invoice_states(membership_id,failed_at);
create table public.cgl_square_season_entitlements (
  checkout_id uuid primary key references public.cgl_square_checkout_intents(id),
  member_id uuid not null references public.cgl_members(id), season_id uuid not null references public.cgl_seasons(id),
  environment text not null default 'sandbox' check(environment='sandbox'), paid_at timestamptz not null,
  expires_at timestamptz not null, unique(member_id,season_id)
);
alter table public.cgl_square_checkout_intents enable row level security;
alter table public.cgl_square_webhook_events enable row level security;
alter table public.cgl_square_invoice_states enable row level security;
alter table public.cgl_square_season_entitlements enable row level security;
revoke all on public.cgl_square_checkout_intents, public.cgl_square_webhook_events,public.cgl_square_invoice_states,public.cgl_square_season_entitlements from public,anon,authenticated;
grant all on public.cgl_square_checkout_intents, public.cgl_square_webhook_events,public.cgl_square_invoice_states,public.cgl_square_season_entitlements to service_role;
insert into public.cgl_settings(key,value) values('square_sandbox','{"testing_enabled":false,"environment":"sandbox","live_entitlements":false}') on conflict(key) do nothing;

create or replace function public.cgl_prepare_square_checkout(p_member_id uuid,p_plan_code text,p_season_id uuid,p_request_key uuid,p_accepted_amount_cents integer default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_plan public.cgl_plans%rowtype;
  v_intent public.cgl_square_checkout_intents%rowtype;
  v_membership_id uuid;
  v_legal jsonb;
begin
  perform 1 from public.cgl_members where id=p_member_id for update;
  if not found then raise exception 'CGL member profile required'; end if;
  select value into v_legal from public.cgl_settings where key='legal';
  if not coalesce((select (value->>'testing_enabled')::boolean from public.cgl_settings where key='square_sandbox'),false) then raise exception 'Square Sandbox testing is not enabled'; end if;
  select * into v_intent from public.cgl_square_checkout_intents where request_key=p_request_key for update;
  if found then
    if v_intent.member_id<>p_member_id or v_intent.plan_code<>p_plan_code or v_intent.season_id is distinct from p_season_id then raise exception 'Idempotency key belongs to another request'; end if;
    if p_accepted_amount_cents is not null and p_accepted_amount_cents<>v_intent.amount_cents then raise exception 'The quoted amount has changed; request a fresh quote'; end if;
    if v_intent.state<>'pending' then raise exception 'Checkout already completed or requires review'; end if;
    return to_jsonb(v_intent);
  end if;
  select * into v_plan from public.cgl_plans where code=p_plan_code and active;
  if not found or v_plan.price_cents<1 then raise exception 'CGL plan unavailable'; end if;
  if p_accepted_amount_cents is not null and p_accepted_amount_cents<>v_plan.price_cents then raise exception 'The quoted amount has changed; request a fresh quote'; end if;
  if coalesce((v_plan.config->>'proration_required')::boolean,false) then raise exception 'Prorated provider checkout requires reconciliation'; end if;
  if v_plan.auto_renew and nullif(v_plan.config->>'square_plan_variation_id','') is null then raise exception 'Square variation not configured'; end if;
  -- A refreshed browser can recover the original pending checkout instead of creating a second subscription.
  select * into v_intent from public.cgl_square_checkout_intents where member_id=p_member_id and plan_code=p_plan_code and season_id is not distinct from p_season_id and state='pending' order by created_at limit 1;
  if found then
    if p_accepted_amount_cents is not null and p_accepted_amount_cents<>v_intent.amount_cents then raise exception 'The quoted amount has changed; request a fresh quote'; end if;
    return to_jsonb(v_intent);
  end if;
  if v_plan.full_member and exists(select 1 from public.cgl_memberships m join public.cgl_plans p on p.code=m.plan_code where m.member_id=p_member_id and m.metadata->>'environment'='sandbox' and p.full_member and m.state in ('pending','active','past_due','cancel_scheduled') and (m.paid_through is null or m.paid_through>now())) then raise exception 'Existing Sandbox full membership must be reconciled before a new subscription'; end if;
  if p_plan_code='casual_registration' and exists(select 1 from public.cgl_memberships where member_id=p_member_id and metadata->>'environment'='sandbox' and plan_code=p_plan_code and state in ('pending','active') and (paid_through is null or paid_through>now())) then raise exception 'Casual registration is already current or pending'; end if;
  if p_plan_code='casual_season' then
    if p_season_id is null or not exists(select 1 from public.cgl_seasons where id=p_season_id and status in ('registration','published','active') and (ends_at is null or ends_at>now())) then raise exception 'Choose an open season'; end if;
    if not exists(select 1 from public.cgl_memberships where member_id=p_member_id and metadata->>'environment'='sandbox' and plan_code='casual_registration' and state='active' and paid_through>now()) then raise exception 'Current paid Sandbox casual registration required'; end if;
    if exists(select 1 from public.cgl_square_season_entitlements where member_id=p_member_id and season_id=p_season_id and expires_at>now()) then raise exception 'Sandbox season entry is already current'; end if;
  elsif p_season_id is not null then raise exception 'This purchase is not a season entry'; end if;
  insert into public.cgl_memberships(member_id,plan_code,state,metadata)
    values(p_member_id,p_plan_code,'pending',jsonb_build_object('environment','sandbox','square_plan_variation_id',v_plan.config->>'square_plan_variation_id','price_cents',v_plan.price_cents)) returning id into v_membership_id;
  insert into public.cgl_square_checkout_intents(member_id,membership_id,plan_code,season_id,request_key,amount_cents,recurring,square_plan_variation_id,terms_snapshot)
    values(p_member_id,v_membership_id,p_plan_code,p_season_id,p_request_key,v_plan.price_cents,v_plan.auto_renew,v_plan.config->>'square_plan_variation_id',jsonb_build_object('environment','sandbox','test_only',true,'legal',v_legal,'cancellation_policy',(select value from public.cgl_settings where key='cancellation_policy'))) returning * into v_intent;
  return to_jsonb(v_intent);
end $$;

create or replace function public.cgl_attach_square_checkout(p_intent_id uuid,p_link_id text,p_order_id text,p_url text)
returns void language plpgsql security invoker set search_path='' as $$
declare v_intent public.cgl_square_checkout_intents%rowtype;
begin
  select * into strict v_intent from public.cgl_square_checkout_intents where id=p_intent_id for update;
  if v_intent.square_link_id is not null and (v_intent.square_link_id<>p_link_id or v_intent.square_order_id<>p_order_id or v_intent.payment_link_url<>p_url) then raise exception 'Provider checkout conflict'; end if;
  update public.cgl_square_checkout_intents set square_link_id=p_link_id,square_order_id=p_order_id,payment_link_url=p_url where id=p_intent_id;
end $$;

create function public.cgl_square_date(p_date text,p_timezone text) returns timestamptz
language plpgsql stable security invoker set search_path='' as $$
declare v_date date;
begin
  if p_date is null or p_date !~ '^\d{4}-\d{2}-\d{2}$' or not exists(select 1 from pg_timezone_names where name=p_timezone) then return null; end if;
  v_date:=p_date::date;
  return v_date::timestamp at time zone p_timezone;
exception when datetime_field_overflow or invalid_datetime_format then return null;
end $$;

create function public.cgl_enqueue_square_event(p_event_id text,p_event_type text,p_occurred_at timestamptz,p_body_hash text,p_event_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_event public.cgl_square_webhook_events; v_duplicate boolean:=false;
begin
  if p_event_data->>'environment' is distinct from 'sandbox' or length(p_event_id) not between 1 and 255 or length(p_body_hash) not between 16 and 128 then raise exception 'Invalid Sandbox event envelope'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cgl-square:'||p_event_id,0));
  select * into v_event from public.cgl_square_webhook_events where event_id=p_event_id for update;
  if found then
    if v_event.body_hash<>p_body_hash or v_event.event_type<>p_event_type then raise exception 'Square event payload changed'; end if;
    v_duplicate:=true;
    if v_event.state in ('unmatched','review') then update public.cgl_square_webhook_events set state='queued',next_attempt_at=now(),lease_token=null,lease_until=null where event_id=p_event_id; end if;
  else
    insert into public.cgl_square_webhook_events(event_id,event_type,occurred_at,body_hash,event_data)
      values(p_event_id,p_event_type,p_occurred_at,p_body_hash,jsonb_build_object('environment','sandbox','object_id',p_event_data->>'object_id','merchant_id',p_event_data->>'merchant_id','object_type',p_event_data->>'object_type'));
  end if;
  return (select jsonb_build_object('event_id',event_id,'state',state,'duplicate',v_duplicate,'queued',state in ('queued','retry')) from public.cgl_square_webhook_events where event_id=p_event_id);
end $$;

create function public.cgl_claim_square_events(p_event_id text default null,p_limit integer default 10)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_event public.cgl_square_webhook_events; v_result jsonb:='[]'; v_token uuid;
begin
  if p_limit<1 or p_limit>25 then raise exception 'Claim limit must be 1–25'; end if;
  for v_event in select * from public.cgl_square_webhook_events
    where environment='sandbox' and (p_event_id is null or event_id=p_event_id)
      and ((state in ('queued','retry') and next_attempt_at<=now() and (attempts<8 or p_event_id is not null))
        or (state='processing' and lease_until<=now()) or (p_event_id is not null and state in ('unmatched','review')))
    order by next_attempt_at,created_at limit p_limit for update skip locked loop
    v_token:=gen_random_uuid();
    update public.cgl_square_webhook_events set state='processing',lease_token=v_token,lease_until=now()+interval '2 minutes',attempts=attempts+1 where event_id=v_event.event_id;
    v_result:=v_result||jsonb_build_array(jsonb_build_object('event_id',v_event.event_id,'event_type',v_event.event_type,'occurred_at',v_event.occurred_at,'body_hash',v_event.body_hash,'event_data',v_event.event_data,'lease_token',v_token,'attempts',v_event.attempts+1));
  end loop;
  return v_result;
end $$;

create function public.cgl_fail_square_event(p_event_id text,p_lease_token uuid,p_error_code text,p_retryable boolean default true)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_event public.cgl_square_webhook_events; v_retry boolean;
begin
  select * into v_event from public.cgl_square_webhook_events where event_id=p_event_id for update;
  if not found or v_event.state<>'processing' or v_event.lease_token is distinct from p_lease_token then return jsonb_build_object('state','lease_lost'); end if;
  v_retry:=p_retryable and v_event.attempts<8;
  update public.cgl_square_webhook_events set state=case when v_retry then 'retry' else 'review' end,
    next_attempt_at=now()+make_interval(secs=>least(3600,15*power(2,least(attempts,8))::integer)),
    last_error_code=case when p_error_code ~ '^[a-zA-Z0-9_.:-]{1,80}$' then p_error_code else 'provider_reconciliation_failed' end,
    lease_token=null,lease_until=null where event_id=p_event_id;
  return (select jsonb_build_object('state',state,'next_attempt_at',next_attempt_at) from public.cgl_square_webhook_events where event_id=p_event_id);
end $$;

create or replace function public.cgl_reconcile_square_event(p_event_id text,p_event_type text,p_occurred_at timestamptz,p_body_hash text,p_normalized jsonb,p_lease_token uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_event public.cgl_square_webhook_events; v_intent public.cgl_square_checkout_intents;
  v_membership public.cgl_memberships; v_payment public.cgl_payments; v_prior public.cgl_square_invoice_states;
  v_subscription jsonb:=p_normalized->'subscription'; v_link jsonb:=p_normalized->'checkout_link';
  v_item jsonb; v_invoice jsonb; v_match_invoice jsonb; v_amount integer; v_refunded integer;
  v_matched boolean:=false; v_review boolean:=false; v_stale boolean; v_apply boolean;
  v_paid_at timestamptz; v_updated timestamptz; v_until timestamptz; v_start timestamptz; v_next timestamptz;
  v_provider_version bigint; v_current_version bigint; v_state text; v_external text; v_failure timestamptz;
begin
  if p_normalized->>'environment' is distinct from 'sandbox' then raise exception 'Only verified Sandbox reconciliation is accepted'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cgl-square:'||p_event_id,0));
  select * into v_event from public.cgl_square_webhook_events where event_id=p_event_id for update;
  if found then
    if v_event.body_hash<>p_body_hash or v_event.event_type<>p_event_type then raise exception 'Square event payload changed'; end if;
    if p_lease_token is not null and (v_event.lease_token is distinct from p_lease_token or v_event.state<>'processing') then raise exception 'Square worker lease lost'; end if;
    if v_event.state in ('reconciled','ignored') then return jsonb_build_object('duplicate',true,'state',v_event.state); end if;
  else
    if p_lease_token is not null then raise exception 'Square event must be durably queued before processing'; end if;
    insert into public.cgl_square_webhook_events(event_id,event_type,occurred_at,body_hash) values(p_event_id,p_event_type,p_occurred_at,p_body_hash);
  end if;

  -- A verified provider order template, not an email/customer/plan guess, links hosted subscriptions.
  if nullif(v_link->>'intent_id','') is not null then
    select * into v_intent from public.cgl_square_checkout_intents where id::text=v_link->>'intent_id';
    if v_intent.id is null or v_intent.square_order_id is distinct from v_link->>'order_id'
      or v_intent.member_id::text is distinct from v_link->>'member_id' or v_intent.membership_id::text is distinct from v_link->>'membership_id' then v_review:=true;
    elsif v_subscription->>'id' is not null then
      select * into v_membership from public.cgl_memberships where id=v_intent.membership_id for update;
      select * into v_intent from public.cgl_square_checkout_intents where id=v_intent.id for update;
      if v_membership.metadata->>'environment' is distinct from 'sandbox' or not v_intent.recurring
        or v_intent.square_plan_variation_id is distinct from v_subscription->>'plan_variation_id'
        or v_link->>'subscription_id' is distinct from v_subscription->>'id'
        or v_link->>'customer_id' is distinct from v_subscription->>'customer_id'
        or not coalesce(v_subscription->'template_order_ids','[]'::jsonb) ? v_intent.square_order_id
        or (v_membership.square_subscription_id is not null and v_membership.square_subscription_id<>v_subscription->>'id')
        or (v_membership.starts_at is not null and v_membership.square_customer_id is not null and v_membership.square_customer_id<>v_subscription->>'customer_id') then v_review:=true;
      else
        if exists(select 1 from public.cgl_memberships where square_subscription_id=v_subscription->>'id' and id<>v_membership.id) then v_review:=true;
        else update public.cgl_memberships set square_subscription_id=v_subscription->>'id',square_customer_id=v_subscription->>'customer_id',updated_at=now() where id=v_membership.id;v_matched:=true; end if;
      end if;
    end if;
  end if;

  if v_subscription->>'id' is not null then
    select * into v_membership from public.cgl_memberships where square_subscription_id=v_subscription->>'id' for update;
    if found and v_membership.metadata->>'environment'='sandbox' and v_membership.square_customer_id=v_subscription->>'customer_id'
      and v_membership.metadata->>'square_plan_variation_id'=v_subscription->>'plan_variation_id' then
      v_matched:=true;
      for v_invoice in select value from jsonb_array_elements(coalesce(p_normalized->'invoices','[]')) loop
        if v_invoice->>'subscription_id'<>v_membership.square_subscription_id or v_invoice->>'customer_id' is distinct from v_membership.square_customer_id then v_review:=true;continue; end if;
        select * into v_prior from public.cgl_square_invoice_states where id=v_invoice->>'id' for update;
        if found and (v_prior.membership_id<>v_membership.id or v_prior.order_id<>v_invoice->>'order_id') then v_review:=true;continue; end if;
        v_updated:=coalesce(nullif(v_invoice->>'updated_at','')::timestamptz,p_occurred_at);
        v_provider_version:=coalesce((v_invoice->>'version')::bigint,0);
        if v_prior.id is not null and (v_provider_version<v_prior.version or (v_provider_version=v_prior.version and v_updated<v_prior.provider_updated_at)) then continue; end if;
        v_failure:=case when coalesce((p_normalized->>'invoice_failed')::boolean,false) and v_invoice->>'order_id'=p_normalized->>'invoice_order_id'
          and not coalesce((v_invoice->>'paid')::boolean,false) and v_invoice->>'status' not in ('PAID','REFUNDED','CANCELED') then v_updated else v_prior.failed_at end;
        if coalesce((v_invoice->>'paid')::boolean,false) and v_invoice->>'status'='PAID' then v_failure:=null; end if;
        insert into public.cgl_square_invoice_states(id,membership_id,subscription_id,order_id,version,state,provider_updated_at,failed_at,period_start_date,period_end_date_exclusive,amount_cents,completed_cents,metadata)
          values(v_invoice->>'id',v_membership.id,v_membership.square_subscription_id,v_invoice->>'order_id',v_provider_version,v_invoice->>'status',v_updated,v_failure,
            (v_invoice->>'period_start_date')::date,(v_invoice->>'period_end_date_exclusive')::date,coalesce((v_invoice->>'amount_cents')::int,0),coalesce((v_invoice->>'completed_cents')::int,0),
            jsonb_build_object('currency',v_invoice->>'currency','payment_ids',coalesce(v_invoice->'payment_ids','[]')))
          on conflict(id) do update set version=excluded.version,state=excluded.state,provider_updated_at=excluded.provider_updated_at,failed_at=excluded.failed_at,
            period_start_date=excluded.period_start_date,period_end_date_exclusive=excluded.period_end_date_exclusive,amount_cents=excluded.amount_cents,completed_cents=excluded.completed_cents,metadata=excluded.metadata;
      end loop;
    elsif v_membership.id is not null then v_review:=true;
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_normalized->'payments','[]')) loop
    v_intent:=null;v_membership:=null;v_payment:=null;v_match_invoice:=null;v_apply:=false;
    v_external:='square:sandbox:'||(v_item->>'id');
    select * into v_payment from public.cgl_payments where external_id=v_external;
    if found then select * into v_membership from public.cgl_memberships where id=v_payment.membership_id for update;
    else
      select * into v_intent from public.cgl_square_checkout_intents where square_order_id=v_item->>'order_id';
      if found then
        select * into v_membership from public.cgl_memberships where id=v_intent.membership_id for update;
        select * into v_intent from public.cgl_square_checkout_intents where id=v_intent.id for update;
      elsif v_subscription->>'id' is not null then
        select value into v_match_invoice from jsonb_array_elements(coalesce(p_normalized->'invoices','[]')) where value->>'order_id'=v_item->>'order_id' and value->>'subscription_id'=v_subscription->>'id' and coalesce(value->'payment_ids','[]') ? (v_item->>'id') limit 1;
        if v_match_invoice is not null then select * into v_membership from public.cgl_memberships where square_subscription_id=v_subscription->>'id' for update; end if;
      end if;
    end if;
    if v_membership.id is null then continue; end if;
    select * into v_payment from public.cgl_payments where external_id=v_external for update;
    if v_membership.metadata->>'environment' is distinct from 'sandbox' then v_review:=true;continue;end if;
    if v_intent.id is null then select * into v_intent from public.cgl_square_checkout_intents where membership_id=v_membership.id order by created_at limit 1; end if;
    if v_intent.id is null or v_intent.member_id<>v_membership.member_id or v_intent.membership_id<>v_membership.id then v_review:=true;continue;end if;
    v_matched:=true;v_amount:=(v_item->>'amount_cents')::int;v_refunded:=coalesce((v_item->>'refunded_cents')::int,0);
    if v_item->>'currency' is distinct from 'AUD' or v_amount is distinct from v_intent.amount_cents or v_refunded<0 or v_refunded>v_amount
      or (v_item->>'intent_id' is not null and v_item->>'intent_id'<>v_intent.id::text)
      or (v_membership.square_customer_id is not null and v_item->>'customer_id' is not null and v_item->>'customer_id'<>v_membership.square_customer_id)
      or (v_payment.id is not null and (v_payment.member_id<>v_membership.member_id or v_payment.membership_id<>v_membership.id or v_payment.amount_cents<>v_amount or v_payment.metadata->>'square_order_id' is distinct from v_item->>'order_id')) then v_review:=true;continue;end if;
    v_paid_at:=coalesce(nullif(v_item->>'paid_at','')::timestamptz,p_occurred_at);v_updated:=coalesce(nullif(v_item->>'updated_at','')::timestamptz,p_occurred_at);
    v_stale:=v_payment.id is not null and v_updated<coalesce(nullif(v_payment.metadata->>'provider_updated_at','')::timestamptz,v_payment.created_at);
    if v_stale then continue;end if;
    v_state:=case when v_refunded>=v_amount and v_refunded>0 then 'refunded' when v_item->>'state'='COMPLETED' then 'completed' when v_item->>'state' in ('FAILED','CANCELED') then 'failed' else 'pending' end;
    if v_payment.id is not null and v_payment.state in ('completed','refunded') and v_state in ('pending','failed') then continue;end if;
    if v_payment.id is null then
      insert into public.cgl_payments(member_id,membership_id,season_id,external_id,idempotency_key,kind,amount_cents,fee_cents,state,paid_at,metadata)
        values(v_membership.member_id,v_membership.id,v_intent.season_id,v_external,v_external,v_intent.plan_code,v_amount,coalesce((v_item->>'fee_cents')::int,0),v_state,
          case when v_state in ('completed','refunded') then v_paid_at else null end,jsonb_build_object('environment','sandbox','square_order_id',v_item->>'order_id','receipt_url',v_item->>'receipt_url','entitlement_applied',false,'provider_updated_at',v_updated,'version_token',v_item->>'version_token','refunded_cents',v_refunded)) returning * into v_payment;
    else
      update public.cgl_payments set state=case when state='refunded' then state else v_state end,paid_at=case when v_state='completed' then coalesce(paid_at,v_paid_at) else paid_at end,fee_cents=coalesce((v_item->>'fee_cents')::int,fee_cents),
        metadata=metadata||jsonb_build_object('provider_updated_at',v_updated,'version_token',v_item->>'version_token','refunded_cents',greatest(coalesce((metadata->>'refunded_cents')::int,0),v_refunded)) where id=v_payment.id returning * into v_payment;
    end if;
    if coalesce((v_payment.metadata->>'refunded_cents')::int,0)>0 then
      update public.cgl_memberships set metadata=metadata||jsonb_build_object('entitlement_review_required',true,'review_reason','Refunded Sandbox payment requires reconciliation'),updated_at=now() where id=v_membership.id;
      update public.cgl_square_checkout_intents set state='review' where id=v_intent.id;
      v_review:=true;continue;
    end if;
    if v_state='completed' then
      if v_intent.recurring then
        select value into v_match_invoice from jsonb_array_elements(coalesce(p_normalized->'invoices','[]')) where value->>'order_id'=v_item->>'order_id' and value->>'subscription_id'=v_membership.square_subscription_id and coalesce(value->'payment_ids','[]') ? (v_item->>'id') limit 1;
        v_until:=public.cgl_square_date(v_subscription->>'paid_through_date_exclusive',v_subscription->>'timezone');
        v_start:=public.cgl_square_date(v_subscription->>'start_date',v_subscription->>'timezone');
        v_next:=public.cgl_square_date(v_subscription->>'next_billing_date',v_subscription->>'timezone');
        if v_membership.square_subscription_id is null or v_subscription->>'id' is distinct from v_membership.square_subscription_id
          or not coalesce((v_subscription->>'billing_supported')::boolean,false) or not coalesce((v_subscription->>'coverage_complete')::boolean,false)
          or not coalesce((v_match_invoice->>'paid')::boolean,false) or v_match_invoice->>'status' is distinct from 'PAID'
          or v_match_invoice->>'customer_id' is distinct from v_membership.square_customer_id or v_match_invoice->>'currency' is distinct from 'AUD'
          or (v_match_invoice->>'amount_cents')::int is distinct from v_intent.amount_cents or (v_match_invoice->>'completed_cents')::int is distinct from v_intent.amount_cents
          or v_until is null or v_start is null or v_until<=v_start then v_review:=true;continue;end if;
        -- Provider-verified contiguous paid periods, never a count of successful payments or charged-through dates.
        v_apply:=true;
      elsif not coalesce((v_payment.metadata->>'entitlement_applied')::boolean,false) then
        if v_intent.state<>'pending' then v_review:=true;continue;end if;
        v_start:=v_paid_at;v_next:=null;
        if v_intent.plan_code='casual_registration' then v_until:=v_paid_at+interval '1 year';
        elsif v_intent.plan_code='casual_season' then
          select ends_at into v_until from public.cgl_seasons where id=v_intent.season_id;
          if v_until is null or v_until<=v_paid_at then v_review:=true;continue;end if;
          insert into public.cgl_square_season_entitlements(checkout_id,member_id,season_id,paid_at,expires_at)
            values(v_intent.id,v_membership.member_id,v_intent.season_id,v_paid_at,v_until) on conflict(member_id,season_id) do nothing;
        else v_review:=true;continue;end if;
        v_apply:=true;
      end if;
      if v_apply then
        select min(failed_at) into v_failure from public.cgl_square_invoice_states where membership_id=v_membership.id and failed_at is not null;
        update public.cgl_memberships set state=case when metadata->>'entitlement_review_required'='true' then state when v_failure is not null then 'past_due' when cancel_effective_at is not null then 'cancel_scheduled' when state in ('cancelled','expired') then state else 'active' end,
          starts_at=coalesce(starts_at,v_start),paid_through=greatest(paid_through,v_until),next_billing_at=case when v_intent.recurring then greatest(next_billing_at,v_next) else null end,failed_at=v_failure,
          square_customer_id=coalesce(square_customer_id,v_item->>'customer_id'),updated_at=now() where id=v_membership.id;
        update public.cgl_payments set metadata=metadata||jsonb_build_object('entitlement_applied',true,'coverage_end',v_until,'coverage_source',case when v_intent.recurring then 'verified_provider_invoices' else 'confirmed_one_off_payment' end) where id=v_payment.id;
        update public.cgl_square_checkout_intents set state='completed',completed_at=coalesce(completed_at,v_paid_at) where id=v_intent.id;
      end if;
    elsif v_state='failed' then
      if v_updated>=coalesce((select max(paid_at) from public.cgl_payments where membership_id=v_membership.id and state='completed'),'-infinity'::timestamptz) then
        update public.cgl_memberships set state='past_due',failed_at=coalesce(failed_at,v_updated),updated_at=now() where id=v_membership.id and state not in ('cancelled','expired');
        insert into public.cgl_notifications(member_id,kind,title,body,source_key,email_state,metadata)
          values(v_membership.member_id,'payment_reminder','Your Sandbox payment needs attention','This is a Square Sandbox test payment. Review the test membership in your clubhouse. Real competition access is unchanged.','square:sandbox:payment-failed:'||(v_item->>'id'),'preview',jsonb_build_object('environment','sandbox','membership_id',v_membership.id)) on conflict(source_key) do nothing;
      end if;
    end if;
  end loop;

  if v_subscription->>'id' is not null then
    select * into v_membership from public.cgl_memberships where square_subscription_id=v_subscription->>'id' for update;
    if found and v_membership.metadata->>'environment'='sandbox' and v_membership.square_customer_id=v_subscription->>'customer_id' then
      v_matched:=true;v_provider_version:=coalesce((v_subscription->>'version')::bigint,0);v_current_version:=coalesce((v_membership.metadata->>'square_version')::bigint,-1);
      if v_provider_version>=v_current_version then
        select min(failed_at) into v_failure from public.cgl_square_invoice_states where membership_id=v_membership.id and failed_at is not null;
        update public.cgl_memberships set state=case when v_subscription->>'state' in ('CANCELED','COMPLETED','DEACTIVATED') then 'cancelled' when v_failure is not null then 'past_due' else state end,failed_at=case when v_failure is not null then v_failure else failed_at end,
          metadata=metadata||jsonb_build_object('square_status',v_subscription->>'state','square_version',v_provider_version,'square_last_event_at',p_occurred_at,'square_canceled_date',v_subscription->>'canceled_date','square_paid_until_date',v_subscription->>'paid_until_date'),updated_at=now() where id=v_membership.id;
        if v_failure is not null then
          insert into public.cgl_notifications(member_id,kind,title,body,source_key,email_state,metadata)
            values(v_membership.member_id,'payment_reminder','Your recurring Sandbox payment needs attention','Square could not collect a test recurring payment. This does not alter real CGS competition access.','square:sandbox:invoice-failed:'||coalesce(p_normalized->>'invoice_order_id',p_event_id),'preview',jsonb_build_object('environment','sandbox','membership_id',v_membership.id)) on conflict(source_key) do nothing;
        end if;
      end if;
    end if;
  end if;
  update public.cgl_square_webhook_events set state=case when v_review then 'review' when v_matched then 'reconciled' when jsonb_array_length(coalesce(p_normalized->'payments','[]'))=0 and v_subscription->>'id' is null then 'ignored' else 'unmatched' end,
    review_reason=case when v_review then 'Verified identity, invoice, paid coverage or amount needs administrator reconciliation. No guessed entitlement granted.' when not v_matched then 'No immutable CGL checkout/order/subscription link.' else null end,
    normalized=p_normalized,processed_at=now(),lease_token=null,lease_until=null,last_error_code=null where event_id=p_event_id;
  return (select jsonb_build_object('duplicate',false,'state',state) from public.cgl_square_webhook_events where event_id=p_event_id);
end $$;

create function public.cgl_square_immutable_link() returns trigger language plpgsql set search_path='' as $$
begin
  if row(new.member_id,new.membership_id,new.plan_code,new.season_id,new.environment,new.request_key,new.amount_cents,new.recurring,new.square_plan_variation_id,new.terms_snapshot)
    is distinct from row(old.member_id,old.membership_id,old.plan_code,old.season_id,old.environment,old.request_key,old.amount_cents,old.recurring,old.square_plan_variation_id,old.terms_snapshot)
    or (old.square_order_id is not null and new.square_order_id is distinct from old.square_order_id)
    or (old.square_link_id is not null and new.square_link_id is distinct from old.square_link_id) then raise exception 'Square checkout identity and contract are immutable';end if;
  return new;
end $$;
create trigger cgl_square_immutable_checkout before update on public.cgl_square_checkout_intents for each row execute function public.cgl_square_immutable_link();

create function public.cgl_square_preserve_environment() returns trigger language plpgsql set search_path='' as $$
begin
  if old.metadata->>'environment'='sandbox' and new.metadata->>'environment' is distinct from 'sandbox' then raise exception 'Sandbox financial records cannot become live entitlements'; end if;
  if tg_table_name='cgl_payments' then
    if old.external_id like 'square:sandbox:%' and
      row(new.member_id,new.membership_id,new.external_id,new.idempotency_key,new.kind,new.amount_cents,new.metadata->>'square_order_id')
        is distinct from row(old.member_id,old.membership_id,old.external_id,old.idempotency_key,old.kind,old.amount_cents,old.metadata->>'square_order_id') then raise exception 'Verified Square payment identity is immutable'; end if;
  end if;
  return new;
end $$;
create trigger cgl_square_membership_environment before update on public.cgl_memberships for each row execute function public.cgl_square_preserve_environment();
create trigger cgl_square_payment_environment before update on public.cgl_payments for each row execute function public.cgl_square_preserve_environment();

do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('cgl_square_date','cgl_enqueue_square_event','cgl_claim_square_events','cgl_fail_square_event','cgl_prepare_square_checkout','cgl_attach_square_checkout','cgl_reconcile_square_event','cgl_square_immutable_link','cgl_square_preserve_environment') loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;
