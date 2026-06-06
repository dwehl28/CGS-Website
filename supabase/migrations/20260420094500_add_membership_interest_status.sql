alter table public.membership_interest
  add column if not exists status text not null default 'new';

update public.membership_interest
set status = 'new'
where status is null;
