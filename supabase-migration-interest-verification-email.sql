-- "Notify me when verified": email outbox + final notification wording.
--
-- WHAT THIS DOES (additive, safe to re-run):
--  1. email_deliveries: allows two new email kinds ('interest_verified', 'tester_invitation'),
--     two new states ('processing' = claimed by one worker, 'cancelled' = deliberately not
--     sent), and a persisted retry schedule (next_attempt_at).
--  2. Replaces the verification trigger so that when a cook becomes verified it
--       - writes the in-app notification with the approved wording (idempotent), and
--       - QUEUES one email per interested customer who asked to be told.
--     The email itself is sent by the server (it needs Resend); the trigger only records
--     the intent. Because the trigger watches profiles.kyc_status, it catches EVERY way a
--     cook can become verified (admin review, a manual SQL fix, a future route).
--
-- PREREQUISITES (hard stop below if missing):
--   supabase-migration-booking-verification.sql   (booking_interests + notifications index)
--   supabase-migration-email-deliveries.sql       (email_deliveries)
--
-- DEPLOY ORDER: ship the app code first, then run this. The code tolerates this migration
-- not being applied yet (no emails are queued; in-app notifications keep working).
--
-- ROLLBACK:
--   re-run section "6. tell people when a cook's verification changes" of
--   supabase-migration-booking-verification.sql to restore the previous trigger body.
--   (the new columns/states are harmless to leave in place.)
--
-- ORDER MATTERS: if booking-verification is run again AFTER this file, the trigger goes back to
-- its old form and verification emails stop being queued without any error. Run this file
-- again to put the new trigger back.
--
-- NOT APPLIED to any database by this commit. The owner of the Supabase project runs it.

begin;

do $$
begin
  if to_regclass('public.booking_interests') is null then
    raise exception 'Run supabase-migration-booking-verification.sql first (public.booking_interests is missing).';
  end if;
  if to_regclass('public.email_deliveries') is null then
    raise exception 'Run supabase-migration-email-deliveries.sql first (public.email_deliveries is missing).';
  end if;
end;
$$;

-- ----------------------------------------------------------------- 1. email_deliveries
-- The original CHECK constraints were created inline, so find them by definition rather
-- than by an assumed name.
do $$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.email_deliveries'::regclass
       and contype = 'c'
       and (pg_get_constraintdef(oid) ilike '%kind%' or pg_get_constraintdef(oid) ilike '%status%')
  loop
    execute format('alter table public.email_deliveries drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.email_deliveries
  add constraint email_deliveries_kind_check
  check (kind in ('waitlist_confirmation', 'welcome', 'interest_verified', 'tester_invitation'));

-- queued     decided to send; nothing attempted yet
-- processing one worker has claimed it (stale claims are re-claimed by the server)
-- accepted   Resend accepted it (this is NOT proof of inbox delivery)
-- delivered / bounced   set by the Resend webhook
-- failed     Resend refused or was unreachable; retried on next_attempt_at
-- cancelled  deliberately not sent (no consent, cook no longer verified, ...)
alter table public.email_deliveries
  add constraint email_deliveries_status_check
  check (status in ('queued', 'processing', 'accepted', 'delivered', 'bounced', 'failed', 'cancelled'));

alter table public.email_deliveries
  add column if not exists next_attempt_at timestamptz;

create index if not exists email_deliveries_due_idx
  on public.email_deliveries (kind, status, next_attempt_at)
  where status in ('queued', 'failed', 'processing');

-- ------------------------------------------- 2. the verification trigger (final wording)
create or replace function public.booking_interest_on_verification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

    -- the customers who pressed "Notify me when verified". One in-app notification per
    -- interest, ever: the unique event_key index turns a repeat into a no-op.
    insert into public.notifications (user_id, type, title, body, data)
    select i.customer_id, 'booking', 'Good news! ❤️',
           'The cook you were interested in has completed Food4Love verification and is now eligible to receive booking requests. You can visit their profile and make a booking.',
           jsonb_build_object('kind', 'interest_available', 'cook_id', new.id,
                              'event_key', 'interest:' || i.id::text || ':verified')
      from public.booking_interests i
     where i.cook_id = new.id and i.status = 'active' and i.notify_when_verified
    on conflict do nothing;

    -- the email outbox. Best effort by design: if this insert ever fails, the cook's
    -- verification must still go through, so the failure is swallowed (the in-app
    -- notification above is already written).
    begin
      insert into public.email_deliveries (kind, recipient_key, status)
      select 'interest_verified', i.id::text, 'queued'
        from public.booking_interests i
       where i.cook_id = new.id and i.status = 'active' and i.notify_when_verified
      on conflict (kind, recipient_key) do nothing;
    exception when others then
      -- never block the verification, but leave a trace in the Postgres log (no personal
      -- data in it: only the cook id and the error text).
      raise warning 'interest_verified outbox insert failed for cook %: %', new.id, sqlerrm;
    end;

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
    -- an approval that was taken back. Interest rows already marked 'fulfilled' are kept
    -- as history; queued emails for this cook are re-checked (and cancelled) by the
    -- server at send time, so nobody is told "now available" about a cook who is not.
    insert into public.notifications (user_id, type, title, body, data)
    values (new.id, 'system', 'Verification removed',
            'Your verification is no longer active, so booking requests are paused. Open Verification for details.',
            jsonb_build_object('kind', 'verification', 'status', 'revoked'));
  end if;
  return new;
end;
$$;

-- the trigger itself already exists (zz_booking_interest_on_verification); recreating it
-- keeps this file self-contained and is harmless.
drop trigger if exists zz_booking_interest_on_verification on public.profiles;
create trigger zz_booking_interest_on_verification
  after update of kyc_status on public.profiles
  for each row execute function public.booking_interest_on_verification();

commit;

-- READ-ONLY CHECKS to run AFTER applying -------------------------------------------
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.email_deliveries'::regclass and contype = 'c';   -- kind + status checks
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'email_deliveries' and column_name = 'next_attempt_at';
--   select tgname from pg_trigger where tgname = 'zz_booking_interest_on_verification';
