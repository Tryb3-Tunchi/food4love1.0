-- FOOD4LOVE: Web Push pilot allowlist (replaces the PUSH_PILOT_USER_IDS / PUSH_ENROLLMENT env vars)
--
-- Requires supabase-migration-web-push.sql. Safe to re-run. One transaction.
--
-- WHAT IT DOES
--   * public.push_pilot_members: the accounts allowed to register devices for push. EMPTY after this
--     migration: nobody is approved by default. Browsers cannot read or change it (no policies, all
--     privileges revoked); only the service role (server routes, SQL editor) can.
--   * A trigger on push_subscriptions refuses to register a device for (or move a device to) an
--     account that is not in the pilot. This holds for every path, including direct SQL.
--   * Removing an account from the pilot also removes its devices, so delivery stops at once.
--   * Deliveries are gated as well: nothing is queued for an account outside the pilot.
--   * No existing row is changed or deleted; notifications are never touched.
--
-- ADD A TESTER (SQL editor, or `supabase db query --remote=<ref>`), using their real account id:
--   insert into public.push_pilot_members (user_id, note) values ('<profile id>', 'co-founder');
-- REMOVE A TESTER (their devices are removed too):
--   delete from public.push_pilot_members where user_id = '<profile id>';
--
-- ROLLBACK:
--   begin;
--   drop trigger if exists zz_food4love_push_require_pilot on public.push_subscriptions;
--   drop trigger if exists zz_food4love_push_pilot_removed on public.push_pilot_members;
--   drop trigger if exists zz_food4love_push_delivery_requires_pilot on public.notification_push_deliveries;
--   drop function if exists public.food4love_push_require_pilot(), public.food4love_push_pilot_removed(),
--     public.food4love_push_delivery_requires_pilot();
--   drop table if exists public.push_pilot_members;
--   commit;

begin;

do $$
begin
  if to_regclass('public.push_subscriptions') is null then
    raise exception 'Run supabase-migration-web-push.sql first';
  end if;
end;
$$;

create table if not exists public.push_pilot_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  note text check (note is null or length(note) <= 120)
);

alter table public.push_pilot_members enable row level security;
revoke all on public.push_pilot_members from public, anon, authenticated;
grant select, insert, delete on public.push_pilot_members to service_role;

-- only pilot members can own a push subscription
create or replace function public.food4love_push_require_pilot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.push_pilot_members m where m.user_id = new.user_id) then
    raise exception 'not_enrolled' using errcode = 'P0001',
      hint = 'This account is not in the push notifications pilot.';
  end if;
  return new;
end;
$$;

drop trigger if exists zz_food4love_push_require_pilot on public.push_subscriptions;
create trigger zz_food4love_push_require_pilot
  before insert or update of user_id on public.push_subscriptions
  for each row execute function public.food4love_push_require_pilot();

-- leaving the pilot removes that account's devices (and so all future deliveries to them)
create or replace function public.food4love_push_pilot_removed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.push_subscriptions where user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists zz_food4love_push_pilot_removed on public.push_pilot_members;
create trigger zz_food4love_push_pilot_removed
  after delete on public.push_pilot_members
  for each row execute function public.food4love_push_pilot_removed();

-- DELIVERY is gated too, not only registration: a delivery for an account outside the pilot is
-- silently not queued (the in-app notification itself is always saved). Covers any device that
-- existed before this migration or reached the table by any other path.
create or replace function public.food4love_push_delivery_requires_pilot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.push_pilot_members m where m.user_id = new.user_id) then
    return null; -- skip this row; no error, so the notification insert is unaffected
  end if;
  return new;
end;
$$;

drop trigger if exists zz_food4love_push_delivery_requires_pilot on public.notification_push_deliveries;
create trigger zz_food4love_push_delivery_requires_pilot
  before insert on public.notification_push_deliveries
  for each row execute function public.food4love_push_delivery_requires_pilot();

-- Devices registered before the allowlist existed are NOT deleted: the delivery gate above already
-- ensures they receive nothing unless their account is approved, and the daily push cleanup removes
-- devices unseen for 120 days. This migration therefore changes no existing rows.

revoke all on function public.food4love_push_require_pilot() from public, anon, authenticated;
revoke all on function public.food4love_push_pilot_removed() from public, anon, authenticated;
revoke all on function public.food4love_push_delivery_requires_pilot() from public, anon, authenticated;

-- prove the end state before committing
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_any_column_privilege(r, 'public.push_pilot_members', 'SELECT')
       or has_any_column_privilege(r, 'public.push_pilot_members', 'INSERT')
       or has_any_column_privilege(r, 'public.push_pilot_members', 'UPDATE')
       or has_table_privilege(r, 'public.push_pilot_members', 'DELETE') then
      raise exception 'pilot table is reachable by %', r;
    end if;
    if has_function_privilege(r, 'public.food4love_push_require_pilot()', 'execute')
       or has_function_privilege(r, 'public.food4love_push_pilot_removed()', 'execute')
       or has_function_privilege(r, 'public.food4love_push_delivery_requires_pilot()', 'execute') then
      raise exception 'pilot functions executable by %', r;
    end if;
  end loop;
  if exists (select 1 from pg_policies where tablename = 'push_pilot_members') then
    raise exception 'unexpected policy on push_pilot_members';
  end if;
  if (select count(*) from pg_trigger where tgname in ('zz_food4love_push_require_pilot', 'zz_food4love_push_pilot_removed', 'zz_food4love_push_delivery_requires_pilot')) <> 3 then
    raise exception 'pilot triggers missing';
  end if;
end;
$$;

commit;
