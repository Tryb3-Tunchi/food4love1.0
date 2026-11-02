-- Auth and DDL trigger functions are invoked by PostgreSQL triggers, not by
-- client RPCs. Keep their execution server-side and pin the signup search path.
alter function public.handle_new_user()
  set search_path = pg_catalog, pg_temp;

revoke all on function public.handle_new_user()
  from public, anon, authenticated;

revoke all on function public.rls_auto_enable()
  from public, anon, authenticated;
