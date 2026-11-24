-- FOOD4LOVE: notifications write lockdown  (step 1 of the Web Push work; REQUIRED before step 2)
--
-- PROBLEM (found 2026-11-24 in the production structure export):
--   public.notifications has ONE policy, "Own notifications" FOR ALL USING (auth.uid() = user_id),
--   with no WITH CHECK, and anon/authenticated hold every table privilege. A signed-in member can
--   therefore INSERT notifications addressed to themselves, rewrite the title/body/data of their own
--   rows, and DELETE them. Once Web Push exists, a self-inserted row would make the member's own
--   devices show text they wrote, so push delivery must not be switched on while this is open.
--
-- WHAT THIS FILE DOES (one transaction, safe to re-run):
--   1. Members may READ their own rows and change ONE column, "read" (column-level privilege, so
--      title/body/data/user_id/type cannot be touched even on their own rows).
--   2. Members and visitors can no longer INSERT, DELETE or TRUNCATE notifications at all.
--   3. Every existing policy on the table is replaced by the two below, so no older permissive
--      policy can survive alongside them.
--
-- WHO STILL WRITES NOTIFICATIONS (unchanged and verified in the sandbox):
--   * SECURITY DEFINER trigger functions (notify_on_like, notify_on_match,
--     booking_interest_on_verification): they run as the function owner, not as the member.
--   * Server routes using the service-role client (bookings, booking-interests, admin
--     announcements and support replies, payments/wallet, Paystack webhook).
--   NOT covered: src/app/api/payments/verify/route.ts inserts the cook's "Payment Received"
--   notification with the BUYER's session. That insert was already refused by the old policy
--   (buyer id <> cook id) and stays refused. Fix belongs to the payments owner: use the
--   service-role client there (see NOTIFICATIONS-COORDINATION.md).
--
-- Account deletion still removes a member's notifications: the profiles -> notifications foreign
-- key cascades as the table owner, not as the member.
--
-- ROLLBACK (restores the previous, weaker behaviour; only if something unexpected breaks):
--   begin;
--   drop policy if exists notifications_select_own on public.notifications;
--   drop policy if exists notifications_update_read_own on public.notifications;
--   create policy "Own notifications" on public.notifications for all to public using (auth.uid() = user_id);
--   grant select, insert, update, delete on public.notifications to authenticated;
--   commit;

begin;

do $$
begin
  if to_regclass('public.notifications') is null then
    raise exception 'public.notifications does not exist: wrong database?';
  end if;
end;
$$;

alter table public.notifications enable row level security;

-- 3. remove every existing policy, whatever it is called
do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'notifications'
  loop
    execute format('drop policy %I on public.notifications', p.policyname);
  end loop;
end;
$$;

-- 1. read your own feed
create policy notifications_select_own
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

-- 1. mark your own rows read/unread (the column grant below limits WHAT can change)
create policy notifications_update_read_own
  on public.notifications for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. table privileges: least privilege for browser roles. PUBLIC (every role, including any role
--    created later) is covered too, and so are explicit column-level grants, which a table-level
--    REVOKE does not always remove.
-- "all" (not a list) so privileges newer than this file, such as PostgreSQL 17's MAINTAIN, go too;
-- members get back only what they need just below.
revoke all on public.notifications from public, anon, authenticated;
do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(attname), ', ') into v_cols
    from pg_attribute
   where attrelid = 'public.notifications'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke all (%s) on public.notifications from public, anon, authenticated', v_cols);
end;
$$;
grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- 4. prove the end state, by EVERY route (PUBLIC, inherited role membership, column grants):
--    has_*_privilege answers "can this role do it", not "was it granted directly".
--    Any surviving write path aborts the whole transaction, so nothing above is kept.
do $$
declare
  r text;
  c record;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_any_column_privilege(r, 'public.notifications', 'INSERT')
       or has_table_privilege(r, 'public.notifications', 'DELETE')
       or has_table_privilege(r, 'public.notifications', 'TRUNCATE')
       or has_table_privilege(r, 'public.notifications', 'TRIGGER') then
      raise exception 'lockdown incomplete: % can still insert, delete, truncate or add triggers', r;
    end if;
    if has_table_privilege(r, 'public.notifications', 'REFERENCES')
       or (current_setting('server_version_num')::int >= 170000
           and has_table_privilege(r, 'public.notifications', 'MAINTAIN')) then
      raise exception 'lockdown incomplete: % still holds REFERENCES or MAINTAIN', r;
    end if;
    for c in
      select attname from pg_attribute
       where attrelid = 'public.notifications'::regclass and attnum > 0 and not attisdropped
         and attname <> 'read'
    loop
      if has_column_privilege(r, 'public.notifications', c.attname, 'UPDATE') then
        raise exception 'lockdown incomplete: % can still update column %', r, c.attname;
      end if;
    end loop;
  end loop;
  if has_any_column_privilege('anon', 'public.notifications', 'SELECT')
     or has_column_privilege('anon', 'public.notifications', 'read', 'UPDATE') then
    raise exception 'lockdown incomplete: visitors can still read or update notifications';
  end if;
  if not has_table_privilege('authenticated', 'public.notifications', 'SELECT')
     or not has_column_privilege('authenticated', 'public.notifications', 'read', 'UPDATE') then
    raise exception 'lockdown would break the feed or mark-as-read';
  end if;
  if not has_table_privilege('service_role', 'public.notifications', 'INSERT') then
    raise exception 'lockdown would break the server-side notification writers';
  end if;
end;
$$;

commit;

-- READ-ONLY CHECKS after running (expected results in brackets):
--   select policyname, cmd from pg_policies where tablename = 'notifications';
--       [notifications_select_own SELECT, notifications_update_read_own UPDATE]
--   (the migration itself already refuses to commit unless all of these hold)
--   select has_any_column_privilege('authenticated', 'public.notifications', 'INSERT'); [false]
--   select has_table_privilege('authenticated', 'public.notifications', 'DELETE');   [false]
--   select has_column_privilege('authenticated', 'public.notifications', 'read', 'UPDATE');  [true]
--   select has_column_privilege('authenticated', 'public.notifications', 'title', 'UPDATE'); [false]
