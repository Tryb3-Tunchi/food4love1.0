-- Profile privacy hardening (PREPARED, NOT APPLIED).
--
-- PROBLEM CONFIRMED IN THE LIVE DATABASE (read-only checks, 2026-11-12):
--   * Three SELECT policies on public.profiles all say "using (true)" for the
--     public role, so anyone holding the public anon key can read EVERY column of
--     EVERY profile without logging in: precise lat/lng, referral codes,
--     notification preferences, email-marketing consent, KYC status, and more.
--   * The owner-update guard trigger protects verification, suspension and role,
--     but not rating, review_count, streak or is_demo (a cook could edit their own).
--
-- WHAT THIS FILE DOES (two independent parts; run Part 1 first, Part 2 optionally)
--   PART 1  Logged-out visitors (anon) may read only the 15 columns a public chef
--           page needs. Signed-in members are unaffected.
--   PART 2  Adds rating, review_count, streak and is_demo to the protected fields
--           of the existing guard function.
--
-- BEFORE RUNNING -- ALL of these must be true:
--   [ ] The code with explicit columns on /cook/[id] is deployed (commit
--       "fix(privacy): list explicit columns on the public chef page"). Until then
--       that page asks for '*' and would fail for logged-out visitors.
--   [ ] Tested first on a staging copy, or at minimum: open a public chef link and
--       a WhatsApp/Instagram link preview right after applying.
--   [ ] Nothing else queries profiles while logged out (checked in code: only
--       /cook/[id] and its metadata do). Re-check if new public pages were added.
--   [ ] A manual backup / Point-in-time recovery exists (the free plan had none).
--
-- WHAT WILL STOP WORKING (by design): any logged-out request that selects more
-- than the granted columns, e.g. select=* or lat,lng, gets "permission denied".
--
-- ROLLBACK
--   Part 1:  grant select on public.profiles to anon;
--   Part 2:  re-create food4love_guard_profile_privileges() with the original body
--            printed in the comment at the bottom of this file.

-- ============================================================ PART 1
begin;

revoke select on public.profiles from anon;
grant select (
  id, full_name, avatar_url, role, bio, location, cuisines, photos,
  price_min, price_max, rating, review_count, is_verified, suspended, created_at
) on public.profiles to anon;

commit;

-- Verify (read-only): anon should list exactly those columns and no others.
--   select column_name from information_schema.column_privileges
--    where table_name = 'profiles' and grantee = 'anon' and privilege_type = 'SELECT'
--    order by 1;
-- Verify from outside (should now FAIL with "permission denied"):
--   GET <project>/rest/v1/profiles?select=lat,lng&limit=1   (with the anon key only)

-- ============================================================ PART 2 (optional)
-- Replaces the existing guard with the same rules plus four more protected
-- fields. Same signature and trigger, so no trigger change is needed.
begin;

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
       -- added by this migration:
       or new.rating is distinct from old.rating
       or new.review_count is distinct from old.review_count
       or new.streak is distinct from old.streak
       or new.is_demo is distinct from old.is_demo then
      raise exception 'Verification, suspension and reputation fields are server-managed';
    end if;

    if old.onboarding_complete and new.role is distinct from old.role then
      raise exception 'Role cannot be changed after onboarding is complete';
    end if;

    if old.onboarding_complete and not new.onboarding_complete then
      raise exception 'Completed onboarding cannot be reopened by the account owner';
    end if;

    if new.email_updates_consent is distinct from old.email_updates_consent then
      new.email_updates_consent_at := case when new.email_updates_consent then now() else null end;
    else
      new.email_updates_consent_at := old.email_updates_consent_at;
    end if;
  end if;
  return new;
end;
$$;

commit;

-- CHECK FIRST: nothing in the app writes rating/review_count/streak as the
-- profile owner. Look for triggers or functions that update them:
--   select tgname, pg_get_triggerdef(oid) from pg_trigger
--    where tgrelid = 'public.reviews'::regclass and not tgisinternal;
--   select proname, prosecdef from pg_proc
--    where pronamespace = 'public'::regnamespace
--      and pg_get_functiondef(oid) ilike '%review_count%';
-- A trigger running as security definer is NOT blocked (the guard only applies when
-- the signed-in user is the profile owner).

-- ORIGINAL guard body (live on 2026-11-12), for rollback of Part 2:
--   if auth.uid() = old.id and coalesce(auth.role(), '') <> 'service_role' then
--     if new.kyc_status is distinct from old.kyc_status
--        or new.is_verified is distinct from old.is_verified
--        or new.suspended is distinct from old.suspended then
--       raise exception 'Verification and suspension fields are server-managed';
--     end if;
--     if old.onboarding_complete and new.role is distinct from old.role then
--       raise exception 'Role cannot be changed after onboarding is complete';
--     end if;
--     if old.onboarding_complete and not new.onboarding_complete then
--       raise exception 'Completed onboarding cannot be reopened by the account owner';
--     end if;
--     if new.email_updates_consent is distinct from old.email_updates_consent then
--       new.email_updates_consent_at := case when new.email_updates_consent then now() else null end;
--     else
--       new.email_updates_consent_at := old.email_updates_consent_at;
--     end if;
--   end if;
--   return new;
