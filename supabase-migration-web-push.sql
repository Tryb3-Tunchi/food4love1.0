-- FOOD4LOVE: Web Push delivery queue  (step 2; requires supabase-migration-notifications-write-lockdown.sql)
--
-- DESIGN
--   public.notifications stays the single source of truth. This file adds a second delivery
--   channel next to it:
--     push_subscriptions            one row per browser/device that turned push on
--     notification_push_deliveries  one row per (notification, device): the outbox AND the log
--   An AFTER INSERT trigger on notifications queues one delivery per device of the RECIPIENT ONLY,
--   after checking that member's push preferences. The Supabase Edge Function "push-dispatch"
--   claims queued rows, sends them, and reports the outcome through food4love_push_complete().
--
-- SECURITY
--   * Browsers never touch either table (no policies, privileges revoked). Next.js API routes and
--     the Edge Function use the service role, and every RPC here is executable by service_role only.
--   * Endpoint and encryption keys are stored for delivery only and are never returned to a client.
--   * The trigger refuses to install while browser roles can still INSERT notifications (step 1).
--   * Delivery rows hold codes and timestamps only: no payload, no endpoint, no message text.
--
-- This file does NOT enable pg_net / pg_cron or store any secret. That is a separate, explicitly
-- approved step: supabase-migration-web-push-activation.sql. Until then rows simply wait in the queue.
--
-- Safe to re-run. ROLLBACK at the bottom.

begin;

-- ------------------------------------------------------------------ 0. refuse to run unsafely
do $$
begin
  if to_regclass('public.notifications') is null or to_regclass('public.profiles') is null then
    raise exception 'notifications/profiles missing: wrong database?';
  end if;
  -- effective privileges: these include PUBLIC, inherited roles and column-level grants
  if has_any_column_privilege('authenticated', 'public.notifications', 'INSERT')
     or has_any_column_privilege('anon', 'public.notifications', 'INSERT')
     or has_table_privilege('authenticated', 'public.notifications', 'DELETE')
     or has_column_privilege('authenticated', 'public.notifications', 'body', 'UPDATE')
     or has_column_privilege('authenticated', 'public.notifications', 'data', 'UPDATE')
     or has_column_privilege('authenticated', 'public.notifications', 'user_id', 'UPDATE') then
    raise exception 'Run supabase-migration-notifications-write-lockdown.sql first: browser roles can still write notifications';
  end if;
end;
$$;

-- One notification per event, ever (same definition as supabase-migration-booking-verification.sql,
-- so whichever file runs first creates it and the other is a no-op).
create unique index if not exists notifications_event_key_once
  on public.notifications (user_id, (data ->> 'event_key'))
  where data ? 'event_key';

-- ------------------------------------------------------------------ 1. subscriptions
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique
    check (endpoint ~ '^https://[^/\s]+/\S+$' and length(endpoint) <= 1024),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{86,88}$'),       -- 65-byte P-256 point
  auth_secret text not null check (auth_secret ~ '^[A-Za-z0-9_-]{21,24}$'), -- 16-byte secret
  label text check (label is null or length(label) <= 60),
  platform text not null default 'other'
    check (platform in ('android', 'ios', 'windows', 'macos', 'linux', 'chromeos', 'other')),
  installed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0)
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant all on public.push_subscriptions to service_role;

-- ------------------------------------------------------------------ 2. delivery queue / log
create table if not exists public.notification_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  -- kept after the device is removed or expires, so the log survives (set null)
  subscription_id uuid references public.push_subscriptions (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'failed', 'expired', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz default now(),
  claimed_at timestamptz,
  claim_token uuid,
  http_status integer,
  error_code text check (error_code is null or length(error_code) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (notification_id, subscription_id)
);
create index if not exists push_deliveries_due
  on public.notification_push_deliveries (next_attempt_at)
  where status in ('queued', 'failed');
create index if not exists push_deliveries_sending
  on public.notification_push_deliveries (claimed_at)
  where status = 'sending';
create index if not exists push_deliveries_user on public.notification_push_deliveries (user_id);

alter table public.notification_push_deliveries enable row level security;
revoke all on public.notification_push_deliveries from public, anon, authenticated;
grant all on public.notification_push_deliveries to service_role;

-- ------------------------------------------------------------------ 3. categories and preferences
-- Maps an existing notification (type + data.kind) to a push preference category. New event kinds
-- (AI suggestions, order tracking, game rewards) only need a line here. Keep in step with
-- PUSH_CATEGORIES in supabase/functions/_shared/push-core.ts (a unit test compares them).
create or replace function public.food4love_notification_category(p_type text, p_data jsonb)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_data ->> 'kind' = 'push_test' then 'test'
    when p_data ->> 'kind' = 'security' then 'account'
    when p_data ->> 'kind' = 'verification' then 'verification'
    when p_data ->> 'kind' in ('interest', 'interest_available') then 'bookings'
    when coalesce(p_data ->> 'kind', '') like 'story%' then 'stories'
    when p_type = 'message' then 'messages'
    when p_type in ('match', 'like', 'request') then 'matches'
    when p_type = 'booking' then 'bookings'
    else 'updates'   -- system, review, announcements, rewards
  end
$$;

-- Push preferences live in profiles.notification_preferences -> 'push'. A missing key means "on":
-- having a registered device already proves the member said yes on that device.
-- 'account' (security) and 'test' ignore the category switches; only the master switch stops them.
create or replace function public.food4love_push_allowed(p_prefs jsonb, p_category text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when coalesce(p_prefs -> 'push' ->> 'enabled', 'true') = 'false' then false
    when p_category in ('account', 'test') then true
    else coalesce(p_prefs -> 'push' ->> p_category, 'true') <> 'false'
  end
$$;

-- ------------------------------------------------------------------ 4. retry schedule
-- How long to wait before retrying a delivery that failed temporarily (push service 429/5xx or a
-- network error), given how many attempts have been made so far. NULL means "give up".
-- TODO(human): decide Food4Love's retry schedule. The body below is a working placeholder
-- (1 min, 5 min, 30 min, 2 h, then give up after 5 attempts). The sandbox checks that whatever
-- you choose gives up within 8 attempts, never shortens the wait, and waits at least 30 s first.
create or replace function public.food4love_push_retry_delay(p_attempts integer)
returns interval
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_attempts >= 5 then null
    else (array[interval '1 minute', interval '5 minutes', interval '30 minutes', interval '2 hours'])[greatest(p_attempts, 1)]
  end
$$;

-- ------------------------------------------------------------------ 5. the "kick"
-- Wakes the Edge Function at once. Does nothing (and never fails) until the activation file has
-- enabled pg_net and stored the function URL + secret in Supabase Vault. The cron sweep in the
-- activation file catches anything a missed kick leaves behind.
create or replace function public.food4love_push_kick()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url text;
  v_secret text;
begin
  if to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then
    return;
  end if;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'food4love_push_dispatch_url'$q$
    into v_url;
  execute $q$select decrypted_secret from vault.decrypted_secrets where name = 'food4love_push_dispatch_secret'$q$
    into v_secret;
  if v_url is null or v_secret is null then
    return;
  end if;
  -- body carries nothing: the function only ever drains the real queue
  execute 'select net.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := 5000)'
    using v_url,
          jsonb_build_object('Content-Type', 'application/json', 'x-food4love-dispatch-secret', v_secret),
          '{}'::jsonb;
exception when others then
  raise warning 'food4love_push_kick skipped: %', sqlstate;
end;
$$;

-- ------------------------------------------------------------------ 6. enqueue on every new notification
create or replace function public.food4love_enqueue_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category text := public.food4love_notification_category(new.type, new.data);
  v_prefs jsonb;
  v_count integer;
begin
  select p.notification_preferences into v_prefs from public.profiles p where p.id = new.user_id;
  if not public.food4love_push_allowed(coalesce(v_prefs, '{}'::jsonb), v_category) then
    return new;
  end if;

  -- Chat bursts: the chat trigger writes one in-app notification per message. Push only the first
  -- one per conversation; while an earlier message alert for the same match is still unread, the
  -- new row stays in the feed but does not buzz the device again. Reading it re-arms the push.
  if v_category = 'messages' and new.data ? 'match_id' and exists (
    select 1 from public.notifications n
     where n.user_id = new.user_id and n.id <> new.id and n.type = 'message'
       and n.read is not true and n.data ->> 'match_id' = new.data ->> 'match_id'
       and n.created_at > now() - interval '24 hours'
  ) then
    return new;
  end if;

  -- RECIPIENT'S devices only: user_id comes from the notification row itself.
  insert into public.notification_push_deliveries (notification_id, subscription_id, user_id, category)
  select new.id, s.id, new.user_id, v_category
    from public.push_subscriptions s
   where s.user_id = new.user_id
  on conflict (notification_id, subscription_id) do nothing;
  get diagnostics v_count = row_count;

  if v_count > 0 then
    perform public.food4love_push_kick();
  end if;
  return new;
exception when others then
  -- push is best effort: a queue problem must never block the notification (or the booking,
  -- match or message that created it)
  raise warning 'food4love_enqueue_push failed: %', sqlstate;
  return new;
end;
$$;

drop trigger if exists zz_food4love_enqueue_push on public.notifications;
create trigger zz_food4love_enqueue_push
  after insert on public.notifications
  for each row execute function public.food4love_enqueue_push();

-- ------------------------------------------------------------------ 7. device registration (server routes only)
-- Registers or refreshes this browser's subscription for p_user_id. The endpoint is unique: if a
-- different account registered the same browser before (shared device, account switch), the row is
-- moved to the new account in the same statement, so a device never receives two accounts' pushes.
-- Keeps at most 10 devices per member (oldest unseen removed).
create or replace function public.food4love_push_register(
  p_user_id uuid, p_endpoint text, p_p256dh text, p_auth text,
  p_label text, p_platform text, p_installed boolean)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.push_subscriptions as s
    (user_id, endpoint, p256dh, auth_secret, label, platform, installed)
  values (p_user_id, p_endpoint, p_p256dh, p_auth, left(p_label, 60), coalesce(p_platform, 'other'),
          coalesce(p_installed, false))
  on conflict (endpoint) do update
     set user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth_secret = excluded.auth_secret,
         label = excluded.label,
         platform = excluded.platform,
         installed = excluded.installed,
         failure_count = case when s.user_id = excluded.user_id then s.failure_count else 0 end,
         last_success_at = case when s.user_id = excluded.user_id then s.last_success_at else null end,
         created_at = case when s.user_id = excluded.user_id then s.created_at else now() end,
         updated_at = now(),
         last_seen_at = now()
  returning id into v_id;

  delete from public.push_subscriptions
   where user_id = p_user_id
     and id in (select id from public.push_subscriptions
                 where user_id = p_user_id
                 order by last_seen_at desc offset 10);
  return v_id;
end;
$$;

-- Swap an old endpoint for a new one (browser rotated its subscription). Only the owner's row moves.
create or replace function public.food4love_push_replace(
  p_user_id uuid, p_old_endpoint text, p_endpoint text, p_p256dh text, p_auth text,
  p_label text, p_platform text, p_installed boolean)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.push_subscriptions where user_id = p_user_id and endpoint = p_old_endpoint;
  return public.food4love_push_register(p_user_id, p_endpoint, p_p256dh, p_auth, p_label, p_platform, p_installed);
end;
$$;

-- ------------------------------------------------------------------ 8. worker RPCs (Edge Function only)
-- (drop first: re-running after the return columns changed would otherwise fail)
drop function if exists public.food4love_push_claim(integer);
-- Claims up to p_limit due deliveries. Rows are locked with SKIP LOCKED and given a fresh claim
-- token, so two overlapping workers can never send the same delivery. A row stuck in 'sending' for
-- more than 5 minutes (worker died) becomes claimable again. Deliveries that can no longer be useful
-- are closed here instead of being sent:
--   device removed      -> skipped / device_removed
--   already read        -> skipped / already_read   (seen on another device or in the app)
--   older than 24 hours -> skipped / stale
create or replace function public.food4love_push_claim(p_limit integer default 50)
returns table (
  delivery_id uuid, claim_token uuid, attempts integer, category text,
  endpoint text, p256dh text, auth_secret text,
  notification_id uuid, notification_type text, notification_data jsonb, recipient_role text,
  recipient_sound boolean, unread_count integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.notification_push_deliveries d
     set status = 'skipped', updated_at = now(), next_attempt_at = null,
         error_code = case
           when d.subscription_id is null then 'device_removed'
           when n.read then 'already_read'
           else 'stale' end
    from public.notifications n
   where n.id = d.notification_id
     and (d.status in ('queued', 'failed') and d.next_attempt_at <= now()
          or d.status = 'sending' and d.claimed_at < now() - interval '5 minutes')
     and (d.subscription_id is null or n.read or n.created_at < now() - interval '24 hours');

  return query
  with due as (
    select d.id
      from public.notification_push_deliveries d
     where (d.status in ('queued', 'failed') and d.next_attempt_at <= now())
        or (d.status = 'sending' and d.claimed_at < now() - interval '5 minutes')
     order by d.next_attempt_at nulls last
     limit greatest(1, least(coalesce(p_limit, 50), 200))
     for update skip locked
  ), claimed as (
    update public.notification_push_deliveries d
       set status = 'sending', claimed_at = now(), claim_token = gen_random_uuid(),
           attempts = d.attempts + 1, updated_at = now()
      from due
     where d.id = due.id
    returning d.*
  )
  select c.id, c.claim_token, c.attempts, c.category,
         s.endpoint, s.p256dh, s.auth_secret,
         n.id, n.type, coalesce(n.data, '{}'::jsonb), p.role,
         coalesce(p.notification_preferences -> 'push' ->> 'sound', 'true') <> 'false',
         (select count(*)::integer from public.notifications u
           where u.user_id = c.user_id and u.read is not true)
    from claimed c
    join public.push_subscriptions s on s.id = c.subscription_id
    join public.notifications n on n.id = c.notification_id
    left join public.profiles p on p.id = c.user_id;
end;
$$;

-- Records the outcome of one send. p_outcome:
--   'sent'      push service accepted it (201)       -> sent
--   'gone'      404/410: the device unsubscribed     -> expired, device row deleted
--   'retry'     429/5xx/network                      -> failed, retried later (or given up)
--   'permanent' 400/401/403/413: will never work     -> failed, not retried
-- Returns false when the claim token no longer matches (another worker owns the row now).
create or replace function public.food4love_push_complete(
  p_delivery_id uuid, p_claim_token uuid, p_outcome text, p_http_status integer, p_error_code text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.notification_push_deliveries%rowtype;
  v_delay interval;
begin
  select * into d from public.notification_push_deliveries
   where id = p_delivery_id and claim_token = p_claim_token and status = 'sending'
   for update;
  if not found then
    return false;
  end if;

  if p_outcome = 'sent' then
    update public.notification_push_deliveries
       set status = 'sent', sent_at = now(), http_status = p_http_status, error_code = null,
           next_attempt_at = null, claim_token = null, updated_at = now()
     where id = d.id;
    update public.push_subscriptions
       set last_success_at = now(), failure_count = 0
     where id = d.subscription_id;

  elsif p_outcome = 'gone' then
    update public.notification_push_deliveries
       set status = 'expired', http_status = p_http_status, error_code = left(coalesce(p_error_code, 'gone'), 64),
           next_attempt_at = null, claim_token = null, updated_at = now()
     where id = d.id;
    -- the browser threw this subscription away: forget it (other queued rows become 'device_removed')
    delete from public.push_subscriptions where id = d.subscription_id;

  elsif p_outcome = 'retry' then
    v_delay := public.food4love_push_retry_delay(d.attempts);
    update public.notification_push_deliveries
       set status = 'failed', http_status = p_http_status, error_code = left(coalesce(p_error_code, 'retry'), 64),
           next_attempt_at = case when v_delay is null then null else now() + v_delay end,
           claim_token = null, updated_at = now()
     where id = d.id;
    update public.push_subscriptions set failure_count = failure_count + 1 where id = d.subscription_id;

  elsif p_outcome = 'permanent' then
    update public.notification_push_deliveries
       set status = 'failed', http_status = p_http_status, error_code = left(coalesce(p_error_code, 'rejected'), 64),
           next_attempt_at = null, claim_token = null, updated_at = now()
     where id = d.id;
    update public.push_subscriptions set failure_count = failure_count + 1 where id = d.subscription_id;

  else
    raise exception 'unknown push outcome %', p_outcome;
  end if;
  return true;
end;
$$;

-- Housekeeping (the activation file runs it daily): delivery log older than 30 days; devices not
-- seen for 120 days or failing 20 times in a row.
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
   where last_seen_at < now() - interval '120 days' or failure_count >= 20;
$$;

-- Is there anything for the worker to do? (lets the cron sweep skip empty runs)
create or replace function public.food4love_push_has_due()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.notification_push_deliveries d
     where (d.status in ('queued', 'failed') and d.next_attempt_at <= now())
        or (d.status = 'sending' and d.claimed_at < now() - interval '5 minutes'))
$$;

-- ------------------------------------------------------------------ 9. who may call what
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.food4love_push_kick()',
    'public.food4love_enqueue_push()',
    'public.food4love_push_register(uuid, text, text, text, text, text, boolean)',
    'public.food4love_push_replace(uuid, text, text, text, text, text, text, boolean)',
    'public.food4love_push_claim(integer)',
    'public.food4love_push_complete(uuid, uuid, text, integer, text)',
    'public.food4love_push_cleanup()',
    'public.food4love_push_has_due()',
    -- pure helpers too: Supabase's default privileges make every new function executable by
    -- anon/authenticated, and nothing outside the database needs to call these
    'public.food4love_notification_category(text, jsonb)',
    'public.food4love_push_allowed(jsonb, text)',
    'public.food4love_push_retry_delay(integer)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.food4love_push_register(uuid, text, text, text, text, text, boolean)',
    'public.food4love_push_replace(uuid, text, text, text, text, text, text, boolean)',
    'public.food4love_push_claim(integer)',
    'public.food4love_push_complete(uuid, uuid, text, integer, text)',
    'public.food4love_push_cleanup()',
    'public.food4love_push_has_due()'
  ] loop
    execute format('grant execute on function %s to service_role', f);
  end loop;
end;
$$;

commit;

-- ROLLBACK (removes push completely; notifications themselves are untouched):
--   begin;
--   drop trigger if exists zz_food4love_enqueue_push on public.notifications;
--   drop table if exists public.notification_push_deliveries;
--   drop table if exists public.push_subscriptions;
--   drop function if exists public.food4love_enqueue_push(), public.food4love_push_kick(),
--     public.food4love_push_register(uuid, text, text, text, text, text, boolean),
--     public.food4love_push_replace(uuid, text, text, text, text, text, text, boolean),
--     public.food4love_push_claim(integer), public.food4love_push_complete(uuid, uuid, text, integer, text),
--     public.food4love_push_cleanup(), public.food4love_push_has_due(),
--     public.food4love_push_retry_delay(integer), public.food4love_push_allowed(jsonb, text),
--     public.food4love_notification_category(text, jsonb);
--   commit;
