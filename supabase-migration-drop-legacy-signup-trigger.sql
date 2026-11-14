-- Remove the legacy signup trigger (PREPARED, NOT APPLIED).
--
-- FINDING: the live database has TWO triggers on auth.users that each create the
-- member's profile row:
--   food4love_create_profile_after_signup -> food4love_handle_new_user()  (safe: validates role,
--                                             uses ON CONFLICT DO NOTHING; from supabase-migration-auth-profile-trigger.sql)
--   on_auth_user_created                  -> handle_new_user()           (legacy: plain INSERT, no
--                                             ON CONFLICT, copies a client-supplied role value)
-- Triggers fire in name order, so the safe one runs first and the legacy one then tries to insert the
-- SAME profile id and fails with "duplicate key value violates unique constraint profiles_pkey",
-- which makes the whole signup fail. Reproduced in an isolated in-memory PostgreSQL using the live
-- definitions exported 2026-11-13. NOT confirmed by creating a real account in production.
-- The legacy trigger is not created by any migration in this repository (it was added by hand).
--
-- ORDER WARNING: if the duplicate-trigger failure described above is real, it is
-- CURRENTLY STOPPING anyone from creating an account through the Supabase API (even
-- though sign-ups are enabled in the dashboard). Removing it would let direct API
-- sign-ups SUCCEED. So apply this file only at launch time, or only AFTER
-- "Allow new users to sign up" has been switched OFF in Supabase (existing members can
-- still sign in with sign-ups off). It is not needed for the security release itself.
--
-- BEFORE RUNNING (read-only): both triggers should be listed.
--   select tgname from pg_trigger t join pg_class c on c.oid = t.tgrelid
--    where c.relname = 'users' and not t.tgisinternal and tgname in ('food4love_create_profile_after_signup','on_auth_user_created');
--
-- ROLLBACK:
--   create trigger on_auth_user_created after insert on auth.users
--     for each row execute function public.handle_new_user();

begin;

do $$
begin
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
     where c.relname = 'users' and t.tgname = 'food4love_create_profile_after_signup' and not t.tgisinternal
  ) then
    raise exception 'The replacement trigger food4love_create_profile_after_signup is missing; not dropping the legacy trigger';
  end if;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

commit;
