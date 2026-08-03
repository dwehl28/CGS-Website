create table if not exists public.cgs_double_elimination_brackets (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  slug text not null unique,
  title text not null,
  subtitle text not null default 'Par 3 Double Elimination',
  status_label text not null default 'Bracket setup',
  participant_count integer not null,
  is_published boolean not null default true,
  is_live boolean not null default false,
  bracket_data jsonb not null,
  constraint cgs_double_elimination_brackets_participant_count_check
    check (participant_count between 2 and 16)
);

create index if not exists cgs_double_elimination_brackets_slug_idx
  on public.cgs_double_elimination_brackets (slug);

create index if not exists cgs_double_elimination_brackets_public_idx
  on public.cgs_double_elimination_brackets (is_published, is_live, updated_at desc);

alter table public.cgs_double_elimination_brackets enable row level security;

drop policy if exists "Public can read published double elimination brackets"
  on public.cgs_double_elimination_brackets;

create policy "Public can read published double elimination brackets"
  on public.cgs_double_elimination_brackets
  for select
  to anon, authenticated
  using (is_published = true);

do $$
begin
  alter publication supabase_realtime
    add table public.cgs_double_elimination_brackets;
exception
  when duplicate_object then null;
end
$$;
