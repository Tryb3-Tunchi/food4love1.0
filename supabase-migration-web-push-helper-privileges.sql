-- FOOD4LOVE: close the three pure Web Push helper functions to browser roles
--
-- Only for databases where supabase-migration-web-push.sql was applied BEFORE commit that added
-- these revokes to it (food4love-staging, 2026-11-24). Databases that run the current
-- supabase-migration-web-push.sql already get this and do not need the file (re-running is harmless).
--
-- WHY: Supabase's default privileges make every new function in public executable by anon and
-- authenticated. The web-push migration revoked that from all functions that read data or run as
-- SECURITY DEFINER, but missed these three IMMUTABLE helpers. They read no table and run with the
-- caller's rights (a caller could only compute a boolean or interval from arguments they supply),
-- so the exposure is negligible; this closes it on least-privilege grounds.
--
-- The enqueue trigger is unaffected: it runs as SECURITY DEFINER (owner postgres), which keeps
-- execute on these helpers. Ends with a self-check; any remaining browser execute aborts it.
--
-- ROLLBACK: grant execute on function public.food4love_notification_category(text, jsonb),
--   public.food4love_push_allowed(jsonb, text), public.food4love_push_retry_delay(integer)
--   to anon, authenticated;

begin;

revoke all on function public.food4love_notification_category(text, jsonb) from public, anon, authenticated;
revoke all on function public.food4love_push_allowed(jsonb, text) from public, anon, authenticated;
revoke all on function public.food4love_push_retry_delay(integer) from public, anon, authenticated;

do $$
declare
  f record;
begin
  for f in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (p.proname like 'food4love_push%' or p.proname in ('food4love_notification_category', 'food4love_enqueue_push'))
  loop
    if has_function_privilege('anon', f.oid, 'execute') or has_function_privilege('authenticated', f.oid, 'execute') then
      raise exception 'browser roles can still execute %', f.proname;
    end if;
  end loop;
end;
$$;

commit;
