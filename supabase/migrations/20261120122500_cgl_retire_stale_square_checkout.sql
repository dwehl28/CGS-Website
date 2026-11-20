begin;

create or replace function public.cgl_retire_stale_square_checkout(
  p_intent_id uuid,
  p_member_id uuid,
  p_environment text,
  p_current_terms_version text
) returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_intent public.cgl_square_checkout_intents%rowtype;
  v_membership public.cgl_memberships%rowtype;
  v_published_terms text;
begin
  if p_environment not in ('sandbox','production')
    or nullif(p_current_terms_version,'') is null then
    raise exception 'Invalid checkout retirement boundary';
  end if;

  select value->>'version' into v_published_terms
  from public.cgl_settings
  where key='legal';
  if v_published_terms is distinct from p_current_terms_version then
    raise exception 'Published membership terms changed during checkout retirement';
  end if;

  select * into v_intent
  from public.cgl_square_checkout_intents
  where id=p_intent_id
    and member_id=p_member_id
    and environment=p_environment
  for update;
  if not found or v_intent.state<>'pending' then
    raise exception 'Pending checkout not found';
  end if;
  if v_intent.terms_snapshot->>'terms_version' is not distinct from p_current_terms_version then
    raise exception 'Current checkout cannot be retired as stale';
  end if;

  select * into v_membership
  from public.cgl_memberships
  where id=v_intent.membership_id
    and member_id=p_member_id
  for update;
  if not found or v_membership.state<>'pending' then
    raise exception 'Pending membership not found';
  end if;

  update public.cgl_square_checkout_intents
  set state='cancelled'
  where id=v_intent.id;

  update public.cgl_memberships
  set state='cancelled',
      cancel_requested_at=coalesce(cancel_requested_at,now()),
      cancel_effective_at=coalesce(cancel_effective_at,now()),
      updated_at=now(),
      metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'retired_checkout_id',v_intent.id,
        'retired_reason','terms_changed',
        'retired_at',now()
      )
  where id=v_membership.id;

  return jsonb_build_object(
    'checkout_id',v_intent.id,
    'membership_id',v_membership.id,
    'state','cancelled'
  );
end;
$$;

revoke all on function public.cgl_retire_stale_square_checkout(uuid,uuid,text,text)
from public,anon,authenticated;
grant execute on function public.cgl_retire_stale_square_checkout(uuid,uuid,text,text)
to service_role;

commit;
