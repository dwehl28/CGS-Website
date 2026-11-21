begin;

-- A CGL participant can exist independently of a CGS login. Existing member
-- IDs remain unchanged so every payment, result and SGT relationship survives.
alter table public.cgl_members
  add column account_id uuid references auth.users(id) on delete set null;

update public.cgl_members set account_id=id where account_id is null;

alter table public.cgl_members
  drop constraint if exists cgl_members_id_fkey;
alter table public.cgl_members
  alter column id set default gen_random_uuid();

create unique index cgl_members_account_id_key
  on public.cgl_members(account_id) where account_id is not null;
create unique index cgl_members_email_ci_key
  on public.cgl_members((lower(btrim(email))));
create unique index cgl_members_sgt_username_ci_key
  on public.cgl_members((lower(btrim(sgt_username))))
  where sgt_username is not null;

alter table public.cgl_square_checkout_intents
  add column checkout_channel text not null default 'account'
    check(checkout_channel in ('account','guest')),
  add column guest_access_key_hash text,
  add column guest_access_expires_at timestamptz,
  add constraint cgl_square_guest_access_complete check(
    (checkout_channel='account' and guest_access_key_hash is null and guest_access_expires_at is null)
    or
    (checkout_channel='guest' and guest_access_key_hash ~ '^[0-9a-f]{64}$' and guest_access_expires_at is not null)
  );

create table public.cgl_guest_checkout_attempts (
  id bigint generated always as identity primary key,
  fingerprint text not null check(fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index cgl_guest_checkout_attempts_recent_idx
  on public.cgl_guest_checkout_attempts(fingerprint,created_at desc);
alter table public.cgl_guest_checkout_attempts enable row level security;
revoke all on public.cgl_guest_checkout_attempts from public,anon,authenticated;
grant all on public.cgl_guest_checkout_attempts to service_role;

-- Preserve the provider contract and the guest return credential once an
-- intent is assigned. The one allowed transition is account -> guest before a
-- Square link has been created.
create or replace function public.cgl_square_immutable_link() returns trigger
language plpgsql set search_path='' as $$
begin
  if row(
      new.member_id,new.membership_id,new.plan_code,new.season_id,new.environment,
      new.request_key,new.amount_cents,new.recurring,new.square_plan_variation_id,
      new.terms_snapshot
    ) is distinct from row(
      old.member_id,old.membership_id,old.plan_code,old.season_id,old.environment,
      old.request_key,old.amount_cents,old.recurring,old.square_plan_variation_id,
      old.terms_snapshot
    )
    or (old.square_order_id is not null and new.square_order_id is distinct from old.square_order_id)
    or (old.square_link_id is not null and new.square_link_id is distinct from old.square_link_id)
    or (old.payment_link_url is not null and new.payment_link_url is distinct from old.payment_link_url) then
    raise exception 'Square checkout identity and contract are immutable';
  end if;

  if row(new.checkout_channel,new.guest_access_key_hash,new.guest_access_expires_at)
      is distinct from row(old.checkout_channel,old.guest_access_key_hash,old.guest_access_expires_at) then
    if not (
      old.checkout_channel='account'
      and new.checkout_channel='guest'
      and old.square_order_id is null
      and old.square_link_id is null
      and old.payment_link_url is null
      and old.state='pending'
      and new.guest_access_key_hash ~ '^[0-9a-f]{64}$'
      and new.guest_access_expires_at is not null
    ) then
      raise exception 'Square checkout access identity is immutable';
    end if;
  end if;
  return new;
end $$;

-- Create or safely reuse one participant identity, then prepare the exact same
-- production Square intent used by account-backed checkout.
create function public.cgl_prepare_guest_square_checkout(
  p_email text,
  p_display_name text,
  p_sgt_username text,
  p_plan_code text,
  p_season_id uuid,
  p_request_key uuid,
  p_accepted_amount_cents integer,
  p_access_key_hash text,
  p_access_expires_at timestamptz,
  p_rate_fingerprint text
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_email text:=lower(btrim(p_email));
  v_name text:=btrim(p_display_name);
  v_sgt text:=btrim(p_sgt_username);
  v_member public.cgl_members%rowtype;
  v_sgt_member public.cgl_members%rowtype;
  v_intent public.cgl_square_checkout_intents%rowtype;
  v_prepared jsonb;
begin
  if length(v_email) not between 5 and 254
    or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid purchase email';
  end if;
  if length(v_name) not between 2 and 120 then
    raise exception 'Enter the participant name';
  end if;
  if length(v_sgt) not between 2 and 64
    or v_sgt ~ '[[:space:]/?#]'
    or strpos(v_sgt,chr(92))>0 then
    raise exception 'Enter the exact SGT username';
  end if;
  if p_access_key_hash !~ '^[0-9a-f]{64}$'
    or p_rate_fingerprint !~ '^[0-9a-f]{64}$'
    or p_access_expires_at<=now()+interval '15 minutes'
    or p_access_expires_at>now()+interval '7 days' then
    raise exception 'Guest checkout security details are invalid';
  end if;

  delete from public.cgl_guest_checkout_attempts
  where created_at<now()-interval '1 day';
  if (
    select count(*) from public.cgl_guest_checkout_attempts
    where fingerprint=p_rate_fingerprint and created_at>now()-interval '1 hour'
  )>=10 then
    raise exception 'Too many checkout attempts. Wait before trying again';
  end if;
  insert into public.cgl_guest_checkout_attempts(fingerprint)
  values(p_rate_fingerprint);

  perform pg_advisory_xact_lock(hashtextextended('cgl-guest-email:'||v_email,0));
  perform pg_advisory_xact_lock(hashtextextended('cgl-guest-sgt:'||lower(v_sgt),0));

  select * into v_member from public.cgl_members
  where lower(btrim(email))=v_email for update;
  select * into v_sgt_member from public.cgl_members
  where lower(btrim(sgt_username))=lower(v_sgt) for update;

  if v_member.id is not null and v_sgt_member.id is not null
    and v_member.id<>v_sgt_member.id then
    raise exception 'The purchase details do not match one CGL participant';
  end if;
  if v_member.id is null and v_sgt_member.id is not null then
    raise exception 'The purchase details do not match one CGL participant';
  end if;

  if v_member.id is null then
    insert into public.cgl_members(
      email,display_name,sgt_username,metadata
    ) values(
      v_email,v_name,v_sgt,
      jsonb_build_object('source','guest_checkout','account_optional',true)
    ) returning * into v_member;
    insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,after_data)
    values(
      'guest-checkout','create_guest_participant','member',v_member.id::text,
      'Participant created for account-optional CGL checkout',
      jsonb_build_object('member_id',v_member.id,'sgt_username',v_member.sgt_username)
    );
  else
    if v_member.sgt_username is null then
      if v_member.account_id is not null then
        raise exception 'Sign in to connect an SGT username to this existing account';
      end if;
      update public.cgl_members set sgt_username=v_sgt,updated_at=now()
      where id=v_member.id returning * into v_member;
    elsif lower(btrim(v_member.sgt_username))<>lower(v_sgt) then
      raise exception 'The purchase details do not match one CGL participant';
    end if;
  end if;

  v_prepared:=public.cgl_prepare_square_live_checkout(
    v_member.id,p_plan_code,p_season_id,p_request_key,p_accepted_amount_cents
  );
  select * into strict v_intent from public.cgl_square_checkout_intents
  where id=(v_prepared->>'id')::uuid for update;

  if v_intent.checkout_channel='account' then
    if v_intent.square_link_id is not null or v_intent.square_order_id is not null
      or v_intent.payment_link_url is not null then
      raise exception 'An account checkout already exists for this purchase';
    end if;
    update public.cgl_square_checkout_intents set
      checkout_channel='guest',guest_access_key_hash=p_access_key_hash,
      guest_access_expires_at=p_access_expires_at
    where id=v_intent.id returning * into v_intent;
  elsif v_intent.guest_access_key_hash is distinct from p_access_key_hash then
    raise exception 'This guest checkout belongs to another browser request';
  end if;

  return to_jsonb(v_intent);
end $$;

-- A later login claims the existing guest participant instead of creating a
-- duplicate, preserving SGT results and the full financial history.
create function public.cgl_claim_or_join_account(
  p_account_id uuid,
  p_email text,
  p_display_name text,
  p_sgt_username text default null,
  p_sgt_id text default null,
  p_metadata jsonb default '{}'
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  v_email text:=lower(btrim(p_email));
  v_name text:=btrim(p_display_name);
  v_sgt text:=nullif(btrim(p_sgt_username),'');
  v_member public.cgl_members%rowtype;
begin
  if p_account_id is null or length(v_email) not between 5 and 254
    or length(v_name) not between 2 and 120 then
    raise exception 'Verified account details are required';
  end if;
  if v_sgt is not null and (
    length(v_sgt) not between 2 and 64 or v_sgt ~ '[[:space:]/?#]'
    or strpos(v_sgt,chr(92))>0
  ) then raise exception 'The SGT username is invalid'; end if;
  if p_sgt_id is not null and p_sgt_id !~ '^[0-9]{8,30}$' then
    raise exception 'The SGT ID is invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('cgl-account:'||p_account_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('cgl-guest-email:'||v_email,0));

  select * into v_member from public.cgl_members
  where account_id=p_account_id or id=p_account_id
  order by (account_id=p_account_id) desc limit 1 for update;
  if v_member.id is null then
    select * into v_member from public.cgl_members
    where lower(btrim(email))=v_email for update;
  end if;

  if v_member.id is null then
    insert into public.cgl_members(
      id,account_id,email,display_name,sgt_username,sgt_id,metadata
    ) values(
      p_account_id,p_account_id,v_email,v_name,v_sgt,p_sgt_id,
      coalesce(p_metadata,'{}')||jsonb_build_object('source','existing_cgs_auth')
    ) returning * into v_member;
  else
    if v_member.account_id is not null and v_member.account_id<>p_account_id then
      raise exception 'This purchase email is already linked to another CGS account';
    end if;
    if lower(btrim(v_member.email))<>v_email then
      raise exception 'The account email does not match this CGL participant';
    end if;
    if v_member.sgt_username is not null and v_sgt is not null
      and lower(btrim(v_member.sgt_username))<>lower(v_sgt) then
      raise exception 'The account SGT username does not match this CGL participant';
    end if;
    update public.cgl_members set
      account_id=p_account_id,
      display_name=case when display_name='' then v_name else display_name end,
      sgt_username=coalesce(sgt_username,v_sgt),
      sgt_id=coalesce(sgt_id,p_sgt_id),
      metadata=metadata||coalesce(p_metadata,'{}')||jsonb_build_object(
        'account_claimed_at',now(),'account_optional',true
      ),
      updated_at=now()
    where id=v_member.id returning * into v_member;
  end if;

  insert into public.cgl_audit_events(actor,action,entity,entity_id,reason,after_data)
  values(
    p_account_id::text,'claim_or_join_account','member',v_member.id::text,
    'Verified CGS account linked to CGL participant',
    jsonb_build_object('member_id',v_member.id,'account_id',p_account_id)
  );
  return to_jsonb(v_member);
end $$;

revoke all on function public.cgl_prepare_guest_square_checkout(
  text,text,text,text,uuid,uuid,integer,text,timestamptz,text
) from public,anon,authenticated;
revoke all on function public.cgl_claim_or_join_account(
  uuid,text,text,text,text,jsonb
) from public,anon,authenticated;
grant execute on function public.cgl_prepare_guest_square_checkout(
  text,text,text,text,uuid,uuid,integer,text,timestamptz,text
) to service_role;
grant execute on function public.cgl_claim_or_join_account(
  uuid,text,text,text,text,jsonb
) to service_role;

commit;
