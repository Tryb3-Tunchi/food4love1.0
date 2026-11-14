-- Audit hardening: profile privacy, reputation protection, table privileges, adult confirmation.
--
-- PREPARED, NOT APPLIED. Supersedes supabase-migration-profiles-privacy-hardening.sql
-- (do NOT run both; this file contains everything in that one plus more).
-- Written to be re-runnable. Tested only in a throwaway in-memory PostgreSQL.
--
-- WHAT IT FIXES (each confirmed against the live definitions exported 2026-11-13)
--  1. profiles is readable by EVERYONE (three "using (true)" policies and a table-wide
--     SELECT grant), including lat / lng (exact coordinates), referral_code,
--     notification_preferences and email-marketing consent of every member.
--     -> Logged-out visitors and signed-in members may now read only the columns a
--        profile card needs. A member reads their own private columns through
--        get_my_private_profile().
--  2. A member can edit their own rating, review_count, streak and is_demo (the guard
--     trigger protected only verification, suspension and role). -> now protected.
--  3. anon holds TRUNCATE / TRIGGER / REFERENCES / DELETE / INSERT / UPDATE on every
--     table and authenticated holds TRUNCATE / TRIGGER / REFERENCES. Row-level security
--     covers INSERT/UPDATE/DELETE but NOT TRUNCATE. -> removed.
--  4. There is no age confirmation anywhere. -> profiles.age_confirmed_at (set only by
--     the server, never by the member's own client), required by the map functions.
--
-- BEFORE RUNNING (all must be true)
--   [ ] The matching application code is deployed: explicit profile columns, the
--       get_my_private_profile() caller, the age-confirmation route and screen.
--       (The code works both before and after this file, so deploy the code first.)
--   [ ] A manual backup exists (the free plan has no automatic backups).
--   [ ] Read-only check: select count(*) from public.profiles;  -- note the number
--
-- WHAT CHANGES FOR EXISTING MEMBERS
--   * Every existing member will have age_confirmed_at = NULL and must confirm they are
--     an adult once (a screen appears). Until then the map, likes and matching refuse them.
--   * Anything that selects * or lat/lng/referral_code/... from profiles with a member
--     or visitor key now gets "permission denied" (by design).
--
-- ROLLBACK (see the end of the file)

begin;

-- ===================================================================== 4a. column
alter table public.profiles add column if not exists age_confirmed_at timestamptz;

-- ============================================================ 1. profile privacy
-- kyc_status MUST stay readable: the daily_specials policies check
-- profiles.kyc_status while running as the visitor / member.
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

-- The member's own private columns. Everything else about others stays hidden.
create or replace function public.get_my_private_profile()
returns table (
  referral_code text,
  notification_preferences jsonb,
  email_updates_consent boolean,
  email_updates_consent_at timestamptz,
  age_confirmed_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.referral_code::text,
         p.notification_preferences::jsonb,
         p.email_updates_consent,
         p.email_updates_consent_at,
         p.age_confirmed_at
    from public.profiles p
   where p.id = auth.uid()
$$;

revoke all on function public.get_my_private_profile() from public, anon;
grant execute on function public.get_my_private_profile() to authenticated;

-- ===================================================== 2 + 4b. owner-edit guard
-- Same rules as the live function, plus: reputation (rating, review_count, streak),
-- is_demo and age_confirmed_at can only be changed by the server.
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
       or new.is_demo is distinct from old.is_demo
       or new.age_confirmed_at is distinct from old.age_confirmed_at then
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

-- ============================================================ 3. table privileges
do $$
declare
  t text;
  private_tables text[] := array[
    'bookings', 'disputes', 'kyc_submissions', 'matches', 'messages',
    'notifications', 'swipes'
  ];
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    -- TRUNCATE is not covered by row-level security, and nobody needs these rights.
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t);
    -- Logged-out visitors never write to the database directly.
    execute format('revoke insert, update, delete on public.%I from anon', t);
  end loop;
  -- Private data is never readable without signing in.
  foreach t in array private_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke select on public.%I from anon', t);
    end if;
  end loop;
end;
$$;

-- ================================ 4c. map functions require confirmed adults only
create or replace function public.set_my_discovery(
  p_discoverable boolean,
  p_lat double precision default null,
  p_lng double precision default null
)
returns table (is_discoverable boolean, area_lat double precision, area_lng double precision)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  snapped_lat double precision;
  snapped_lng double precision;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if coalesce(p_discoverable, false) then
    if p_lat is null or p_lng is null
       or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
      raise exception 'A valid area is required to be discoverable' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.profiles p
       where p.id = uid and coalesce(p.onboarding_complete, false)
         and not coalesce(p.suspended, false)
         and p.age_confirmed_at is not null
    ) then
      raise exception 'Finish setting up your profile first' using errcode = '42501';
    end if;

    snapped_lat := public.discovery_snap(p_lat);
    snapped_lng := public.discovery_snap(p_lng);

    insert into public.member_discovery as md
      (user_id, discoverable, approx_lat, approx_lng, consent_at, updated_at)
    values (uid, true, snapped_lat, snapped_lng, now(), now())
    on conflict (user_id) do update
      set discoverable = true,
          approx_lat = excluded.approx_lat,
          approx_lng = excluded.approx_lng,
          consent_at = case when md.discoverable then md.consent_at else now() end,
          updated_at = now();

    return query select true, snapped_lat, snapped_lng;
  else
    insert into public.member_discovery as md
      (user_id, discoverable, approx_lat, approx_lng, consent_at, updated_at)
    values (uid, false, null, null, null, now())
    on conflict (user_id) do update
      set discoverable = false, approx_lat = null, approx_lng = null,
          consent_at = null, updated_at = now();

    return query select false, null::double precision, null::double precision;
  end if;
end;
$$;

revoke all on function public.set_my_discovery(boolean, double precision, double precision)
  from public, anon;
grant execute on function public.set_my_discovery(boolean, double precision, double precision)
  to authenticated;

create or replace function public.discovery_profiles(
  p_south double precision,
  p_west double precision,
  p_north double precision,
  p_east double precision,
  p_roles text[] default null,
  p_limit integer default 100,
  p_after uuid default null
)
returns table (
  id uuid,
  role text,
  full_name text,
  avatar_url text,
  bio text,
  cuisines text[],
  price_min integer,
  rating numeric,
  review_count integer,
  verified boolean,
  area_label text,
  lat double precision,
  lng double precision
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  lim integer := least(greatest(coalesce(p_limit, 100), 1), 200);
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  -- a suspended or unconfirmed member keeps a valid login but must not browse others
  if not exists (
    select 1 from public.profiles v
     where v.id = auth.uid() and not coalesce(v.suspended, false)
       and v.age_confirmed_at is not null
  ) then
    raise exception 'Account not available' using errcode = '42501';
  end if;
  if p_south is null or p_west is null or p_north is null or p_east is null
     or p_south not between -90 and 90 or p_north not between -90 and 90
     or p_west not between -180 and 180 or p_east not between -180 and 180
     or p_south > p_north or p_west > p_east then
    raise exception 'Invalid map area' using errcode = '22023';
  end if;
  if (p_north - p_south) > 1.0001 or (p_east - p_west) > 1.0001 then
    raise exception 'Map area too large; zoom in' using errcode = '22023';
  end if;

  return query
  select p.id,
         p.role::text,
         p.full_name::text,
         p.avatar_url::text,
         left(p.bio, 140)::text,
         p.cuisines::text[],
         p.price_min::integer,
         p.rating::numeric,
         p.review_count::integer,
         (p.kyc_status = 'verified'),
         case when loc.seg ~ '[0-9]'
                or loc.seg ~* '\m(street|st|road|rd|avenue|ave|close|crescent|drive|lane|way|estate|junction|plot|house|flat|block|opposite|behind)\M' then null
              else nullif(left(loc.seg, 40), '') end::text,
         (md.approx_lat + ((((hashtext(p.id::text)::bigint) & 1023) / 1023.0) - 0.5) * 0.012)::double precision,
         (md.approx_lng + ((((hashtext(p.id::text || 'lng')::bigint) & 1023) / 1023.0) - 0.5) * 0.012)::double precision
    from public.member_discovery md
    join public.profiles p on p.id = md.user_id
    cross join lateral (
      select btrim((regexp_split_to_array(coalesce(p.location, ''), ','))
        [array_length(regexp_split_to_array(coalesce(p.location, ''), ','), 1)]) as seg
    ) loc
   where md.discoverable
     and md.approx_lat between p_south and p_north
     and md.approx_lng between p_west and p_east
     and p.id <> auth.uid()
     and not coalesce(p.suspended, false)
     and coalesce(p.onboarding_complete, false)
     and p.age_confirmed_at is not null
     and not coalesce(p.is_demo, false)
     and (p_roles is null or p.role = any (p_roles))
     and (p_after is null or p.id > p_after)
   order by p.id
   limit lim;
end;
$$;

revoke all on function public.discovery_profiles(double precision, double precision, double precision, double precision, text[], integer, uuid)
  from public, anon;
grant execute on function public.discovery_profiles(double precision, double precision, double precision, double precision, text[], integer, uuid)
  to authenticated;

commit;

-- READ-ONLY CHECKS to run AFTER applying ------------------------------------------
--   -- anon: exactly 16 columns; authenticated: exactly 19; neither includes lat, lng, referral_code:
--   select grantee, count(*), bool_or(column_name in ('lat','lng','referral_code','notification_preferences'))
--     from information_schema.column_privileges
--    where table_name = 'profiles' and privilege_type = 'SELECT' and grantee in ('anon','authenticated')
--    group by grantee;
--   -- nobody but the service role may TRUNCATE:
--   select count(*) from information_schema.role_table_grants
--    where table_schema = 'public' and privilege_type = 'TRUNCATE' and grantee in ('anon','authenticated');  -- 0
--   select count(*) from public.profiles where age_confirmed_at is not null;  -- 0 until members confirm
--
-- ROLLBACK ------------------------------------------------------------------------
--   grant select on public.profiles to anon, authenticated;
--   drop function if exists public.get_my_private_profile();
--   (re-create food4love_guard_profile_privileges() from the 2026-11-13 export; re-run the
--    two map functions from supabase-migration-discovery-map-and-match-integrity.sql)
--   alter table public.profiles drop column if exists age_confirmed_at;   -- only if no data is needed
--   -- table privileges: grant truncate, trigger, references on all tables in schema public to authenticated;
