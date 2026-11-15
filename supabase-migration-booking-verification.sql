-- Booking verification, lifecycle integrity, booking interest, and audit trail.
--
-- PREPARED, NOT APPLIED. Additive and re-runnable. Tested only in a throwaway in-memory
-- PostgreSQL. Reuses the existing bookings table: nothing is duplicated.
--
-- WHAT IT ADDS
--  1. bookings: service_type, allergies, dietary_preferences, a proposed alternative time,
--     who cancelled and why, and a completion time. One new status, 'alternative_proposed'.
--  2. A guard trigger on bookings that makes the safety rules impossible to bypass, even
--     for code running with the service key:
--       - a NEW booking needs a verified, active, onboarded cook (kyc_status = 'verified'),
--         an active buyer, a current match between exactly these two people, and must start
--         as pending/unpaid;
--       - the cook's "max orders per day" is enforced atomically (advisory lock), so two
--         customers cannot both take the last slot;
--       - status changes follow the lifecycle table; accepting needs the cook to STILL be
--         verified; a booking can only be completed once payment is confirmed.
--  3. A unique index: one active booking per customer, cook and time (duplicate submits).
--  4. booking_events: an append-only history of every change (who, what, when).
--  5. booking_interests: "tell me when this cook is available" requests for cooks who cannot
--     be booked yet. Stored separately; they create no booking, payment or confirmation.
--  6. A trigger so that when a cook's verification changes (approved, rejected, revoked) the
--     cook is notified, and customers who EXPLICITLY asked are notified when it is approved.
--  7. A unique index so one booking event can never produce two notifications.
--
-- ACCESS (row-level security)
--  * bookings: unchanged (participants can read; nobody writes from the browser).
--  * booking_events: participants of the booking can read; nobody writes from the browser.
--  * booking_interests: a customer reads ONLY their own rows; cooks cannot read them (they
--    get an anonymous count through my_interest_count()); nobody writes from the browser.
--
-- BEFORE RUNNING
--   [ ] Deploy the matching application code first (it works before and after this file).
--   [ ] Read-only check, must return no rows:
--         select buyer_id, cook_id, scheduled_for from public.bookings
--          where status in ('pending','confirmed')
--          group by 1,2,3 having count(*) > 1;
--   [ ] A manual backup exists (the free plan has none).
--
-- ROLLBACK
--   drop trigger if exists booking_guard on public.bookings;
--   drop trigger if exists zz_booking_interest_on_verification on public.profiles;
--   drop function if exists public.booking_guard(), public.booking_interest_on_verification(), public.my_interest_count();
--   drop table if exists public.booking_events, public.booking_interests;
--   drop index if exists public.bookings_one_active_per_slot_idx, public.notifications_event_key_once;
--   alter table public.bookings drop constraint if exists bookings_status_check;
--   alter table public.bookings add constraint bookings_status_check
--     check (status in ('pending','confirmed','completed','cancelled'));   -- only if no row is 'alternative_proposed'

begin;

-- ===================================================================== 1. columns
alter table public.bookings
  add column if not exists service_type text not null default 'delivery',
  add column if not exists allergies text,
  add column if not exists dietary_preferences text[] not null default '{}',
  add column if not exists proposed_scheduled_for timestamptz,
  add column if not exists proposed_note text,
  add column if not exists cancelled_by uuid references public.profiles (id) on delete set null,
  add column if not exists cancel_reason text,
  add column if not exists completed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.bookings'::regclass and conname = 'bookings_service_type_check') then
    execute $c$alter table public.bookings add constraint bookings_service_type_check
      check (service_type in ('private_cooking', 'delivery', 'pickup'))$c$;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.bookings'::regclass and conname = 'bookings_dietary_size_check') then
    execute $c$alter table public.bookings add constraint bookings_dietary_size_check
      check (cardinality(dietary_preferences) <= 10)$c$;
  end if;
end;
$$;

-- one new status; the four existing ones are kept
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'alternative_proposed', 'confirmed', 'completed', 'cancelled'));

-- ============================================================ 3. no duplicate bookings
do $$
begin
  if exists (
    select 1 from public.bookings
     where status in ('pending', 'alternative_proposed', 'confirmed')
     group by buyer_id, cook_id, scheduled_for
    having count(*) > 1
  ) then
    raise exception 'Duplicate active bookings exist; resolve them first (see the read-only check in the header)';
  end if;
end;
$$;

create unique index if not exists bookings_one_active_per_slot_idx
  on public.bookings (buyer_id, cook_id, scheduled_for)
  where status in ('pending', 'alternative_proposed', 'confirmed');

-- ===================================================== 2. the guard on bookings
create or replace function public.booking_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cook_ok boolean;
  buyer_ok boolean;
  max_orders integer;
  booked integer;
  day date;
begin
  if tg_op = 'INSERT' then
    select (p.role = 'cook' and p.kyc_status = 'verified'
            and not coalesce(p.suspended, false) and coalesce(p.onboarding_complete, false))
      into cook_ok from public.profiles p where p.id = new.cook_id;
    if not coalesce(cook_ok, false) then
      raise exception 'This cook is not verified and cannot take bookings' using errcode = '23514';
    end if;

    select (p.role = 'buyer' and not coalesce(p.suspended, false) and coalesce(p.onboarding_complete, false))
      into buyer_ok from public.profiles p where p.id = new.buyer_id;
    if not coalesce(buyer_ok, false) then
      raise exception 'Buyer account is not eligible to book' using errcode = '23514';
    end if;

    if new.match_id is null or not exists (
      select 1 from public.matches m
       where m.id = new.match_id and m.status = 'matched'
         and ((m.user1_id = new.buyer_id and m.user2_id = new.cook_id)
           or (m.user1_id = new.cook_id and m.user2_id = new.buyer_id))
    ) then
      raise exception 'A current match between these two members is required' using errcode = '23514';
    end if;

    if new.status <> 'pending' or new.payment_status <> 'unpaid' then
      raise exception 'A new booking must start as pending and unpaid' using errcode = '23514';
    end if;

    -- the cook's own daily limit, checked atomically so the last slot cannot be taken twice
    if new.scheduled_for is not null then
      select a.max_orders_per_day into max_orders from public.cook_availability a where a.cook_id = new.cook_id;
      if max_orders is not null then
        day := (new.scheduled_for at time zone 'Africa/Lagos')::date;
        perform pg_advisory_xact_lock(hashtextextended(new.cook_id::text || ':' || day::text, 0));
        select count(*) into booked from public.bookings b
         where b.cook_id = new.cook_id and b.status <> 'cancelled'
           and (b.scheduled_for at time zone 'Africa/Lagos')::date = day;
        if booked >= max_orders then
          raise exception 'This cook is fully booked on that day' using errcode = '23514';
        end if;
      end if;
    end if;
    return new;
  end if;

  -- UPDATE: only follow the lifecycle
  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status in ('confirmed', 'alternative_proposed', 'cancelled'))
      or (old.status = 'alternative_proposed' and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'A % booking cannot become %', old.status, new.status using errcode = '23514';
    end if;

    if new.status = 'confirmed' then
      select (p.role = 'cook' and p.kyc_status = 'verified' and not coalesce(p.suspended, false))
        into cook_ok from public.profiles p where p.id = new.cook_id;
      if not coalesce(cook_ok, false) then
        raise exception 'This cook is no longer verified and cannot accept bookings' using errcode = '23514';
      end if;
    end if;

    if new.status = 'completed' and new.payment_status is distinct from 'paid' then
      raise exception 'A booking cannot be completed before payment is confirmed' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists booking_guard on public.bookings;
create trigger booking_guard
  before insert or update on public.bookings
  for each row execute function public.booking_guard();

-- ================================================================ 4. booking history
create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text not null check (actor_role in ('buyer', 'cook', 'admin', 'system')),
  action text not null,
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists booking_events_booking_idx
  on public.booking_events (booking_id, created_at);

alter table public.booking_events enable row level security;
revoke all on public.booking_events from anon, authenticated;
grant select on public.booking_events to authenticated;
grant all on public.booking_events to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'booking_events'
                  and policyname = 'Booking participants read the history') then
    execute $p$
      create policy "Booking participants read the history"
        on public.booking_events for select to authenticated
        using (exists (
          select 1 from public.bookings b
           where b.id = booking_events.booking_id
             and auth.uid() in (b.buyer_id, b.cook_id)))
    $p$;
  end if;
end;
$$;

create or replace function public.booking_events_no_update()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'The booking history cannot be edited' using errcode = '23514';
end;
$$;

drop trigger if exists booking_events_append_only on public.booking_events;
create trigger booking_events_append_only
  before update on public.booking_events
  for each row execute function public.booking_events_no_update();

-- ========================================================== 5. booking interest
create table if not exists public.booking_interests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  cook_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'withdrawn', 'fulfilled')),
  -- true only if the customer explicitly ticked "tell me when this cook is available"
  notify_when_verified boolean not null default false,
  cook_notified_at timestamptz,
  customer_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_interests_not_self check (customer_id <> cook_id)
);

create unique index if not exists booking_interests_one_active_idx
  on public.booking_interests (customer_id, cook_id) where status = 'active';
create index if not exists booking_interests_cook_idx
  on public.booking_interests (cook_id, status);

alter table public.booking_interests enable row level security;
revoke all on public.booking_interests from anon, authenticated;
grant select on public.booking_interests to authenticated;
grant all on public.booking_interests to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'booking_interests'
                  and policyname = 'Customers read their own interest requests') then
    execute $p$
      create policy "Customers read their own interest requests"
        on public.booking_interests for select to authenticated
        using (auth.uid() = customer_id)
    $p$;
  end if;
end;
$$;

-- An interest request is only meaningful for a real cook who cannot be booked yet.
create or replace function public.booking_interest_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cook_state record;
  buyer_ok boolean;
begin
  select p.role, p.kyc_status, coalesce(p.suspended, false) as suspended
    into cook_state from public.profiles p where p.id = new.cook_id;
  if not found or cook_state.role <> 'cook' or cook_state.suspended then
    raise exception 'Interest can only be expressed in an active cook' using errcode = '23514';
  end if;
  if cook_state.kyc_status = 'verified' then
    raise exception 'This cook can already be booked' using errcode = '23514';
  end if;
  select (p.role = 'buyer' and not coalesce(p.suspended, false)) into buyer_ok
    from public.profiles p where p.id = new.customer_id;
  if not coalesce(buyer_ok, false) then
    raise exception 'Customer account is not eligible' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists booking_interest_guard on public.booking_interests;
create trigger booking_interest_guard
  before insert on public.booking_interests
  for each row execute function public.booking_interest_guard();

-- Cooks see how many people are interested, never who.
create or replace function public.my_interest_count()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer from public.booking_interests
   where cook_id = auth.uid() and status = 'active'
$$;

revoke all on function public.my_interest_count() from public, anon;
grant execute on function public.my_interest_count() to authenticated;

-- ================================== 7. one notification per booking event, ever
create unique index if not exists notifications_event_key_once
  on public.notifications (user_id, (data ->> 'event_key'))
  where data ? 'event_key';

-- ===================== 6. tell people when a cook's verification changes
create or replace function public.booking_interest_on_verification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cook_name text;
begin
  if new.role <> 'cook' or new.kyc_status is not distinct from old.kyc_status then
    return new;
  end if;

  if new.kyc_status = 'verified' then
    -- the cook
    insert into public.notifications (user_id, type, title, body, data)
    values (new.id, 'system', 'You are verified',
            'Your verification was approved. Food lovers can now send you booking requests.',
            jsonb_build_object('kind', 'verification', 'status', 'verified'));

    -- only customers who explicitly asked to be told
    select coalesce(nullif(btrim(new.full_name), ''), 'A cook') into cook_name;
    insert into public.notifications (user_id, type, title, body, data)
    select i.customer_id, 'booking', 'A cook you asked about is now available',
           cook_name || ' has been verified by Food4Love and can now be booked.',
           jsonb_build_object('kind', 'interest_available', 'cook_id', new.id,
                              'event_key', 'interest:' || i.id::text || ':verified')
      from public.booking_interests i
     where i.cook_id = new.id and i.status = 'active' and i.notify_when_verified
    on conflict do nothing;

    update public.booking_interests
       set customer_notified_at = case when notify_when_verified then now() else customer_notified_at end,
           status = 'fulfilled', updated_at = now()
     where cook_id = new.id and status = 'active';

  elsif new.kyc_status = 'rejected' then
    insert into public.notifications (user_id, type, title, body, data)
    values (new.id, 'system', 'Verification not approved',
            'We could not approve your verification yet. Open Verification to see what to do next.',
            jsonb_build_object('kind', 'verification', 'status', 'rejected'));

  elsif old.kyc_status = 'verified' then
    -- an approval that was taken back
    insert into public.notifications (user_id, type, title, body, data)
    values (new.id, 'system', 'Verification removed',
            'Your verification is no longer active, so booking requests are paused. Open Verification for details.',
            jsonb_build_object('kind', 'verification', 'status', 'revoked'));
  end if;
  return new;
end;
$$;

drop trigger if exists zz_booking_interest_on_verification on public.profiles;
create trigger zz_booking_interest_on_verification
  after update of kyc_status on public.profiles
  for each row execute function public.booking_interest_on_verification();

commit;

-- READ-ONLY CHECKS to run AFTER applying -------------------------------------------
--   select relrowsecurity from pg_class where oid in ('public.booking_events'::regclass, 'public.booking_interests'::regclass); -- t, t
--   select count(*) from public.booking_interests;                                  -- 0
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'bookings_status_check';
