-- Apply to staging after confirming the deployed daily_specials schema.
alter table public.daily_specials
  add column if not exists moderation_status text not null default 'active',
  add column if not exists moderation_reason text,
  add column if not exists moderated_by uuid references auth.users(id),
  add column if not exists moderated_at timestamptz;

alter table public.daily_specials
  drop constraint if exists daily_specials_moderation_status_check;
alter table public.daily_specials
  add constraint daily_specials_moderation_status_check
  check (moderation_status in ('active', 'removed'));

create index if not exists daily_specials_moderation_status_idx
  on public.daily_specials (moderation_status, available_until desc);