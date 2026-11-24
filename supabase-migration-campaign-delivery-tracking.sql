-- Campaign delivery state transitions from verified Resend webhooks.
begin;

do $$
begin
  if to_regclass('public.admin_announcement_deliveries') is null
     or to_regclass('public.waitlist_email_deliveries') is null then
    raise exception 'Apply the existing campaign delivery migrations first';
  end if;
end;
$$;

alter table public.admin_announcement_deliveries
  drop constraint if exists admin_announcement_deliveries_email_status_check,
  add constraint admin_announcement_deliveries_email_status_check
    check (email_status in ('not_requested', 'pending', 'sent', 'delivered', 'bounced', 'failed', 'skipped'));

alter table public.waitlist_email_deliveries
  drop constraint if exists waitlist_email_deliveries_status_check,
  add constraint waitlist_email_deliveries_status_check
    check (status in ('sent', 'delivered', 'bounced', 'failed', 'skipped'));

create index if not exists admin_announcement_deliveries_provider_message_idx
  on public.admin_announcement_deliveries (email_provider_message_id)
  where email_provider_message_id is not null;
create index if not exists waitlist_email_deliveries_provider_message_idx
  on public.waitlist_email_deliveries (provider_message_id)
  where provider_message_id is not null;

commit;
