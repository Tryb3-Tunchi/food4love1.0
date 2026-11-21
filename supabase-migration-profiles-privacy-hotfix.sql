-- Profiles privacy hotfix (PREPARED, NOT APPLIED TO PRODUCTION).
--
-- STATUS: applied to and tested on the food4love-staging project only: 38 real Supabase checks as a visitor and as members,
-- using the application's own query shapes. Production is unchanged. Do not run it on production without the checklist below.
--
-- PURPOSE: close the production profile-exposure finding WITHOUT the age-confirmation transition that
-- supabase-migration-audit-hardening.sql brings. Built from that file's own sections 1, 2 and 3, restricted to the
-- profiles table, so it can be applied first and audit-hardening applied later (audit-hardening now drops and recreates
-- get_my_private_profile() with its extra field; the guard function is replaced in place).
--
-- WHAT IT CHANGES (all on public.profiles)
--   1. Visitors (anon) and members (authenticated) may read only the columns a profile card needs.
--      Hidden from everyone via the API: lat, lng, is_demo, referral_code, notification_preferences,
--      email_updates_consent, email_updates_consent_at.  Own values are read through get_my_private_profile().
--      kyc_status and suspended stay readable (the daily_specials policies read them as the visitor).
--   2. Members can no longer edit their own rating, review_count, streak or is_demo (the live guard covered only
--      verification, suspension and role).
--   3. anon loses INSERT/UPDATE/DELETE, and anon + authenticated lose TRUNCATE/TRIGGER/REFERENCES, on profiles.
--
-- NOT CHANGED: row-level policies, any other table, signup, matching, the map, age confirmation.
--
-- BEFORE RUNNING (all must be true)
--   [ ] The application release that uses explicit profile columns is deployed (a browser select('*') on profiles
--       will return "permission denied" afterwards). The app code already works both before and after.
--   [ ] A manual backup exists (the Free plan has no automatic backups).
--   [ ] Tested first on food4love-staging.
--
-- ROLLBACK (restores the previous, exposed state):
--   grant select on public.profiles to anon, authenticated;
--   grant insert, update, delete on public.profiles to anon;
--   grant truncate, trigger, references on public.profiles to anon, authenticated;
--   (the guard function can stay: it only adds protection)

begin;

-- 1. column-level read privacy ---------------------------------------------------------------
revoke select on public.profiles from anon;
revoke select on public.profiles from authenticated;

grant select (
  id, full_name, avatar_url, role, bio, location, cuisines, photos,
  price_min, price_max, rating, review_count, is_verified, suspended,
  kyc_status, created_at
) on public.profiles to anon;

grant select (
  id, full_name, avatar_url, role, bio, location, cuisines, photos,
  price_min, price_max, rating, review_count, is_verified, suspended,
  kyc_status, created_at, streak, tour_completed, onboarding_complete
) on public.profiles to authenticated;

-- 2. the member's own private columns. age_confirmed_at is deliberately NOT returned: that column does not exist
--    yet, and the application treats a null age_confirmed_at as "this member must confirm they are an adult" (a
--    blocking dialog), so a placeholder null would lock every member out. audit-hardening drops and recreates this
--    function with the extra field (see its line before CREATE FUNCTION).
drop function if exists public.get_my_private_profile();
create function public.get_my_private_profile()
returns table (
  referral_code text,
  notification_preferences jsonb,
  email_updates_consent boolean,
  email_updates_consent_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.referral_code::text,
         p.notification_preferences::jsonb,
         p.email_updates_consent,
         p.email_updates_consent_at
    from public.profiles p
   where p.id = auth.uid()
$$;

revoke all on function public.get_my_private_profile() from public, anon;
grant execute on function public.get_my_private_profile() to authenticated;

-- 3. reputation protection: the live guard plus rating, review_count, streak and is_demo -----
create or replace function public.food4love_guard_profile_privileges()
returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  if auth.uid() = old.id and coalesce(auth.role(), '') <> 'service_role' then
    if new.kyc_status is distinct from old.kyc_status
       or new.is_verified is distinct from old.is_verified
       or new.suspended is distinct from old.suspended
       or new.rating is distinct from old.rating
       or new.review_count is distinct from old.review_count
       or new.streak is distinct from old.streak
       or new.is_demo is distinct from old.is_demo then
      raise exception 'Verification, suspension, reputation and age fields are server-managed';
    end if;

    if old.onboarding_complete and new.role is distinct from old.role then
      raise exception 'Role cannot be changed after onboarding is complete';
    end if;

    if old.onboarding_complete and not new.onboarding_complete then
      raise exception 'Completed onboarding cannot be reopened by the account owner';
    end if;

    if new.email_updates_consent is distinct from old.email_updates_consent then
      new.email_updates_consent_at := case
        when new.email_updates_consent then now()
        else null
      end;
    else
      new.email_updates_consent_at := old.email_updates_consent_at;
    end if;
  end if;

  return new;
end;
$$;

-- 4. rights nobody needs on profiles --------------------------------------------------------
revoke truncate, trigger, references on public.profiles from anon, authenticated;
revoke insert, update, delete on public.profiles from anon;

commit;
