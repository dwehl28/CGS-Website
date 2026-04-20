create table if not exists public.clubhouse_updates (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  title text not null,
  summary text not null,
  status_label text not null default 'Clubhouse note',
  cta_label text,
  cta_href text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_pinned boolean not null default false,
  is_published boolean not null default true
);

create index if not exists clubhouse_updates_created_at_idx
  on public.clubhouse_updates (created_at desc);

create index if not exists clubhouse_updates_published_idx
  on public.clubhouse_updates (is_published, is_pinned desc, created_at desc);
