-- CGL is additive: no changes to existing CGS accounts, event tables or trial data.
begin;

create table public.cgl_settings (
  key text primary key, value jsonb not null default '{}',
  updated_at timestamptz not null default now(), updated_by text
);
create table public.cgl_plans (
  code text primary key check (code in ('annual','monthly','weekly','casual_registration','casual_season')),
  name text not null, price_cents integer not null check (price_cents > 0),
  billing_interval text not null check (billing_interval in ('annual','monthly','weekly','once')),
  full_member boolean not null, auto_renew boolean not null,
  active boolean not null default true, config jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  check (code not in ('casual_registration','casual_season') or not auto_renew)
);
create table public.cgl_seasons (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name text not null, year integer not null check(year >= 2027),
  season_number integer not null check(season_number between 1 and 4),
  format text not null check(format in ('aggregate','redemption','world_tour','elements')),
  starts_at timestamptz, ends_at timestamptz, qualification_ends_at timestamptz,
  status text not null default 'draft' check(status in ('draft','registration','published','active','closed','archived')),
  config jsonb not null default '{}', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(year,season_number),
  check(ends_at is null or starts_at is null or ends_at > starts_at),
  check(qualification_ends_at is null or starts_at is null or qualification_ends_at >= starts_at)
);
create table public.cgl_weeks (
  id uuid primary key default gen_random_uuid(), season_id uuid not null references public.cgl_seasons(id),
  week_number integer not null check(week_number between 1 and 13),
  championship_week integer check(championship_week between 1 and 10), name text not null,
  phase text not null check(phase in ('qualification','championship')),
  opens_at timestamptz, closes_at timestamptz,
  status text not null default 'draft' check(status in ('draft','published','open','closed','verified','locked','archived')),
  course_name text, second_course_name text, conditions jsonb not null default '{}',
  sgt_tournament_id text, sgt_tour_id text, config jsonb not null default '{}',
  results_published boolean not null default false, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(season_id,week_number),
  unique(season_id,championship_week),
  check(closes_at is null or opens_at is null or closes_at > opens_at),
  check((phase='qualification' and week_number<=3 and championship_week is null) or (phase='championship' and week_number>=4 and championship_week=week_number-3))
);
create table public.cgl_members (
  id uuid primary key references auth.users(id), email text not null,
  display_name text not null, sgt_username text unique, sgt_id text unique,
  sgt_verified_at timestamptz, handicap numeric(5,1),
  handicap_status text not null default 'unverified' check(handicap_status in ('unverified','qualifying','verified')),
  qualifying_holes integer not null default 0 check(qualifying_holes >= 0),
  handicap_verified_at timestamptz, eligibility text not null default 'active' check(eligibility in ('active','suspended')),
  private_notes text not null default '', metadata jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(handicap is null or handicap between -20 and 54),
  check(sgt_id is null or sgt_id ~ '^[0-9]{8,30}$')
);
create table public.cgl_sgt_link_requests (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.cgl_members(id),
  sgt_username text not null, sgt_id text not null, state text not null default 'pending' check(state in ('pending','verified','rejected')),
  reason text, reviewed_by text, reviewed_at timestamptz, created_at timestamptz not null default now(),
  check(sgt_id ~ '^[0-9]{8,30}$')
);
create unique index cgl_one_pending_sgt_link on public.cgl_sgt_link_requests(member_id) where state='pending';
create table public.cgl_memberships (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.cgl_members(id),
  plan_code text not null references public.cgl_plans(code),
  state text not null default 'pending' check(state in ('pending','active','past_due','cancel_scheduled','cancelled','expired')),
  starts_at timestamptz, paid_through timestamptz, next_billing_at timestamptz,
  cancel_requested_at timestamptz, cancel_effective_at timestamptz, failed_at timestamptz,
  square_customer_id text, square_subscription_id text unique, metadata jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cgl_season_entries (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.cgl_members(id),
  season_id uuid not null references public.cgl_seasons(id),
  state text not null default 'pending' check(state in ('pending','active','suspended','expired')),
  source text not null default 'membership', paid_at timestamptz,
  metadata jsonb not null default '{}', created_at timestamptz not null default now(), unique(member_id,season_id)
);
create table public.cgl_division_assignments (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.cgl_members(id),
  season_id uuid not null references public.cgl_seasons(id), division text not null check(division in ('A','B','C')),
  handicap_at_assignment numeric(5,1) not null, locked_at timestamptz,
  reason text not null, assigned_by text not null, created_at timestamptz not null default now(), unique(member_id,season_id)
);
create table public.cgl_payments (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.cgl_members(id),
  membership_id uuid references public.cgl_memberships(id), season_id uuid references public.cgl_seasons(id),
  external_id text unique, idempotency_key text unique, kind text not null,
  amount_cents integer not null check(amount_cents >= 0), fee_cents integer not null default 0 check(fee_cents >= 0),
  state text not null check(state in ('pending','completed','failed','refunded')),
  paid_at timestamptz, created_at timestamptz not null default now(), metadata jsonb not null default '{}'
);
create table public.cgl_imports (
  id uuid primary key default gen_random_uuid(), week_id uuid not null references public.cgl_weeks(id),
  source text not null, source_url text not null, actor text not null,
  state text not null check(state in ('pending','completed','review','failed')),
  imported_count integer not null default 0, error text, checksum text not null,
  created_at timestamptz not null default now(), unique(week_id,checksum)
);
create table public.cgl_results (
  id uuid primary key default gen_random_uuid(), week_id uuid not null references public.cgl_weeks(id),
  member_id uuid not null references public.cgl_members(id), import_id uuid references public.cgl_imports(id),
  external_id text not null, revision integer not null default 1 check(revision > 0),
  source_url text not null, scorecard_url text, gross numeric(7,2) not null check(gross > 0),
  net numeric(7,2) not null, handicap numeric(5,1), division text check(division in ('A','B','C')),
  holes jsonb not null default '[]', stats jsonb not null default '{}', raw_result jsonb not null default '{}',
  state text not null default 'pending' check(state in ('pending','verified','excluded','superseded')),
  reason text not null default '', verified_by text, verified_at timestamptz,
  played_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(week_id,external_id,revision)
);
create unique index cgl_current_external_result on public.cgl_results(week_id,external_id) where state <> 'superseded';
create unique index cgl_current_member_result on public.cgl_results(week_id,member_id) where state <> 'superseded';
create table public.cgl_calculations (
  id uuid primary key default gen_random_uuid(), week_id uuid not null references public.cgl_weeks(id),
  rules_version text not null, points_version jsonb not null, source_snapshot jsonb not null,
  rows jsonb not null, awards jsonb not null, manual_review boolean not null,
  created_by text not null, created_at timestamptz not null default now(), published_at timestamptz
);
create table public.cgl_prizes (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.cgl_members(id),
  season_id uuid not null references public.cgl_seasons(id), week_id uuid references public.cgl_weeks(id),
  category text not null, kind text not null check(kind in ('credits','cash','physical')),
  amount integer not null check(amount >= 0), state text not null default 'pending'
    check(state in ('pending','verified','approved','awarded','claimed','expired','reversed')),
  source_key text not null unique, claim_deadline timestamptz, metadata jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cgl_credit_lots (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.cgl_members(id),
  original_amount integer not null check(original_amount > 0), remaining_amount integer not null,
  source_key text not null unique, source jsonb not null default '{}', issued_at timestamptz not null default now(),
  expires_at timestamptz not null, check(remaining_amount between 0 and original_amount), check(expires_at > issued_at)
);
create table public.cgl_catalogue (
  id uuid primary key default gen_random_uuid(), name text not null, description text not null default '',
  credit_price integer not null check(credit_price > 0), retail_cents integer not null default 0 check(retail_cents >= 0),
  cost_cents integer not null default 0 check(cost_cents >= 0), cash_cents integer not null default 0 check(cash_cents >= 0),
  stock integer not null default 0 check(stock >= 0), image_url text,
  kind text not null default 'physical' check(kind in ('physical','season_discount','membership_discount')),
  fulfilment_method text not null default 'pickup' check(fulfilment_method in ('pickup','dispatch','digital')),
  active boolean not null default false, available_from timestamptz, available_until timestamptz,
  restrictions jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table public.cgl_orders (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.cgl_members(id),
  catalogue_id uuid not null references public.cgl_catalogue(id), quantity integer not null check(quantity > 0),
  credits_spent integer not null check(credits_spent > 0), cash_cents integer not null default 0,
  unit_cost_cents integer not null, state text not null default 'pending' check(state in ('pending','ready','dispatched','collected','cancelled')),
  request_key text not null unique, fulfilment_notes text not null default '',
  created_at timestamptz not null default now(), fulfilled_at timestamptz, metadata jsonb not null default '{}'
);
create table public.cgl_credit_transactions (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.cgl_members(id),
  lot_id uuid not null references public.cgl_credit_lots(id), order_id uuid references public.cgl_orders(id),
  kind text not null check(kind in ('issue','redeem','expire','adjustment','reversal')),
  amount integer not null check(amount <> 0), source_key text not null unique,
  reason text not null, actor text not null, created_at timestamptz not null default now()
);
create table public.cgl_gift_items (
  id uuid primary key default gen_random_uuid(), season_id uuid not null references public.cgl_seasons(id),
  name text not null, unit_cost_cents integer not null check(unit_cost_cents >= 0),
  stock integer not null default 0 check(stock >= 0), active boolean not null default true,
  config jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table public.cgl_gifts (
  id uuid primary key default gen_random_uuid(), member_id uuid not null references public.cgl_members(id),
  season_id uuid not null references public.cgl_seasons(id), gift_item_id uuid not null references public.cgl_gift_items(id),
  state text not null default 'allocated' check(state in ('allocated','ready','dispatched','collected','expired')),
  unit_cost_cents integer not null, notes text not null default '',
  allocated_at timestamptz not null default now(), fulfilled_at timestamptz, unique(member_id,season_id)
);
create table public.cgl_notifications (
  id uuid primary key default gen_random_uuid(), member_id uuid references public.cgl_members(id),
  kind text not null, title text not null, body text not null, source_key text unique,
  state text not null default 'unread' check(state in ('unread','read')),
  email_state text not null default 'preview' check(email_state in ('preview','queued','sent','failed')),
  created_at timestamptz not null default now(), metadata jsonb not null default '{}'
);
create table public.cgl_audit_events (
  id uuid primary key default gen_random_uuid(), actor text not null, action text not null,
  entity text not null, entity_id text, reason text not null,
  before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
create index cgl_weeks_season_status on public.cgl_weeks(season_id,status);
create index cgl_memberships_member on public.cgl_memberships(member_id);
create index cgl_entries_member on public.cgl_season_entries(member_id);
create index cgl_results_week_state on public.cgl_results(week_id,state);
create index cgl_results_member on public.cgl_results(member_id);
create index cgl_lots_fefo on public.cgl_credit_lots(member_id,expires_at,id) where remaining_amount > 0;
create index cgl_transactions_member on public.cgl_credit_transactions(member_id,created_at);
create index cgl_orders_member on public.cgl_orders(member_id);
create index cgl_payments_member on public.cgl_payments(member_id,created_at);
create index cgl_calculations_week on public.cgl_calculations(week_id,created_at desc);
create index cgl_notifications_member on public.cgl_notifications(member_id,state);

-- Only the existing server service role can write. The browser has no write grants.
do $$ declare t text; begin
  foreach t in array array['settings','plans','seasons','weeks','members','sgt_link_requests','memberships','season_entries',
    'division_assignments','payments','imports','results','calculations','prizes','credit_lots','catalogue','orders',
    'credit_transactions','gift_items','gifts','notifications','audit_events'] loop
    execute format('alter table public.cgl_%I enable row level security',t);
    execute format('revoke all on public.cgl_%I from public, anon, authenticated',t);
    execute format('grant all on public.cgl_%I to service_role',t);
  end loop;
end $$;

create function public.cgl_immutable_record() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'CGL financial and audit history is immutable; record an authorised compensating entry'; end $$;
create trigger cgl_immutable_ledger before update or delete on public.cgl_credit_transactions for each row execute function public.cgl_immutable_record();
create trigger cgl_immutable_audit before update or delete on public.cgl_audit_events for each row execute function public.cgl_immutable_record();
create trigger cgl_immutable_calculations before delete on public.cgl_calculations for each row execute function public.cgl_immutable_record();

create function public.cgl_issue_credits(p_member_id uuid,p_amount integer,p_source_key text,p_source jsonb,p_reason text,p_actor text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_existing public.cgl_credit_lots; v_months int;
begin
  if p_amount <= 0 or length(trim(p_reason)) < 3 then raise exception 'Positive amount and reason required'; end if;
  perform 1 from public.cgl_members where id=p_member_id for update;
  if not found then raise exception 'CGL member not found'; end if;
  select * into v_existing from public.cgl_credit_lots where source_key=p_source_key;
  if found then
    if v_existing.member_id<>p_member_id or v_existing.original_amount<>p_amount then raise exception 'Idempotency conflict'; end if;
    return v_existing.id;
  end if;
  select coalesce((value->>'credit_expiry_months')::int,18) into v_months from public.cgl_settings where key='rewards';
  v_months:=coalesce(v_months,18);
  if v_months<1 or v_months>60 then raise exception 'Invalid credit expiry configuration'; end if;
  insert into public.cgl_credit_lots(member_id,original_amount,remaining_amount,source_key,source,expires_at)
    values(p_member_id,p_amount,p_amount,p_source_key,p_source,now()+make_interval(months=>v_months)) returning id into v_id;
  insert into public.cgl_credit_transactions(member_id,lot_id,kind,amount,source_key,reason,actor)
    values(p_member_id,v_id,'issue',p_amount,p_source_key,p_reason,p_actor);
  insert into public.cgl_notifications(member_id,kind,title,body,source_key)
    values(p_member_id,'credits_earned','CGS Credits earned',p_amount||' CGS Credits have been added to your account.','credits:'||p_source_key);
  return v_id;
end $$;

create function public.cgl_redeem(p_member_id uuid,p_catalogue_id uuid,p_quantity integer,p_request_key text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_item public.cgl_catalogue; v_order public.cgl_orders; v_lot record; v_id uuid; v_need int; v_take int; v_balance bigint;
begin
  if p_quantity<1 or p_quantity>20 or length(p_request_key)<12 then raise exception 'Invalid redemption request'; end if;
  perform 1 from public.cgl_members where id=p_member_id for update;
  if not found then raise exception 'CGL member not found'; end if;
  select * into v_order from public.cgl_orders where request_key=p_request_key;
  if found then
    if v_order.member_id<>p_member_id or v_order.catalogue_id<>p_catalogue_id or v_order.quantity<>p_quantity then raise exception 'Idempotency conflict'; end if;
    return v_order.id;
  end if;
  select * into v_item from public.cgl_catalogue where id=p_catalogue_id for update;
  if not found or not v_item.active or v_item.stock<p_quantity then raise exception 'Reward unavailable or out of stock'; end if;
  if (v_item.available_from is not null and now()<v_item.available_from) or (v_item.available_until is not null and now()>=v_item.available_until) then raise exception 'Reward unavailable'; end if;
  if v_item.kind<>'physical' then raise exception 'Payment redemptions are disabled until Square invoice reconciliation is configured'; end if;
  if v_item.cash_cents>0 then raise exception 'Cash-plus-credit checkout requires a reconciled Square payment and is not enabled'; end if;
  if coalesce((v_item.restrictions->>'full_members_only')::boolean,false) and not exists(
    select 1 from public.cgl_memberships m join public.cgl_plans p on p.code=m.plan_code
    where m.member_id=p_member_id and m.metadata->>'environment' is distinct from 'sandbox' and p.full_member and m.state in ('active','cancel_scheduled')
      and m.starts_at<=now() and m.paid_through>now() and (m.cancel_effective_at is null or m.cancel_effective_at>now())
  ) then raise exception 'This reward requires an active full membership'; end if;
  v_need:=v_item.credit_price*p_quantity;
  select coalesce(sum(remaining_amount),0) into v_balance from public.cgl_credit_lots where member_id=p_member_id and expires_at>now();
  if v_balance<v_need then raise exception 'Insufficient available credits'; end if;
  insert into public.cgl_orders(member_id,catalogue_id,quantity,credits_spent,cash_cents,unit_cost_cents,request_key)
    values(p_member_id,p_catalogue_id,p_quantity,v_need,0,v_item.cost_cents,p_request_key) returning id into v_id;
  for v_lot in select * from public.cgl_credit_lots where member_id=p_member_id and remaining_amount>0 and expires_at>now() order by expires_at,id for update loop
    exit when v_need=0; v_take:=least(v_need,v_lot.remaining_amount);
    update public.cgl_credit_lots set remaining_amount=remaining_amount-v_take where id=v_lot.id;
    insert into public.cgl_credit_transactions(member_id,lot_id,order_id,kind,amount,source_key,reason,actor)
      values(p_member_id,v_lot.id,v_id,'redeem',-v_take,'redeem:'||v_id||':'||v_lot.id,'Rewards order',p_member_id::text);
    v_need:=v_need-v_take;
  end loop;
  if v_need<>0 then raise exception 'Credit allocation conflict'; end if;
  update public.cgl_catalogue set stock=stock-p_quantity where id=p_catalogue_id;
  insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,after_data)
    values(p_member_id::text,'redeem','order',v_id::text,'Member confirmed redemption',jsonb_build_object('credits',v_item.credit_price*p_quantity));
  return v_id;
end $$;

create function public.cgl_adjust_credits(p_member_id uuid,p_amount integer,p_request_key text,p_reason text,p_actor text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_need int; v_balance bigint; v_lot record; v_take int; v_id uuid; v_previous jsonb;
begin
  if p_amount=0 or length(trim(p_reason))<5 then raise exception 'Adjustment amount and reason required'; end if;
  perform 1 from public.cgl_members where id=p_member_id for update;
  if not found then raise exception 'Member not found'; end if;
  select after_data into v_previous from public.cgl_audit_events where action='adjust_credits' and entity_id=p_request_key;
  if found then
    if v_previous->>'member_id'<>p_member_id::text or (v_previous->>'amount')::int<>p_amount then raise exception 'Idempotency conflict'; end if;
    return jsonb_build_object('already_processed',true);
  end if;
  if p_amount>0 then
    v_id:=public.cgl_issue_credits(p_member_id,p_amount,'adjust:'||p_request_key,'{}',p_reason,p_actor);
  else
    v_need:=-p_amount;
    select coalesce(sum(remaining_amount),0) into v_balance from public.cgl_credit_lots where member_id=p_member_id and expires_at>now();
    if v_balance<v_need then raise exception 'Adjustment would create a negative available balance'; end if;
    for v_lot in select * from public.cgl_credit_lots where member_id=p_member_id and expires_at>now() and remaining_amount>0 order by expires_at,id for update loop
      exit when v_need=0; v_take:=least(v_need,v_lot.remaining_amount);
      update public.cgl_credit_lots set remaining_amount=remaining_amount-v_take where id=v_lot.id;
      insert into public.cgl_credit_transactions(member_id,lot_id,kind,amount,source_key,reason,actor)
        values(p_member_id,v_lot.id,'adjustment',-v_take,'adjust:'||p_request_key||':'||v_lot.id,p_reason,p_actor);
      v_need:=v_need-v_take;
    end loop;
  end if;
  insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,after_data)
    values(p_actor,'adjust_credits','member',p_request_key,p_reason,jsonb_build_object('member_id',p_member_id,'amount',p_amount));
  return jsonb_build_object('processed',true,'lot_id',v_id);
end $$;

create function public.cgl_expire_credits() returns integer language plpgsql security invoker set search_path='' as $$
declare v_lot record; v_count int:=0;
begin
  for v_lot in select * from public.cgl_credit_lots where expires_at<=now() and remaining_amount>0 order by member_id,expires_at for update skip locked loop
    insert into public.cgl_credit_transactions(member_id,lot_id,kind,amount,source_key,reason,actor)
      values(v_lot.member_id,v_lot.id,'expire',-v_lot.remaining_amount,'expiry:'||v_lot.id,'Credits reached individual expiry date','scheduler') on conflict(source_key) do nothing;
    update public.cgl_credit_lots set remaining_amount=0 where id=v_lot.id;
    v_count:=v_count+1;
  end loop;
  insert into public.cgl_notifications(member_id,kind,title,body,source_key)
    select member_id,'credits_expiring','CGS Credits expiring soon','Some of your CGS Credits expire within 30 days. Visit Rewards to see the exact amounts and dates.','expiring:'||id
    from public.cgl_credit_lots where expires_at>now() and expires_at<=now()+interval '30 days' and remaining_amount>0 on conflict(source_key) do nothing;
  return v_count;
end $$;

-- Allowlisted configuration editing with the before/after audit in the SAME transaction.
create function public.cgl_admin_save(p_entity text,p_record jsonb,p_actor text,p_reason text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_table text; v_key text; v_allowed text[]; v_columns text; v_updates text; v_bad text; v_before jsonb; v_after jsonb; v_k text;
begin
  if length(trim(p_reason))<3 then raise exception 'An audit reason is required'; end if;
  case p_entity
    when 'season' then v_table:='cgl_seasons';v_key:='id';v_allowed:=array['id','slug','name','year','season_number','format','starts_at','ends_at','qualification_ends_at','status','config'];
    when 'week' then v_table:='cgl_weeks';v_key:='id';v_allowed:=array['id','season_id','week_number','championship_week','name','phase','opens_at','closes_at','status','course_name','second_course_name','conditions','sgt_tournament_id','sgt_tour_id','config'];
    when 'plan' then v_table:='cgl_plans';v_key:='code';v_allowed:=array['code','name','price_cents','billing_interval','full_member','auto_renew','active','config'];
    when 'catalogue' then v_table:='cgl_catalogue';v_key:='id';v_allowed:=array['id','name','description','credit_price','retail_cents','cost_cents','cash_cents','stock','image_url','kind','fulfilment_method','active','available_from','available_until','restrictions'];
    when 'gift_item' then v_table:='cgl_gift_items';v_key:='id';v_allowed:=array['id','season_id','name','unit_cost_cents','stock','active','config'];
    when 'setting' then v_table:='cgl_settings';v_key:='key';v_allowed:=array['key','value'];
    when 'member' then v_table:='cgl_members';v_key:='id';v_allowed:=array['id','handicap','handicap_status','qualifying_holes','handicap_verified_at','eligibility','private_notes'];
    else raise exception 'Unsupported configuration entity';
  end case;
  select k into v_bad from jsonb_object_keys(p_record) k where not(k=any(v_allowed)) limit 1;
  if v_bad is not null then raise exception 'Unsupported field: %',v_bad; end if;
  v_k:=p_record->>v_key;
  if v_k is null then raise exception 'Record key required'; end if;
  if p_entity='member' and not exists(select 1 from public.cgl_members where id=v_k::uuid) then raise exception 'Member not found'; end if;
  if p_entity='week' and exists(select 1 from public.cgl_weeks where id=v_k::uuid and results_published) then raise exception 'Unpublish results before changing this fixture'; end if;
  execute format('select to_jsonb(t) from public.%I t where %I::text=$1 for update',v_table,v_key) into v_before using v_k;
  select string_agg(format('%I',k),','),string_agg(format('%I=excluded.%I',k,k),',') into v_columns,v_updates from jsonb_object_keys(p_record) k;
  -- UPDATE existing rows avoids re-evaluating unrelated NOT NULL columns during an upsert.
  if v_before is not null then
    execute format('update public.%I set (%s)=(select %s from jsonb_populate_record(null::public.%I,$1)) where %I::text=$2 returning to_jsonb(%I.*)',v_table,v_columns,v_columns,v_table,v_key,v_table) into v_after using p_record,v_k;
  else
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) returning to_jsonb(%I.*)',v_table,v_columns,v_columns,v_table,v_table) into v_after using p_record;
  end if;
  insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,before_data,after_data)
    values(p_actor,'save_'||p_entity,p_entity,v_k,p_reason,v_before,v_after);
  return v_after;
end $$;

create function public.cgl_generate_fixtures(p_season_id uuid,p_actor text,p_reason text) returns integer
language plpgsql security invoker set search_path='' as $$
declare v_season public.cgl_seasons; v_week int; v_count int:=0;
begin
  if length(trim(p_reason))<5 then raise exception 'Fixture generation reason required'; end if;
  select * into v_season from public.cgl_seasons where id=p_season_id for update;
  if not found then raise exception 'Season not found'; end if;
  if v_season.starts_at is null or v_season.ends_at is null or v_season.ends_at-v_season.starts_at<>interval '91 days' then raise exception 'Publish an exact 13-week season window before generating fixtures'; end if;
  if exists(select 1 from public.cgl_weeks where season_id=p_season_id) then raise exception 'Fixtures already exist. Edit them individually to preserve their official references'; end if;
  for v_week in 1..13 loop
    perform public.cgl_admin_save('week',jsonb_build_object('id',gen_random_uuid(),'season_id',p_season_id,'week_number',v_week,
      'championship_week',case when v_week>3 then v_week-3 else null end,'name',case when v_week<=3 then 'Qualification '||v_week else 'Championship '||(v_week-3) end,
      'phase',case when v_week<=3 then 'qualification' else 'championship' end,
      'opens_at',v_season.starts_at+make_interval(days=>(v_week-1)*7),'closes_at',v_season.starts_at+make_interval(days=>v_week*7),'status','draft'),p_actor,p_reason);
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

create function public.cgl_review_result(p_id uuid,p_state text,p_reason text,p_actor text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_old public.cgl_results; v_new public.cgl_results;
begin
  if p_state not in ('verified','excluded','pending') or length(trim(p_reason))<5 then raise exception 'Review decision and reason required'; end if;
  select * into v_old from public.cgl_results where id=p_id for update;
  if not found or v_old.state='superseded' then raise exception 'Current result not found'; end if;
  perform 1 from public.cgl_weeks where id=v_old.week_id for update;
  if exists(select 1 from public.cgl_weeks where id=v_old.week_id and results_published) then raise exception 'Unpublish results before correcting a result; awarded credits require a separate auditable reversal'; end if;
  update public.cgl_results set state=p_state,reason=p_reason,verified_by=p_actor,verified_at=case when p_state='verified' then now() else null end,updated_at=now() where id=p_id returning * into v_new;
  insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,before_data,after_data)
    values(p_actor,'review_result','result',p_id::text,p_reason,to_jsonb(v_old),to_jsonb(v_new));
  return to_jsonb(v_new);
end $$;

create function public.cgl_publish_block(p_week_ids uuid[],p_opens_at timestamptz,p_closes_at timestamptz,p_actor text,p_reason text) returns integer
language plpgsql security invoker set search_path='' as $$
declare v_week public.cgl_weeks; v_count int:=0; v_new jsonb;
begin
  if cardinality(p_week_ids)<1 or cardinality(p_week_ids)>13 or length(trim(p_reason))<5 then raise exception 'Select 1–13 fixtures and provide a publishing reason'; end if;
  if (select count(*) from public.cgl_weeks where id=any(p_week_ids))<>cardinality(p_week_ids) then raise exception 'Fixture selection contains missing or duplicate IDs'; end if;
  for v_week in select * from public.cgl_weeks where id=any(p_week_ids) order by id for update loop
    if v_week.results_published or v_week.status in ('locked','archived') then raise exception 'Published results and archived fixtures cannot be included in a release block'; end if;
    if not exists(select 1 from public.cgl_seasons where id=v_week.season_id and status in ('registration','published','active')) then raise exception 'Publish the parent season before releasing fixtures'; end if;
    if coalesce(p_opens_at,v_week.opens_at) is null or coalesce(p_closes_at,v_week.closes_at) is null or coalesce(p_closes_at,v_week.closes_at)<=coalesce(p_opens_at,v_week.opens_at) then raise exception 'Every released fixture needs a positive opening and deadline window'; end if;
    update public.cgl_weeks set status='published',opens_at=coalesce(p_opens_at,opens_at),closes_at=coalesce(p_closes_at,closes_at),updated_at=now() where id=v_week.id returning to_jsonb(cgl_weeks.*) into v_new;
    insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,before_data,after_data) values(p_actor,'publish_block','week',v_week.id::text,p_reason,to_jsonb(v_week),v_new);
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

create function public.cgl_publish_calculation(p_week_id uuid,p_calculation jsonb,p_actor text,p_publish boolean)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_week public.cgl_weeks; v_id uuid; v_award jsonb; v_existing public.cgl_prizes; v_source text; v_snapshot jsonb; v_prize_id uuid;
begin
  select * into v_week from public.cgl_weeks where id=p_week_id for update;
  if not found then raise exception 'Competition week not found'; end if;
  if v_week.phase<>'championship' then raise exception 'Qualification rounds do not award championship points or prizes'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'updated_at',updated_at) order by id),'[]') into v_snapshot from public.cgl_results where week_id=p_week_id and state='verified';
  if v_snapshot<>p_calculation->'source_snapshot' then raise exception 'Results changed during calculation; recalculate'; end if;
  if exists(select 1 from public.cgl_results where week_id=p_week_id and state='pending') then raise exception 'Review all pending imported results before calculating'; end if;
  if p_publish and coalesce((p_calculation->>'manual_review')::boolean,true) then raise exception 'Unresolved ties require verified detail or manual correction before publication'; end if;
  if p_publish then
    if exists(select 1 from public.cgl_prizes p where p.week_id=p_week_id and p.state<>'reversed' and p.source_key like 'weekly:%' and not exists(
      select 1 from jsonb_array_elements(p_calculation->'awards') a where a->>'category'=p.category and a->>'playerId'=p.member_id::text and (a->>'credits')::int=p.amount
    )) then raise exception 'Existing weekly prizes differ; reconcile and reverse them explicitly before republishing'; end if;
    for v_award in select value from jsonb_array_elements(p_calculation->'awards') loop
      v_source:='weekly:'||p_week_id||':'||(v_award->>'category');
      select * into v_existing from public.cgl_prizes where source_key=v_source;
      if found and (v_existing.member_id<>(v_award->>'playerId')::uuid or v_existing.amount<>(v_award->>'credits')::int or v_existing.state='reversed') then
        raise exception 'Previously issued award differs; an administrator must reconcile and reverse it explicitly';
      end if;
      insert into public.cgl_prizes(member_id,season_id,week_id,category,kind,amount,state,source_key)
        values((v_award->>'playerId')::uuid,v_week.season_id,p_week_id,v_award->>'category','credits',(v_award->>'credits')::int,'awarded',v_source) on conflict(source_key) do nothing;
      select id into v_prize_id from public.cgl_prizes where source_key=v_source;
      if (v_award->>'credits')::int>0 then
        perform public.cgl_issue_credits((v_award->>'playerId')::uuid,(v_award->>'credits')::int,'prize:'||v_prize_id,jsonb_build_object('week_id',p_week_id,'season_id',v_week.season_id,'prize_id',v_prize_id,'award',v_award->>'category'),'Verified weekly award',p_actor);
      end if;
    end loop;
  end if;
  insert into public.cgl_calculations(week_id,rules_version,points_version,source_snapshot,rows,awards,manual_review,created_by,published_at)
    values(p_week_id,p_calculation->>'rules_version',p_calculation->'points_version',p_calculation->'source_snapshot',p_calculation->'rows',p_calculation->'awards',(p_calculation->>'manual_review')::boolean,p_actor,case when p_publish then now() else null end) returning id into v_id;
  if p_publish then update public.cgl_weeks set results_published=true,status='locked',updated_at=now() where id=p_week_id; end if;
  insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,after_data)
    values(p_actor,case when p_publish then 'publish_results' else 'recalculate' end,'week',p_week_id::text,'Calculated from verified source records',jsonb_build_object('calculation_id',v_id));
  return v_id;
end $$;

create function public.cgl_allocate_gift(p_member_id uuid,p_gift_item_id uuid,p_actor text,p_reason text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_item public.cgl_gift_items; v_season public.cgl_seasons; v_membership public.cgl_memberships; v_payments int; v_id uuid; v_rules jsonb; v_min_week int; v_required int;
begin
  if length(trim(p_reason))<3 then raise exception 'Gift allocation reason required'; end if;
  perform 1 from public.cgl_members where id=p_member_id and eligibility='active' for update;
  if not found then raise exception 'Eligible CGL member not found'; end if;
  select * into v_item from public.cgl_gift_items where id=p_gift_item_id for update;
  if not found then raise exception 'Gift unavailable'; end if;
  select id into v_id from public.cgl_gifts where member_id=p_member_id and season_id=v_item.season_id;
  if found then return v_id; end if;
  if not v_item.active or v_item.stock<1 then raise exception 'Gift unavailable'; end if;
  select * into v_season from public.cgl_seasons where id=v_item.season_id;
  select value into v_rules from public.cgl_settings where key='gifts';
  v_min_week:=coalesce((v_rules->>'annual_release_week')::integer,5);
  if v_min_week<1 or v_min_week>13 then raise exception 'Invalid seasonal gift release configuration'; end if;
  if v_season.starts_at is null or v_season.ends_at is null or now()<v_season.starts_at+make_interval(days=>(v_min_week-1)*7) or now()>=v_season.ends_at then raise exception 'The configured season gift release window is not open'; end if;
  select m.* into v_membership from public.cgl_memberships m join public.cgl_plans p on p.code=m.plan_code where m.member_id=p_member_id and m.metadata->>'environment' is distinct from 'sandbox' and p.full_member and m.state in ('active','cancel_scheduled') and m.starts_at<=now() and m.paid_through>now() and (m.cancel_effective_at is null or m.cancel_effective_at>now()) order by m.starts_at desc limit 1;
  if not found then raise exception 'Active full membership required'; end if;
  select count(*) into v_payments from public.cgl_payments where membership_id=v_membership.id and metadata->>'environment' is distinct from 'sandbox' and state='completed' and amount_cents>0;
  v_required:=case when v_membership.plan_code='monthly' then coalesce((v_rules->>'monthly_payments')::integer,2) when v_membership.plan_code='weekly' then coalesce((v_rules->>'weekly_payments')::integer,5) else 1 end;
  if v_required<1 or v_payments<v_required then raise exception 'Required successful payment count not reached'; end if;
  if v_membership.starts_at>v_season.starts_at and coalesce((v_rules->>'midseason_review_required')::boolean,true) and not coalesce((v_membership.metadata->>'midseason_gift_approved')::boolean,false) then raise exception 'Mid-season gift eligibility requires recorded administrator review'; end if;
  insert into public.cgl_gifts(member_id,season_id,gift_item_id,unit_cost_cents,notes) values(p_member_id,v_item.season_id,p_gift_item_id,v_item.unit_cost_cents,p_reason) returning id into v_id;
  update public.cgl_gift_items set stock=stock-1 where id=p_gift_item_id;
  insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,after_data) values(p_actor,'allocate_gift','gift',v_id::text,p_reason,jsonb_build_object('member_id',p_member_id,'gift_item_id',p_gift_item_id));
  return v_id;
end $$;

create function public.cgl_import_results(p_week_id uuid,p_source_url text,p_checksum text,p_rows jsonb,p_actor text,p_reason text,p_correction boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_import uuid; v_row jsonb; v_old public.cgl_results; v_count int:=0; v_duplicate int:=0; v_id uuid;
begin
  if length(trim(p_reason))<5 or jsonb_array_length(p_rows)<1 or jsonb_array_length(p_rows)>500 then raise exception 'Import requires source, reason and 1–500 records'; end if;
  perform 1 from public.cgl_weeks where id=p_week_id for update;
  if not found then raise exception 'Week not found'; end if;
  if exists(select 1 from public.cgl_weeks where id=p_week_id and results_published) then raise exception 'Unpublish results before importing corrections'; end if;
  select id into v_import from public.cgl_imports where week_id=p_week_id and checksum=p_checksum;
  if found then return jsonb_build_object('id',v_import,'already_processed',true); end if;
  insert into public.cgl_imports(week_id,source,source_url,actor,state,checksum) values(p_week_id,'verified_manual',p_source_url,p_actor,'pending',p_checksum) returning id into v_import;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if exists(select 1 from public.cgl_results r where r.week_id<>p_week_id and r.external_id=v_row->>'external_id') then raise exception 'An official result cannot be reused in a different competition week'; end if;
    if exists(
      select 1 from public.cgl_results r cross join lateral jsonb_array_elements(coalesce(r.raw_result->'attempts','[]')) prior_attempt
      where r.week_id<>p_week_id and prior_attempt->>'id' in (select incoming->>'id' from jsonb_array_elements(coalesce(v_row->'attempts','[]')) incoming)
    ) then raise exception 'An official nine-hole attempt has already been recorded against another competition week'; end if;
    select * into v_old from public.cgl_results where week_id=p_week_id and external_id=v_row->>'external_id' and state<>'superseded' for update;
    if found then
      if v_old.raw_result=v_row then v_duplicate:=v_duplicate+1;continue; end if;
      if not p_correction then raise exception 'Changed existing result % requires explicit correction and review',v_old.external_id; end if;
      update public.cgl_results set state='superseded',updated_at=now() where id=v_old.id;
      insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,before_data)
        values(p_actor,'supersede_result','result',v_old.id::text,p_reason,to_jsonb(v_old));
    end if;
    insert into public.cgl_results(week_id,member_id,import_id,external_id,revision,source_url,scorecard_url,gross,net,handicap,division,holes,stats,raw_result,played_at,reason)
      values(p_week_id,(v_row->>'member_id')::uuid,v_import,v_row->>'external_id',coalesce(v_old.revision,0)+1,p_source_url,v_row->>'scorecard_url',
        (v_row->>'gross')::numeric,(v_row->>'net')::numeric,(v_row->>'handicap')::numeric,v_row->>'division',coalesce(v_row->'holes','[]'),coalesce(v_row->'stats','{}'),v_row,(v_row->>'played_at')::timestamptz,p_reason) returning id into v_id;
    v_count:=v_count+1;
  end loop;
  update public.cgl_imports set state='completed',imported_count=v_count where id=v_import;
  insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,after_data)
    values(p_actor,'import_results','import',v_import::text,p_reason,jsonb_build_object('week_id',p_week_id,'count',v_count,'unchanged',v_duplicate,'source_url',p_source_url));
  return jsonb_build_object('id',v_import,'imported',v_count,'unchanged',v_duplicate);
end $$;

create function public.cgl_command(p_action text,p_payload jsonb,p_actor text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_before jsonb; v_after jsonb; v_reason text; v_member uuid; v_item public.cgl_gift_items; v_prize public.cgl_prizes; v_request public.cgl_sgt_link_requests; v_order public.cgl_orders; v_transaction record;
begin
  v_reason:=coalesce(p_payload->>'reason','Member request');
  if length(trim(v_reason))<3 then raise exception 'An audit reason is required'; end if;
  case p_action
  when 'join' then
    v_member:=(p_payload->>'member_id')::uuid;
    insert into public.cgl_members(id,email,display_name,sgt_username,sgt_id,metadata)
      values(v_member,p_payload->>'email',p_payload->>'display_name',p_payload->>'sgt_username',p_payload->>'sgt_id',coalesce(p_payload->'metadata','{}'))
      on conflict(id) do nothing;
    select to_jsonb(m) into v_after from public.cgl_members m where id=v_member;
    v_id:=v_member;
  when 'link_sgt' then
    v_member:=(p_payload->>'member_id')::uuid;
    perform 1 from public.cgl_members where id=v_member for update;
    if not found then raise exception 'Join CGL before requesting an SGT connection'; end if;
    if exists(select 1 from public.cgl_sgt_link_requests where member_id=v_member and state='pending') then raise exception 'An SGT connection is already awaiting review'; end if;
    insert into public.cgl_sgt_link_requests(member_id,sgt_username,sgt_id) values(v_member,p_payload->>'sgt_username',p_payload->>'sgt_id') returning id into v_id;
    v_after:=jsonb_build_object('id',v_id,'state','pending');
  when 'verify_sgt' then
    select * into v_request from public.cgl_sgt_link_requests where id=(p_payload->>'id')::uuid and state='pending' for update;
    if not found then raise exception 'Pending SGT request not found'; end if;
    v_before:=to_jsonb(v_request);v_id:=v_request.id;
    if p_payload->>'state'='verified' then
      update public.cgl_members set sgt_username=v_request.sgt_username,sgt_id=v_request.sgt_id,sgt_verified_at=now(),updated_at=now() where id=v_request.member_id;
    elsif p_payload->>'state'<>'rejected' then raise exception 'Choose verified or rejected'; end if;
    update public.cgl_sgt_link_requests set state=p_payload->>'state',reason=v_reason,reviewed_by=p_actor,reviewed_at=now() where id=v_id returning to_jsonb(cgl_sgt_link_requests.*) into v_after;
  when 'assign_division' then
    if p_payload->>'division'='C' and not coalesce((select (value->>'c_grade_enabled')::boolean from public.cgl_settings where key='divisions'),false) then raise exception 'C Grade is not active'; end if;
    select to_jsonb(d) into v_before from public.cgl_division_assignments d where member_id=(p_payload->>'member_id')::uuid and season_id=(p_payload->>'season_id')::uuid for update;
    insert into public.cgl_division_assignments(member_id,season_id,division,handicap_at_assignment,locked_at,reason,assigned_by)
      values((p_payload->>'member_id')::uuid,(p_payload->>'season_id')::uuid,p_payload->>'division',(p_payload->>'handicap')::numeric,(p_payload->>'locked_at')::timestamptz,v_reason,p_actor)
      on conflict(member_id,season_id) do update set division=excluded.division,handicap_at_assignment=excluded.handicap_at_assignment,locked_at=excluded.locked_at,reason=excluded.reason,assigned_by=excluded.assigned_by returning id,to_jsonb(cgl_division_assignments.*) into v_id,v_after;
  when 'unpublish_results' then
    v_id:=(p_payload->>'week_id')::uuid;
    select to_jsonb(w) into v_before from public.cgl_weeks w where id=v_id for update;
    if not found then raise exception 'Week not found'; end if;
    update public.cgl_weeks set results_published=false,status='closed',updated_at=now() where id=v_id returning to_jsonb(cgl_weeks.*) into v_after;
  when 'request_cancellation' then
    v_id:=(p_payload->>'membership_id')::uuid;
    select to_jsonb(m) into v_before from public.cgl_memberships m where id=v_id and member_id=(p_payload->>'member_id')::uuid and state in ('active','past_due','cancel_scheduled') for update;
    if not found then raise exception 'Cancellable membership not found'; end if;
    if exists(select 1 from public.cgl_memberships where id=v_id and cancel_requested_at is not null) then return v_before; end if;
    update public.cgl_memberships set cancel_requested_at=now(),
      cancel_effective_at=case when p_payload->'quote'->>'status'='ready' then (p_payload->'quote'->>'effectiveAt')::timestamptz else null end,
      state=case when p_payload->'quote'->>'status'='ready' then 'cancel_scheduled' else state end,
      metadata=metadata||jsonb_build_object('cancellation_quote',p_payload->'quote','cancellation_reason',v_reason),updated_at=now()
      where id=v_id returning to_jsonb(cgl_memberships.*) into v_after;
    insert into public.cgl_notifications(member_id,kind,title,body,source_key) values((p_payload->>'member_id')::uuid,'cancellation','Cancellation request received',case when p_payload->'quote'->>'status'='ready' then 'Your cancellation date is recorded in Membership.' else 'Your request is recorded for review. Proposed cancellation terms are not yet approved.' end,'cancellation:'||v_id) on conflict(source_key) do nothing;
  when 'approve_midseason_gift' then
    v_id:=(p_payload->>'membership_id')::uuid;
    select to_jsonb(m) into v_before from public.cgl_memberships m where id=v_id for update;
    if not found then raise exception 'Membership not found'; end if;
    update public.cgl_memberships set metadata=metadata||jsonb_build_object('midseason_gift_approved',true,'gift_review_reason',v_reason,'gift_review_actor',p_actor),updated_at=now() where id=v_id returning to_jsonb(cgl_memberships.*) into v_after;
  when 'fulfil_order' then
    v_id:=(p_payload->>'id')::uuid;
    select * into v_order from public.cgl_orders where id=v_id for update;
    if not found or v_order.state='cancelled' then raise exception 'Fulfillable order not found'; end if;
    v_before:=to_jsonb(v_order);
    if p_payload->>'state' not in ('ready','dispatched','collected') then raise exception 'Invalid fulfilment state'; end if;
    if v_order.state in ('dispatched','collected') and v_order.state<>p_payload->>'state' then raise exception 'Completed order cannot change fulfilment outcome'; end if;
    update public.cgl_orders set state=p_payload->>'state',fulfilment_notes=v_reason,fulfilled_at=case when p_payload->>'state' in ('dispatched','collected') then coalesce(fulfilled_at,now()) else null end where id=v_id returning to_jsonb(cgl_orders.*) into v_after;
  when 'cancel_order' then
    v_id:=(p_payload->>'id')::uuid;
    select member_id into v_member from public.cgl_orders where id=v_id;
    perform 1 from public.cgl_members where id=v_member for update;
    select * into v_order from public.cgl_orders where id=v_id for update;
    if not found or v_order.state in ('dispatched','collected') then raise exception 'Only unfulfilled orders can be cancelled'; end if;
    if v_order.state='cancelled' then return to_jsonb(v_order); end if;
    v_before:=to_jsonb(v_order);
    for v_transaction in select t.*,l.expires_at from public.cgl_credit_transactions t join public.cgl_credit_lots l on l.id=t.lot_id where t.order_id=v_id and t.kind='redeem' for update of l loop
      insert into public.cgl_credit_transactions(member_id,lot_id,order_id,kind,amount,source_key,reason,actor) values(v_member,v_transaction.lot_id,v_id,'reversal',-v_transaction.amount,'refund:'||v_transaction.id,v_reason,p_actor);
      if v_transaction.expires_at>now() then update public.cgl_credit_lots set remaining_amount=remaining_amount-v_transaction.amount where id=v_transaction.lot_id;
      else insert into public.cgl_credit_transactions(member_id,lot_id,order_id,kind,amount,source_key,reason,actor) values(v_member,v_transaction.lot_id,v_id,'expire',v_transaction.amount,'refund-expired:'||v_transaction.id,'Returned credits retain original expiry',p_actor); end if;
    end loop;
    update public.cgl_catalogue set stock=stock+v_order.quantity where id=v_order.catalogue_id;
    update public.cgl_orders set state='cancelled',fulfilment_notes=v_reason where id=v_id returning to_jsonb(cgl_orders.*) into v_after;
  when 'fulfil_gift' then
    v_id:=(p_payload->>'id')::uuid;
    select to_jsonb(g) into v_before from public.cgl_gifts g where id=v_id for update;
    if not found or v_before->>'state' in ('dispatched','collected','expired') then raise exception 'Unfulfilled gift not found'; end if;
    if p_payload->>'state' not in ('ready','dispatched','collected') then raise exception 'Invalid gift fulfilment state'; end if;
    update public.cgl_gifts set state=p_payload->>'state',notes=v_reason,fulfilled_at=case when p_payload->>'state' in ('dispatched','collected') then now() else null end where id=v_id returning to_jsonb(cgl_gifts.*) into v_after;
  when 'save_prize' then
    if p_payload->>'kind'='cash' and not coalesce((select (value->>'legal_approved')::boolean from public.cgl_settings where key='prizes'),false) then raise exception 'Cash prize terms require CGS approval and legal review'; end if;
    insert into public.cgl_prizes(member_id,season_id,category,kind,amount,source_key,claim_deadline,metadata)
      values((p_payload->>'member_id')::uuid,(p_payload->>'season_id')::uuid,p_payload->>'category',p_payload->>'kind',(p_payload->>'amount')::integer,p_payload->>'source_key',(p_payload->>'claim_deadline')::timestamptz,coalesce(p_payload->'metadata','{}')) returning id,to_jsonb(cgl_prizes.*) into v_id,v_after;
  when 'review_prize' then
    v_id:=(p_payload->>'id')::uuid;
    select * into v_prize from public.cgl_prizes where id=v_id for update;
    if not found then raise exception 'Prize not found'; end if;
    v_before:=to_jsonb(v_prize);
    if (v_prize.state='pending' and p_payload->>'state'='verified') or (v_prize.state='verified' and p_payload->>'state'='approved') or (v_prize.state='approved' and p_payload->>'state'='awarded') or (v_prize.state='awarded' and p_payload->>'state'='claimed') then null;
    else raise exception 'Invalid prize state transition'; end if;
    if v_prize.kind='credits' and p_payload->>'state'='approved' then
      perform public.cgl_issue_credits(v_prize.member_id,v_prize.amount,'prize:'||v_prize.id,jsonb_build_object('season_id',v_prize.season_id,'prize_id',v_prize.id),v_reason,p_actor);
      p_payload:=jsonb_set(p_payload,'{state}','"awarded"');
    end if;
    update public.cgl_prizes set state=p_payload->>'state',metadata=metadata||jsonb_build_object('last_reason',v_reason,'last_actor',p_actor),updated_at=now() where id=v_id returning to_jsonb(cgl_prizes.*) into v_after;
  when 'reverse_prize' then
    v_id:=(p_payload->>'id')::uuid;
    select member_id into v_member from public.cgl_prizes where id=v_id;
    perform 1 from public.cgl_members where id=v_member for update;
    select * into v_prize from public.cgl_prizes where id=v_id for update;
    if not found then raise exception 'Prize not found'; end if;
    if v_prize.state='reversed' then return to_jsonb(v_prize); end if;
    if v_prize.kind<>'credits' or v_prize.state not in ('awarded','claimed') then raise exception 'Only issued credit prizes can use this compensating reversal'; end if;
    if v_prize.amount>0 then perform public.cgl_adjust_credits(v_prize.member_id,-v_prize.amount,'reverse-prize:'||v_prize.id,v_reason,p_actor); end if;
    v_before:=to_jsonb(v_prize);
    update public.cgl_prizes set state='reversed',source_key=source_key||':reversed:'||id,metadata=metadata||jsonb_build_object('reversal_reason',v_reason,'reversal_actor',p_actor),updated_at=now() where id=v_id returning to_jsonb(cgl_prizes.*) into v_after;
  when 'notification' then
    insert into public.cgl_notifications(member_id,kind,title,body,source_key) values((p_payload->>'member_id')::uuid,p_payload->>'kind',p_payload->>'title',p_payload->>'body',p_payload->>'source_key') returning id,to_jsonb(cgl_notifications.*) into v_id,v_after;
  when 'mark_notification_read' then
    v_id:=(p_payload->>'id')::uuid;
    update public.cgl_notifications set state='read' where id=v_id and member_id=(p_payload->>'member_id')::uuid returning to_jsonb(cgl_notifications.*) into v_after;
    if not found then raise exception 'Notification not found'; end if;
  else raise exception 'Unsupported CGL command';
  end case;
  insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,before_data,after_data)
    values(p_actor,p_action,'command',v_id::text,v_reason,v_before,v_after);
  return coalesce(v_after,jsonb_build_object('id',v_id));
end $$;

create function public.cgl_expire_physical_prizes() returns integer language plpgsql security invoker set search_path='' as $$
declare v_prize public.cgl_prizes; v_count int:=0;
begin
  for v_prize in select * from public.cgl_prizes where kind='physical' and state in ('approved','awarded') and claim_deadline<=now() for update skip locked loop
    update public.cgl_prizes set state='expired',updated_at=now() where id=v_prize.id;
    if v_prize.metadata->>'catalogue_id' is not null then update public.cgl_catalogue set stock=stock+1 where id=(v_prize.metadata->>'catalogue_id')::uuid; end if;
    insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,before_data) values('scheduler','expire_physical_prize','prize',v_prize.id::text,'Published physical prize claim deadline passed',to_jsonb(v_prize));
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

-- Functions are internal server APIs, not anonymous or authenticated PostgREST endpoints.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'cgl_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;

insert into public.cgl_plans(code,name,price_cents,billing_interval,full_member,auto_renew) values
  ('annual','Annual membership',24900,'annual',true,true),('monthly','Monthly membership',2995,'monthly',true,true),
  ('weekly','Weekly membership',895,'weekly',true,true),('casual_registration','Casual registration',2900,'once',false,false),
  ('casual_season','Casual season entry',10000,'once',false,false);
insert into public.cgl_settings(key,value) values
  ('legal','{"approved":false,"review_required":["membership_terms","renewal_disclosure","cancellation_policy","competition_rules","prize_conditions","credit_terms","privacy","consumer_rights"]}'),
  ('cancellation_policy','{"mode":"paid_term","proposed_mode":"season_boundary","approved":false}'),
  ('annual_formula','{"approved":false,"method":null}'),
  ('divisions','{"c_grade_enabled":false,"a_max":9.9,"b_min":10,"c_min":20}'),
  ('rewards','{"credit_expiry_months":18,"credits_per_aud":2,"payment_redemption_enabled":false,"weekly_priority":["net","gross","ctp"],"full":{"net":20,"gross":20,"ctp":10},"casual":{"net":10,"gross":10,"ctp":5}}'),
  ('prizes','{"legal_approved":false,"a_cash_cents":30000,"b_credits":300,"weekly_max_credits":500,"advertised_max_cents":70000}'),
  ('gifts','{"annual_release_week":5,"monthly_payments":2,"weekly_payments":5,"midseason_review_required":true}'),
  ('financial','{"annual_members":10,"monthly_members":6,"weekly_members":4,"sgt_annual_cents":150000,"cash_prizes_cents":120000,"credit_exposure_cents":160000,"contingency_cents":30000,"surplus_target_cents":100000,"square_percentage":null,"square_fixed_cents":null}'),
  ('sgt','{"mode":"verified_manual_import","api_configured":false,"trial_tour_id":"3982","trial_tournament_id":"80736"}'),
  ('points','{"version":"pga-regular-500-2026-v1","approved":false,"source":"https://openqsection.pgatourhq.com/static-assets/uploads/2026-PGA%20TOUR%20Player%20Handbook%20and%20Regulations-2-6-26.pdf","table":[500,300,190,135,110,100,90,85,80,75,70,65,60,57,55,53,51,49,47,45,43,41,39,37,35.5,34,32.5,31,29.5,28,26.5,25,23.5,22,21,20,19,18,17,16,15,14,13,12,11,10.5,10,9.5,9,8.5,8,7.5,7,6.5,6,5.8,5.6,5.4,5.2,5,4.8,4.6,4.4,4.2,4,3.8,3.6,3.4,3.2,3,2.9,2.8,2.7,2.6,2.5,2.4,2.3,2.2,2.1,2,1.9,1.8,1.7,1.6,1.5]}');

commit;
