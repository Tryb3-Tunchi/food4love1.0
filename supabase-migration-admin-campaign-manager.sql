-- Extend the existing campaign records for drafts, scheduling and audience targeting.
-- Existing admin_announcements and waitlist_email_campaigns remain the source of truth.
begin;

do $$
begin
  if to_regclass('public.admin_announcements') is null
     or to_regclass('public.admin_announcement_deliveries') is null
     or to_regclass('public.waitlist_email_campaigns') is null
     or to_regclass('public.waitlist_email_deliveries') is null then
    raise exception 'Apply the existing email communications and waitlist migrations first';
  end if;
end;
$$;

alter table public.admin_announcements
  add column if not exists campaign_name text,
  add column if not exists preview_text text,
  add column if not exists email_heading text,
  add column if not exists cta_label text,
  add column if not exists cta_url text,
  add column if not exists campaign_status text not null default 'completed',
  add column if not exists scheduled_at timestamptz,
  add column if not exists target_group text not null default 'all',
  add column if not exists selected_user_ids uuid[] not null default '{}'::uuid[],
  add column if not exists next_after_user_id uuid,
  add column if not exists updated_at timestamptz not null default now();

alter table public.email_deliveries
  drop constraint if exists email_deliveries_kind_check;
alter table public.email_deliveries
  add constraint email_deliveries_kind_check
    check (kind in (
      'waitlist_confirmation', 'welcome', 'interest_verified', 'tester_invitation',
      'password_recovery', 'referral_reward', 'support_alert', 'campaign_test'
    ));

alter table public.admin_announcements
  drop constraint if exists admin_announcements_campaign_status_check,
  add constraint admin_announcements_campaign_status_check
    check (campaign_status in ('draft', 'scheduled', 'sending', 'completed', 'failed')),
  drop constraint if exists admin_announcements_target_group_check,
  add constraint admin_announcements_target_group_check
    check (target_group in ('all', 'buyers', 'cooks', 'testers', 'selected'));

create index if not exists admin_announcements_scheduled_idx
  on public.admin_announcements (scheduled_at)
  where campaign_status = 'scheduled';

alter table public.waitlist_email_campaigns
  add column if not exists campaign_name text,
  add column if not exists preview_text text,
  add column if not exists email_heading text,
  add column if not exists cta_label text,
  add column if not exists cta_url text,
  add column if not exists campaign_status text not null default 'completed',
  add column if not exists scheduled_at timestamptz,
  add column if not exists selected_subscriber_ids uuid[] not null default '{}'::uuid[],
  add column if not exists next_after_id uuid,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.waitlist_email_campaigns
  drop constraint if exists waitlist_email_campaigns_campaign_status_check,
  add constraint waitlist_email_campaigns_campaign_status_check
    check (campaign_status in ('draft', 'scheduled', 'sending', 'completed', 'failed'));

create index if not exists waitlist_email_campaigns_scheduled_idx
  on public.waitlist_email_campaigns (scheduled_at)
  where campaign_status = 'scheduled';

alter table public.admin_announcements enable row level security;
alter table public.admin_announcement_deliveries enable row level security;
alter table public.waitlist_email_campaigns enable row level security;
alter table public.waitlist_email_deliveries enable row level security;
revoke all on public.admin_announcements, public.admin_announcement_deliveries,
  public.waitlist_email_campaigns, public.waitlist_email_deliveries from anon, authenticated;
grant all on public.admin_announcements, public.admin_announcement_deliveries,
  public.waitlist_email_campaigns, public.waitlist_email_deliveries to service_role;

commit;
