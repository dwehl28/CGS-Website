-- Remove only the known showcase accounts. They were created for the original
-- profile mock-up and have never been linked to a live Top Dog team.
delete from auth.users
where id in (
  select id
  from public.cgs_profiles
  where handle in (
    'demo-max-miller',
    'demo-tilly-dawson',
    'demo-brock-fraser',
    'demo-jules-nguyen',
    'demo-connor-reed',
    'demo-ash-patel'
  )
);

-- A CGS profile can now be either login-backed or an administrator-managed
-- competition player. Existing login profile IDs are retained unchanged.
alter table public.cgs_profiles
  drop constraint if exists cgs_profiles_id_fkey;

alter table public.cgs_profiles
  add column if not exists auth_user_id uuid unique
    references auth.users (id) on delete cascade;

update public.cgs_profiles profiles
set auth_user_id = profiles.id
where profiles.auth_user_id is null
  and exists (
    select 1
    from auth.users users
    where users.id = profiles.id
  );

alter table public.cgs_profiles
  alter column id set default gen_random_uuid();

alter table public.cgs_profiles
  add column if not exists managed_by_admin boolean not null default false;

create index if not exists cgs_profiles_managed_by_admin_idx
  on public.cgs_profiles (managed_by_admin, display_name);
