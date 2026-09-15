alter table public.competition_scoreboards
  add column if not exists archived_at timestamptz;

-- Keep the two current grand-final boards and archive the completed/test backlog.
-- Archiving clears both public and admin views while keeping results recoverable.
update public.competition_scoreboards
set
  is_live = false,
  is_published = false,
  archived_at = timezone('utc', now()),
  updated_at = timezone('utc', now())
where created_at < timestamptz '2026-09-14 00:00:00+00'
  and slug not in ('c-grade-grand-final', 'a-grade-grand-final')
  and archived_at is null;

-- The wider content audit found no eligible records before the approved
-- six-month cutoff of 15 March 2026. Accounts and enquiries remain untouched.
