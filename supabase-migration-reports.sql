-- Apply to staging after confirming referenced tables exist.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id),
  target_type text not null check (target_type in ('profile', 'daily_special', 'post', 'story', 'message')),
  target_id uuid not null,
  reason text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists reports_queue_idx
  on public.reports (status, created_at asc);
create index if not exists reports_target_idx
  on public.reports (target_type, target_id, created_at desc);

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select, insert, update on public.reports to service_role;