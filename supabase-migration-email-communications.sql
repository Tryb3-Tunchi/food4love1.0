-- Email consent, durable admin announcement delivery, and signup confirmation tracking.
-- Run this after the existing auth-profile and waitlist migrations.

alter table public.profiles
  add column if not exists email_updates_consent boolean not null default false,
  add column if not exists email_updates_consent_at timestamptz;

alter table public.waitlist_subscribers
  add column if not exists confirmation_sent_at timestamptz;

create table if not exists public.admin_email_unsubscribe_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  token text not null unique default gen_random_uuid()::text,
  created_at timestamptz not null default now()
);

create or replace function public.food4love_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  opted_in boolean := coalesce(new.raw_user_meta_data ->> 'email_updates_consent' = 'true', false);
begin
  insert into public.profiles (
    id,
    full_name,
    role,
    email_updates_consent,
    email_updates_consent_at
  )
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New user'
    ),
    case
      when new.raw_user_meta_data ->> 'role' = 'cook' then 'cook'
      else 'buyer'
    end,
    opted_in,
    case when opted_in then now() else null end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.food4love_handle_new_user()
  from public, anon, authenticated, service_role;

create or replace function public.food4love_guard_profile_privileges()
returns trigger
language plpgsql
set search_path = public, auth
as $$
begin
  if auth.uid() = old.id and coalesce(auth.role(), '') <> 'service_role' then
    if new.kyc_status is distinct from old.kyc_status
      or new.is_verified is distinct from old.is_verified
      or new.suspended is distinct from old.suspended then
      raise exception 'Verification and suspension fields are server-managed';
    end if;

    if old.onboarding_complete and new.role is distinct from old.role then
      raise exception 'Role cannot be changed after onboarding is complete';
    end if;

    if old.onboarding_complete and not new.onboarding_complete then
      raise exception 'Completed onboarding cannot be reopened by the account owner';
    end if;

    if new.email_updates_consent is distinct from old.email_updates_consent then
      new.email_updates_consent_at := case
        when new.email_updates_consent then now()
        else null
      end;
    else
      new.email_updates_consent_at := old.email_updates_consent_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists food4love_guard_profile_privileges on public.profiles;
create trigger food4love_guard_profile_privileges
  before update on public.profiles
  for each row execute function public.food4love_guard_profile_privileges();

revoke all on function public.food4love_guard_profile_privileges()
  from public, anon, authenticated, service_role;

create table if not exists public.admin_announcements (
  id uuid primary key default gen_random_uuid(),
  campaign_key uuid not null unique,
  subject text not null,
  message text not null,
  send_email boolean not null default false,
  send_in_app boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_announcement_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.admin_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email_status text not null default 'not_requested'
    check (email_status in ('not_requested', 'pending', 'sent', 'failed', 'skipped')),
  email_provider_message_id text,
  email_error text,
  in_app_status text not null default 'not_requested'
    check (in_app_status in ('not_requested', 'pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);

create index if not exists admin_announcement_deliveries_campaign_email_idx
  on public.admin_announcement_deliveries (campaign_id, email_status);

alter table public.notifications
  add column if not exists admin_announcement_id uuid
  references public.admin_announcements(id) on delete set null;

create unique index if not exists notifications_user_admin_announcement_key
  on public.notifications (user_id, admin_announcement_id);

alter table public.admin_announcements enable row level security;
alter table public.admin_announcement_deliveries enable row level security;
alter table public.admin_email_unsubscribe_tokens enable row level security;
revoke all on public.admin_announcements from anon, authenticated;
revoke all on public.admin_announcement_deliveries from anon, authenticated;
revoke all on public.admin_email_unsubscribe_tokens from anon, authenticated;
grant all on public.admin_announcements to service_role;
grant all on public.admin_announcement_deliveries to service_role;
grant all on public.admin_email_unsubscribe_tokens to service_role;
