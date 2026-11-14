-- Discovery map (opt-in, approximate location) + match integrity.
--
-- PREPARED, NOT APPLIED. Review before running. Additive and safe to re-run: it creates
-- NEW objects only and changes no existing rows. (Tested in a throwaway in-memory
-- PostgreSQL, see tests; never run against production by the assistant.)
--
-- WHY
--   * The old map read every verified chef's EXACT stored coordinates straight from the
--     profiles table. Nothing recorded whether a member agreed to be shown, and nothing
--     coarsened the location.
--   * A pair of people can currently end up with two match rows if anything other than the
--     swipe API inserts one (only the swipe API's deterministic id prevents it today).
--   * Browsers may not read other people's swipes (policy "Own swipes"), so the new
--     "Likes received" list is served by a server route; it needs this index to stay fast.
--
-- PRIVACY MODEL
--   * Discoverability is OFF for everyone until they switch it on themselves.
--   * Only a coarse AREA is stored: the centre of a ~2 km grid cell. The exact point a
--     member's device reports is rounded INSIDE the database function and never saved.
--   * The consent + area live in their own table that no browser can read except the owner
--     (row-level security). Other members never query it; they call discovery_profiles(),
--     which returns only a small set of safe columns.
--   * Markers are shifted by a fixed per-member offset (< 0.7 km) inside their cell, so
--     members in the same cell do not stack. (The offset is a fixed function of the member id, so it hides nothing from someone who knows the formula; the protection is that only the ~2 km cell is ever stored.)
--   * The area asked for is capped at ~110 km and 200 rows a call (no bulk export).
--   * Turning the switch off deletes the stored area immediately.
--   * The legacy profiles.lat / profiles.lng columns are NOT used by anything here.
--
-- ROLLBACK
--   drop function if exists public.discovery_profiles(double precision, double precision, double precision, double precision, text[], integer, uuid);
--   drop function if exists public.set_my_discovery(boolean, double precision, double precision);
--   drop function if exists public.discovery_snap(double precision);
--   drop table if exists public.member_discovery;
--   drop index if exists public.matches_pair_unique_idx;
--   alter table public.matches drop constraint if exists matches_distinct_users;
--   drop index if exists public.swipes_swiped_idx;

begin;

-- 1) Consent + approximate area (owner-readable only) ----------------------------
create table if not exists public.member_discovery (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  discoverable boolean not null default false,
  approx_lat double precision,
  approx_lng double precision,
  consent_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint member_discovery_area_chk check (
    (discoverable = false and approx_lat is null and approx_lng is null)
    or (discoverable = true
        and approx_lat between -90 and 90
        and approx_lng between -180 and 180)
  )
);

alter table public.member_discovery enable row level security;
revoke all on public.member_discovery from anon, authenticated;
grant select on public.member_discovery to authenticated;
grant all on public.member_discovery to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'member_discovery'
       and policyname = 'Members read their own discovery settings'
  ) then
    execute $p$
      create policy "Members read their own discovery settings"
        on public.member_discovery for select to authenticated
        using (auth.uid() = user_id)
    $p$;
  end if;
end;
$$;

-- 2) Rounding: the only place coordinates are coarsened ---------------------------
create or replace function public.discovery_snap(p_value double precision)
returns double precision
language sql
immutable
as $$
  select round((round(p_value::numeric / 0.02) * 0.02), 4)::double precision
$$;

-- 3) Turn discoverability on/off. The ONLY way to write member_discovery. ----------
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

-- 4) The only read path other members have ---------------------------------------
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
  -- a suspended member keeps a valid login but must not browse other members
  if not exists (
    select 1 from public.profiles v
     where v.id = auth.uid() and not coalesce(v.suspended, false)
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
         -- general area only: the LAST comma-separated part ("Lagos"); a part with a digit
         -- (street number, postcode) or a street word ("Admiralty Way", "Estate") is never shown
         case when loc.seg ~ '[0-9]'
                or loc.seg ~* '\m(street|st|road|rd|avenue|ave|close|crescent|drive|lane|way|estate|junction|plot|house|flat|block|opposite|behind)\M' then null
              else nullif(left(loc.seg, 40), '') end::text,
         -- fixed offset inside the cell (+/-0.006 deg): stable per member, finer than nothing
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

-- 5) One match per pair of people, enforced by the database -----------------------
-- Refuses to continue (and changes nothing) if a duplicate pair already exists.
do $$
begin
  if exists (
    select 1 from public.matches
     group by least(user1_id, user2_id), greatest(user1_id, user2_id)
    having count(*) > 1
  ) then
    raise exception 'Duplicate matches exist for at least one pair; resolve them first (see the read-only check below)';
  end if;
end;
$$;

create unique index if not exists matches_pair_unique_idx
  on public.matches (least(user1_id, user2_id), greatest(user1_id, user2_id));

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.matches'::regclass and conname = 'matches_distinct_users'
  ) then
    execute 'alter table public.matches add constraint matches_distinct_users check (user1_id <> user2_id) not valid';
    execute 'alter table public.matches validate constraint matches_distinct_users';
  end if;
end;
$$;

-- 6) Fast "likes received" lookups (swipes only had an index on swiper_id first) ----
create index if not exists swipes_swiped_idx
  on public.swipes (swiped_id, created_at desc);

commit;

-- READ-ONLY CHECKS to run BEFORE applying -----------------------------------------
--   -- must return no rows:
--   select least(user1_id, user2_id), greatest(user1_id, user2_id), count(*)
--     from public.matches group by 1, 2 having count(*) > 1;
--   -- must return no rows:
--   select id from public.matches where user1_id = user2_id;
-- READ-ONLY CHECKS to run AFTER applying -------------------------------------------
--   select relrowsecurity from pg_class where oid = 'public.member_discovery'::regclass;  -- true
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name = 'member_discovery' and grantee in ('anon','authenticated');       -- authenticated SELECT only
--   select count(*) from public.member_discovery;                                          -- 0 (nobody opted in yet)
