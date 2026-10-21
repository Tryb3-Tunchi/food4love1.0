-- Keep waitlist data server-managed. The service-role key is required by the API routes.
create table if not exists public.waitlist_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  audience text not null check (audience in ('food_lover', 'cook')),
  updates_consent boolean not null default false,
  source text not null default 'website',
  created_at timestamptz not null default now()
);

alter table public.waitlist_subscribers
  add column if not exists consent_at timestamptz,
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists unsubscribe_token text;

update public.waitlist_subscribers
set unsubscribe_token = gen_random_uuid()::text
where unsubscribe_token is null;

alter table public.waitlist_subscribers
  alter column unsubscribe_token set default gen_random_uuid()::text,
  alter column unsubscribe_token set not null;

create unique index if not exists waitlist_subscribers_email_lower_key
  on public.waitlist_subscribers (lower(email));
create unique index if not exists waitlist_subscribers_unsubscribe_token_key
  on public.waitlist_subscribers (unsubscribe_token);
create index if not exists waitlist_subscribers_campaign_audience_idx
  on public.waitlist_subscribers (id)
  where updates_consent = true and unsubscribed_at is null;

alter table public.waitlist_subscribers enable row level security;
revoke all on public.waitlist_subscribers from anon, authenticated;
grant all on public.waitlist_subscribers to service_role;
drop policy if exists "Public can join waitlist" on public.waitlist_subscribers;

create table if not exists public.waitlist_email_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_key uuid not null unique,
  kind text not null check (kind in ('launch', 'newsletter', 'offer')),
  subject text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.waitlist_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.waitlist_email_campaigns(id) on delete cascade,
  subscriber_id uuid not null references public.waitlist_subscribers(id) on delete cascade,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, subscriber_id)
);

create index if not exists waitlist_email_deliveries_campaign_status_idx
  on public.waitlist_email_deliveries (campaign_id, status);

alter table public.waitlist_email_campaigns enable row level security;
alter table public.waitlist_email_deliveries enable row level security;
revoke all on public.waitlist_email_campaigns from anon, authenticated;
revoke all on public.waitlist_email_deliveries from anon, authenticated;
grant all on public.waitlist_email_campaigns to service_role;
grant all on public.waitlist_email_deliveries to service_role;