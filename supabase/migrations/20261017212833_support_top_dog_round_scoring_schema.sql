alter table public.top_dog_rounds
  add column if not exists score_direction text,
  add column if not exists differential_divisor numeric(6, 2) not null default 1;

alter table public.top_dog_fixtures
  add column if not exists home_score_confirmed boolean not null default false,
  add column if not exists away_score_confirmed boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'top_dog_rounds_score_direction_check'
      and conrelid = 'public.top_dog_rounds'::regclass
  ) then
    alter table public.top_dog_rounds
      add constraint top_dog_rounds_score_direction_check
      check (score_direction is null or score_direction in ('higher_wins', 'lower_wins'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'top_dog_rounds_differential_divisor_check'
      and conrelid = 'public.top_dog_rounds'::regclass
  ) then
    alter table public.top_dog_rounds
      add constraint top_dog_rounds_differential_divisor_check
      check (differential_divisor > 0 and differential_divisor <= 100);
  end if;
end;
$$;

update public.top_dog_fixtures
set
  home_score_confirmed = true,
  away_score_confirmed = true
where status = 'final';
