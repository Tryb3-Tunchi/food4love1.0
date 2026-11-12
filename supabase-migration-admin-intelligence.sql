-- Admin Operations & Intelligence Center: privacy-conscious analytics, online
-- presence, operational events and email event history.
--
-- REVIEW BEFORE RUNNING. NOT applied anywhere. Run it in a staging project
-- first if you have one. Everything is additive and safe to re-run: it creates
-- NEW tables and one guard on admin_audit_log; it changes no existing rows.
--
-- WHAT IS (AND IS NOT) STORED
--   * No IP addresses, no user agents, no precise location. Country/region come
--     from coarse geo headers supplied by the hosting platform at request time.
--   * Only the URL PATH of a page, never the query string (tokens, emails).
--   * No message content, no form values, no passwords.
--   * Visitors are random first-party ids; nothing is collected before consent.
--   * Deleting a user clears their user_id from analytics (ON DELETE SET NULL).
--
-- ROLLBACK (everything here is new, so this removes it all):
--   drop trigger if exists admin_audit_log_guard on public.admin_audit_log;
--   drop function if exists public.admin_audit_log_guard();
--   drop function if exists public.purge_old_intelligence_data(integer);
--   drop table if exists public.email_events, public.ops_events,
--     public.user_presence, public.analytics_events, public.analytics_sessions;
--
-- RETENTION: run  select public.purge_old_intelligence_data(400);  on a schedule
-- (e.g. a Supabase cron job, monthly). It is NOT scheduled by this file.

begin;

-- 1) Sessions (one row per visit) -------------------------------------------
create table if not exists public.analytics_sessions (
  id uuid primary key,
  visitor_id uuid not null,
  user_id uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  landing_path text not null,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  channel text not null default 'direct'
    check (channel in ('direct','google','instagram','tiktok','facebook','x',
                       'referral','campaign','other')),
  country char(2),
  region text,
  device text check (device in ('mobile','tablet','desktop')),
  is_returning boolean not null default false
);

create index if not exists analytics_sessions_started_idx
  on public.analytics_sessions (started_at desc);
create index if not exists analytics_sessions_visitor_idx
  on public.analytics_sessions (visitor_id, started_at desc);
create index if not exists analytics_sessions_channel_idx
  on public.analytics_sessions (channel, started_at desc);
create index if not exists analytics_sessions_country_idx
  on public.analytics_sessions (country, started_at desc);

-- 2) Events (page views and a short allow-list of actions) -------------------
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  client_event_id uuid not null unique, -- stops the same event being stored twice
  session_id uuid not null references public.analytics_sessions (id) on delete cascade,
  visitor_id uuid not null,
  user_id uuid references auth.users (id) on delete set null,
  name text not null
    check (name in ('page_view','waitlist_signup','signup_complete',
                    'profile_complete','cook_profile_view','story_view',
                    'story_save','booking_request')),
  path text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_created_idx
  on public.analytics_events (created_at desc);
create index if not exists analytics_events_name_idx
  on public.analytics_events (name, created_at desc);
create index if not exists analytics_events_session_idx
  on public.analytics_events (session_id);

-- 3) Presence: the latest heartbeat of each signed-in member -----------------
create table if not exists public.user_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  path text,
  first_seen_at timestamptz not null default now()
);

create index if not exists user_presence_last_seen_idx
  on public.user_presence (last_seen_at desc);

-- 4) Operational events (short summaries only, never request payloads) -------
create table if not exists public.ops_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  severity text not null check (severity in ('info','warning','error','critical')),
  service text not null check (char_length(service) <= 40),
  code text check (char_length(code) <= 60),
  summary text not null check (char_length(summary) <= 200)
);

create index if not exists ops_events_created_idx
  on public.ops_events (created_at desc);
create index if not exists ops_events_severity_idx
  on public.ops_events (severity, created_at desc);

-- 5) Email event history from Resend webhooks (no addresses stored) ----------
create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique, -- the webhook delivery id: replays are ignored
  provider_message_id text,
  event_type text not null check (char_length(event_type) <= 40),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists email_events_created_idx
  on public.email_events (created_at desc);
create index if not exists email_events_message_idx
  on public.email_events (provider_message_id);

-- 6) Server-only access ------------------------------------------------------
-- Browsers and signed-in members have NO access. Only the server (service role)
-- reads and writes these, after checking the caller's admin permissions.
alter table public.analytics_sessions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.user_presence enable row level security;
alter table public.ops_events enable row level security;
alter table public.email_events enable row level security;

revoke all on public.analytics_sessions from anon, authenticated;
revoke all on public.analytics_events from anon, authenticated;
revoke all on public.user_presence from anon, authenticated;
revoke all on public.ops_events from anon, authenticated;
revoke all on public.email_events from anon, authenticated;

grant all on public.analytics_sessions to service_role;
grant all on public.analytics_events to service_role;
grant all on public.user_presence to service_role;
grant all on public.ops_events to service_role;
grant all on public.email_events to service_role;
grant usage, select on all sequences in schema public to service_role;

-- 7) Retention ---------------------------------------------------------------
create or replace function public.purge_old_intelligence_data(p_days integer default 400)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cutoff timestamptz := now() - make_interval(days => greatest(p_days, 30));
  removed integer := 0;
  n integer;
begin
  delete from public.analytics_sessions where started_at < cutoff;
  get diagnostics n = row_count; removed := removed + n;
  delete from public.ops_events where created_at < cutoff;
  get diagnostics n = row_count; removed := removed + n;
  delete from public.email_events where created_at < cutoff;
  get diagnostics n = row_count; removed := removed + n;
  return removed; -- analytics_events go with their session (ON DELETE CASCADE)
end;
$$;

revoke all on function public.purge_old_intelligence_data(integer)
  from public, anon, authenticated;
grant execute on function public.purge_old_intelligence_data(integer) to service_role;

-- 8) Audit log: history can be appended to, never rewritten or deleted --------
-- The app only ever inserts a row ("started") and later updates its outcome.
-- This guard refuses everything else, including by staff and the service role.
-- (Only runs if the audit table exists in this project.)
do $$
begin
  if to_regclass('public.admin_audit_log') is null then
    raise notice 'admin_audit_log not found; audit guard skipped';
    return;
  end if;

  execute $f$
    create or replace function public.admin_audit_log_guard()
    returns trigger
    language plpgsql
    set search_path = public, pg_temp
    as $body$
    begin
      if tg_op = 'DELETE' then
        raise exception 'Audit records cannot be deleted';
      end if;
      if new.id is distinct from old.id
         or new.actor_id is distinct from old.actor_id
         or new.action is distinct from old.action
         or new.target_type is distinct from old.target_type
         or new.target_id is distinct from old.target_id
         or new.details is distinct from old.details
         or new.created_at is distinct from old.created_at then
        raise exception 'Audit records can only have their outcome updated';
      end if;
      return new;
    end;
    $body$
  $f$;

  execute 'drop trigger if exists admin_audit_log_guard on public.admin_audit_log';
  execute 'create trigger admin_audit_log_guard
             before update or delete on public.admin_audit_log
             for each row execute function public.admin_audit_log_guard()';
end;
$$;

commit;

-- READ-ONLY CHECKS to run after applying -------------------------------------
--   select tablename, rowsecurity from pg_tables
--    where schemaname = 'public'
--      and tablename in ('analytics_sessions','analytics_events','user_presence',
--                        'ops_events','email_events');          -- all true
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name in ('analytics_events','user_presence')
--      and grantee in ('anon','authenticated');                 -- no rows
