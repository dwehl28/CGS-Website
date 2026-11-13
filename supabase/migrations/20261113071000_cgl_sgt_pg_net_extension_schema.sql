-- pg_net was introduced only for the new SGT scheduler and has no queued
-- production work yet. Recreate it in Supabase's protected extension namespace
-- before the scheduler is connected to SGT.
drop extension if exists pg_net;
create extension pg_net with schema extensions;
