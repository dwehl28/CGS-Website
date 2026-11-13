-- Official Simulator Golf Tour snapshots for CGL. SGT remains the source of
-- truth; these tables are a private, read-only cache used by the website.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table public.cgl_sgt_connections (
  club_slug text primary key,
  club_id bigint,
  source_url text not null,
  status text not null default 'disconnected'
    check (status in ('disconnected','connecting','connected','syncing','stale','expired','error')),
  api_key_secret_id uuid,
  api_key_expires_at timestamptz,
  sync_enabled boolean not null default true,
  sync_interval_minutes integer not null default 30
    check (sync_interval_minutes between 15 and 1440),
  last_refresh_at timestamptz,
  last_sync_started_at timestamptz,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  lease_token uuid,
  lease_until timestamptz,
  members jsonb not null default '[]'::jsonb,
  invite_links jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (club_slug ~ '^[A-Za-z0-9_-]{2,80}$'),
  check (source_url ~ '^https://simulatorgolftour\.com/club/[A-Za-z0-9_-]+$')
);

create table public.cgl_sgt_tours (
  sgt_tour_id bigint primary key,
  club_slug text not null references public.cgl_sgt_connections(club_slug),
  name text not null,
  start_date date,
  end_date date,
  team_tour boolean not null default false,
  active boolean not null default false,
  admin_username text,
  past_due boolean not null default false,
  members jsonb not null default '[]'::jsonb,
  teams jsonb not null default '{}'::jsonb,
  standings_gross jsonb not null default '[]'::jsonb,
  standings_net jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cgl_sgt_tours_club_active
  on public.cgl_sgt_tours(club_slug, active, start_date desc);

create table public.cgl_sgt_tournaments (
  sgt_tournament_id bigint primary key,
  sgt_tour_id bigint not null references public.cgl_sgt_tours(sgt_tour_id),
  club_slug text not null references public.cgl_sgt_connections(club_slug),
  name text not null,
  status text,
  start_date date,
  end_date date,
  registration_start_date date,
  registration_end_date date,
  course_name text,
  number_rounds integer,
  number_holes text,
  gameplay text,
  stableford boolean not null default false,
  registrations jsonb not null default '[]'::jsonb,
  scorecards jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cgl_sgt_tournaments_tour_dates
  on public.cgl_sgt_tournaments(sgt_tour_id, start_date desc, end_date desc);
create index cgl_sgt_tournaments_club_dates
  on public.cgl_sgt_tournaments(club_slug, start_date desc, end_date desc);

create table public.cgl_sgt_sync_runs (
  id uuid primary key default gen_random_uuid(),
  club_slug text not null references public.cgl_sgt_connections(club_slug),
  trigger text not null check (trigger in ('connect','manual','schedule','recovery')),
  actor text not null,
  state text not null default 'running'
    check (state in ('running','completed','partial','failed','skipped')),
  counts jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index cgl_sgt_sync_runs_recent
  on public.cgl_sgt_sync_runs(club_slug, started_at desc);

alter table public.cgl_sgt_connections enable row level security;
alter table public.cgl_sgt_tours enable row level security;
alter table public.cgl_sgt_tournaments enable row level security;
alter table public.cgl_sgt_sync_runs enable row level security;

revoke all on public.cgl_sgt_connections from public, anon, authenticated;
revoke all on public.cgl_sgt_tours from public, anon, authenticated;
revoke all on public.cgl_sgt_tournaments from public, anon, authenticated;
revoke all on public.cgl_sgt_sync_runs from public, anon, authenticated;
grant all on public.cgl_sgt_connections to service_role;
grant all on public.cgl_sgt_tours to service_role;
grant all on public.cgl_sgt_tournaments to service_role;
grant all on public.cgl_sgt_sync_runs to service_role;

-- Vault keeps the rotating SGT key encrypted at rest. These functions are
-- callable only by the server's service role and never expose the key to a
-- browser or public database role.
create function public.cgl_sgt_store_api_key(
  p_club_slug text,
  p_api_key text,
  p_expires_at timestamptz,
  p_actor text,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if length(p_api_key) < 32 or p_expires_at <= now() then
    raise exception 'A valid future SGT API key is required';
  end if;
  if length(trim(p_actor)) < 2 or length(trim(p_reason)) < 3 then
    raise exception 'An actor and audit reason are required';
  end if;

  select to_jsonb(c), c.api_key_secret_id
    into v_before, v_secret_id
    from public.cgl_sgt_connections c
    where c.club_slug = p_club_slug
    for update;
  if not found then
    raise exception 'The configured SGT club was not found';
  end if;

  if v_secret_id is null then
    select vault.create_secret(
      p_api_key,
      'cgl_sgt_' || lower(p_club_slug) || '_api_key',
      'Rotating Simulator Golf Tour Club Admin API key'
    ) into v_secret_id;
  else
    perform vault.update_secret(v_secret_id, p_api_key);
  end if;

  update public.cgl_sgt_connections
     set api_key_secret_id = v_secret_id,
         api_key_expires_at = p_expires_at,
         status = 'connected',
         last_refresh_at = now(),
         last_error = null,
         updated_at = now()
   where club_slug = p_club_slug
   returning to_jsonb(cgl_sgt_connections.*) - 'api_key_secret_id'
     into v_after;

  insert into public.cgl_audit_events(
    actor, action, entity, entity_id, reason, before_data, after_data
  ) values (
    p_actor,
    'sgt_key_rotated',
    'sgt_connection',
    p_club_slug,
    p_reason,
    coalesce(v_before, '{}'::jsonb) - 'api_key_secret_id',
    v_after
  );
end;
$$;

create function public.cgl_sgt_get_api_key(p_club_slug text)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select v.decrypted_secret
    from public.cgl_sgt_connections c
    join vault.decrypted_secrets v on v.id = c.api_key_secret_id
   where c.club_slug = p_club_slug
     and c.sync_enabled
   limit 1
$$;

create function public.cgl_sgt_claim_sync(
  p_club_slug text,
  p_lease_token uuid,
  p_force boolean default false
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
         lease_until = now() + interval '5 minutes',
         status = 'syncing',
         last_sync_started_at = now(),
         updated_at = now()
   where club_slug = p_club_slug
     and sync_enabled
     and api_key_secret_id is not null
     and (lease_until is null or lease_until < now())
     and (
       p_force
       or last_success_at is null
       or last_success_at + make_interval(mins => sync_interval_minutes) <= now()
     );
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke all on function public.cgl_sgt_store_api_key(text,text,timestamptz,text,text) from public, anon, authenticated;
revoke all on function public.cgl_sgt_get_api_key(text) from public, anon, authenticated;
revoke all on function public.cgl_sgt_claim_sync(text,uuid,boolean) from public, anon, authenticated;
grant execute on function public.cgl_sgt_store_api_key(text,text,timestamptz,text,text) to service_role;
grant execute on function public.cgl_sgt_get_api_key(text) to service_role;
grant execute on function public.cgl_sgt_claim_sync(text,uuid,boolean) to service_role;

insert into public.cgl_sgt_connections(
  club_slug, club_id, source_url, status, metadata
) values (
  'CGSBunker',
  1125,
  'https://simulatorgolftour.com/club/CGSBunker',
  'disconnected',
  '{"provider":"Simulator Golf Tour","mode":"official_club_api","read_only":true}'::jsonb
) on conflict (club_slug) do update
set club_id = excluded.club_id,
    source_url = excluded.source_url,
    metadata = public.cgl_sgt_connections.metadata || excluded.metadata,
    updated_at = now();

insert into public.cgl_settings(key, value, updated_by)
values (
  'sgt',
  '{"mode":"official_club_api","club_slug":"CGSBunker","club_id":1125,"api_configured":false,"sync_interval_minutes":30,"read_only":true}'::jsonb,
  'migration:cgl_sgt_club_api_sync'
) on conflict (key) do update
set value = public.cgl_settings.value || excluded.value,
    updated_at = now(),
    updated_by = excluded.updated_by;

-- The bearer value is read from Vault at execution time, so it is never
-- stored in cron.job. The secret is provisioned separately during deployment.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'cgl-sgt-sync-every-30-minutes';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'cgl-sgt-sync-every-30-minutes',
    '*/30 * * * *',
    $cron$
      select net.http_post(
        url := 'https://crossodoggolf.com/api/cgl/sgt/sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce(
            (select decrypted_secret from vault.decrypted_secrets where name = 'cgl_sgt_sync_secret'),
            'not-configured'
          )
        ),
        body := jsonb_build_object('source', 'supabase_cron', 'requested_at', now()),
        timeout_milliseconds := 60000
      );
    $cron$
  );
end;
$$;
