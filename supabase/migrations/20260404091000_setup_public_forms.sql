create table if not exists public.membership_interest (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  full_name text not null,
  email text not null,
  membership_type text not null,
  handicap text,
  handicap_type text,
  interested_in_events text
);

create table if not exists public.contact_enquiries (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  full_name text not null,
  email text not null,
  phone text,
  enquiry_type text not null,
  preferred_contact text,
  subject text not null,
  message text not null,
  status text not null default 'new'
);

create table if not exists public.event_interest (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  event_slug text not null,
  event_name text not null,
  enquiry_type text not null,
  full_name text not null,
  email text not null,
  phone text,
  membership_status text,
  handicap text,
  notes text,
  status text not null default 'new'
);

create index if not exists membership_interest_created_at_idx
  on public.membership_interest (created_at desc);

create index if not exists contact_enquiries_created_at_idx
  on public.contact_enquiries (created_at desc);

create index if not exists event_interest_created_at_idx
  on public.event_interest (created_at desc);
