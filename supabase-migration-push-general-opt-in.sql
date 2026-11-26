-- FOOD4LOVE: path from the push pilot to normal opt-in for every signed-in member
--
-- Requires supabase-migration-push-pilot-allowlist.sql. Safe to re-run. One transaction.
-- Applying this file changes NOTHING about who can use push: the switch starts at 'pilot'.
--
-- WHAT IT ADDS
--   * public.push_settings: one row, enrollment = 'pilot' | 'open'. Browsers cannot read or change it.
--       'pilot' (default)  only accounts in push_pilot_members can register devices and get pushes
--       'open'             every signed-in member MAY turn push on for their own devices. Nobody is
--                          subscribed automatically: each member still taps "Turn on notifications"
--                          and accepts the browser's permission prompt. Device ownership, RLS and
--                          preferences are unchanged.
--   * The registration and delivery guards from the pilot migration honour that switch.
--   * Fix: the daily cleanup removed devices "unseen" for 120 days even while they were receiving
--     pushes, because last_seen_at only changed at registration. A device that received a push or
--     was refreshed by the app recently is now kept.
--
-- OPEN PUSH TO EVERY SIGNED-IN MEMBER (separate, approved step; run once):
--   update public.push_settings set enrollment = 'open', updated_at = now();
-- BACK TO PILOT ONLY (devices of non-members then receive nothing; they are not deleted):
--   update public.push_settings set enrollment = 'pilot', updated_at = now();
--
-- ROLLBACK (restores the pilot-only guards and the previous cleanup):
--   re-run supabase-migration-push-pilot-allowlist.sql, then
--   drop function if exists public.food4love_push_enrollment_open(); drop table if exists public.push_settings;
--   and re-run the food4love_push_cleanup definition from supabase-migration-web-push.sql.

begin;

do $$
begin
  if to_regclass('public.push_pilot_members') is null then
    raise exception 'Run supabase-migration-push-pilot-allowlist.sql first';
  end if;
end;
$$;

create table if not exists public.push_settings (
  id boolean primary key default true check (id),
  enrollment text not null default 'pilot' check (enrollment in ('pilot', 'open')),
  updated_at timestamptz not null default now()
);
insert into public.push_settings (id) values (true) on conflict (id) do nothing;

alter table public.push_settings enable row level security;
revoke all on public.push_settings from public, anon, authenticated;
grant select, update on public.push_settings to service_role;

-- Fails closed: no row / unexpected value -> not open.
create or replace function public.food4love_push_enrollment_open()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select s.enrollment = 'open' from public.push_settings s where s.id), false)
$$;

create or replace function public.food4love_push_require_pilot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.food4love_push_enrollment_open()
     and not exists (select 1 from public.push_pilot_members m where m.user_id = new.user_id) then
    raise exception 'not_enrolled' using errcode = 'P0001',
      hint = 'This account is not in the push notifications pilot.';
  end if;
  return new;
end;
$$;

create or replace function public.food4love_push_delivery_requires_pilot()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.food4love_push_enrollment_open()
     and not exists (select 1 from public.push_pilot_members m where m.user_id = new.user_id) then
    return null; -- skip this row; the notification itself is unaffected
  end if;
  return new;
end;
$$;

-- keep devices that are in use: a recent registration refresh OR a recent successful push
create or replace function public.food4love_push_cleanup()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.notification_push_deliveries
   where created_at < now() - interval '30 days'
     and status in ('sent', 'expired', 'skipped', 'failed')
     and next_attempt_at is null;
  delete from public.push_subscriptions
   where greatest(last_seen_at, coalesce(last_success_at, last_seen_at)) < now() - interval '120 days'
      or failure_count >= 20;
$$;

revoke all on function public.food4love_push_enrollment_open() from public, anon, authenticated;
revoke all on function public.food4love_push_require_pilot() from public, anon, authenticated;
revoke all on function public.food4love_push_delivery_requires_pilot() from public, anon, authenticated;
revoke all on function public.food4love_push_cleanup() from public, anon, authenticated;
grant execute on function public.food4love_push_cleanup() to service_role;

do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_any_column_privilege(r, 'public.push_settings', 'SELECT')
       or has_any_column_privilege(r, 'public.push_settings', 'UPDATE')
       or has_any_column_privilege(r, 'public.push_settings', 'INSERT')
       or has_table_privilege(r, 'public.push_settings', 'DELETE')
       or has_function_privilege(r, 'public.food4love_push_enrollment_open()', 'execute')
       or has_function_privilege(r, 'public.food4love_push_cleanup()', 'execute') then
      raise exception 'push settings reachable by %', r;
    end if;
  end loop;
  if exists (select 1 from pg_policies where tablename = 'push_settings') then
    raise exception 'unexpected policy on push_settings';
  end if;
  if (select count(*) from public.push_settings) <> 1 then
    raise exception 'push_settings must have exactly one row';
  end if;
end;
$$;

commit;
