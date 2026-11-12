-- Delivery tracking for transactional emails (waitlist confirmation, welcome).
--
-- WHY: the API used to know only "Resend answered OK". This table records each
-- email's state and attempt count so failures can be retried safely and so we
-- never claim more than we know (accepted by Resend is not the same as
-- delivered to an inbox).
--
-- SAFE TO RE-RUN. Creates one new table; touches no existing data.
-- No email addresses are stored: recipient_key is the waitlist subscriber id or
-- the auth user id.
--
-- ROLLBACK: drop table public.email_deliveries;  (the app keeps sending emails
-- without tracking if the table is missing; it only loses retry bookkeeping.)

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('waitlist_confirmation', 'welcome')),
  recipient_key text not null,
  status text not null default 'queued'
    check (status in ('queued', 'accepted', 'delivered', 'bounced', 'failed')),
  attempts integer not null default 0,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, recipient_key)
);

create index if not exists email_deliveries_retry_idx
  on public.email_deliveries (status, updated_at)
  where status in ('failed', 'queued');

-- Server-only table: browsers and signed-in users have no access at all.
alter table public.email_deliveries enable row level security;
revoke all on public.email_deliveries from anon, authenticated;
grant all on public.email_deliveries to service_role;
