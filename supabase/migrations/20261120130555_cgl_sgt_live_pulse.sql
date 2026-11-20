-- A focused, demand-driven SGT refresh keeps public tournament views current
-- without running the much heavier full-club import for every visitor.
alter table public.cgl_sgt_connections
  add column if not exists live_sync_enabled boolean not null default true,
  add column if not exists live_sync_interval_seconds integer not null default 45
    check (live_sync_interval_seconds between 30 and 300),
  add column if not exists last_live_sync_started_at timestamptz,
  add column if not exists last_live_sync_at timestamptz,
  add column if not exists last_live_success_at timestamptz;

alter table public.cgl_sgt_sync_runs
  drop constraint if exists cgl_sgt_sync_runs_trigger_check;
alter table public.cgl_sgt_sync_runs
  add constraint cgl_sgt_sync_runs_trigger_check
  check (trigger in ('connect','manual','schedule','recovery','live'));

create or replace function public.cgl_sgt_claim_live_sync(
  p_club_slug text,
  p_lease_token uuid
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rows integer := 0;
begin
  update public.cgl_sgt_connections
     set lease_token = p_lease_token,
         lease_until = now() + interval '2 minutes',
         status = 'syncing',
         last_live_sync_started_at = now(),
         last_live_sync_at = now(),
         updated_at = now()
   where club_slug = p_club_slug
     and sync_enabled
     and live_sync_enabled
     and api_key_secret_id is not null
     and (lease_until is null or lease_until < now())
     and (
       last_live_sync_at is null
       or last_live_sync_at
          + make_interval(secs => live_sync_interval_seconds) <= now()
     );
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke all on function public.cgl_sgt_claim_live_sync(text,uuid)
  from public, anon, authenticated;
grant execute on function public.cgl_sgt_claim_live_sync(text,uuid)
  to service_role;

update public.cgl_settings
   set value = value || jsonb_build_object(
         'live_refresh_seconds', 45,
         'public_poll_seconds', 15
       ),
       updated_at = now(),
       updated_by = 'migration:cgl_sgt_live_pulse'
 where key = 'sgt';
