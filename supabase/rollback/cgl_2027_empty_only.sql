-- Manual cleanup for EMPTY ISOLATED STAGING ONLY. Never part of normal migrations.
-- Prefer application rollback and forward database fixes once any real data exists.
begin;
do $$
declare item record; populated boolean;
begin
  for item in select tablename from pg_tables where schemaname='public' and tablename like 'cgl_%' and tablename not in ('cgl_settings','cgl_plans') loop
    execute format('select exists(select 1 from public.%I limit 1)',item.tablename) into populated;
    if populated then raise exception 'Refusing rollback: % contains CGL data. Export, back up and forward-fix instead.',item.tablename; end if;
  end loop;
  for item in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'cgl_%' loop
    execute format('drop function if exists %s cascade',item.signature);
  end loop;
  for item in select tablename from pg_tables where schemaname='public' and tablename like 'cgl_%' loop
    execute format('drop table if exists public.%I cascade',item.tablename);
  end loop;
end $$;
commit;
