-- Apply to staging after confirming auth.users and pgcrypto are available.
create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists support_threads_one_open_per_user_idx
  on public.support_threads (user_id)
  where status = 'open';

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  sender_type text not null check (sender_type in ('user', 'staff')),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

-- Staff messages must identify the real staff actor without impersonating a
-- buyer or cook. User messages keep sender_id; staff messages use staff_actor_id.
alter table public.support_messages
  add column if not exists staff_actor_id uuid references auth.users(id);
alter table public.support_messages
  alter column sender_id drop not null;
alter table public.support_messages
  drop constraint if exists support_messages_sender_identity_check;
alter table public.support_messages
  add constraint support_messages_sender_identity_check
  check (
    (sender_type = 'user' and sender_id is not null and staff_actor_id is null)
    or (sender_type = 'staff' and sender_id is null and staff_actor_id is not null)
  );

create index if not exists support_messages_thread_created_idx
  on public.support_messages (thread_id, created_at asc);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_threads, public.support_messages from anon, authenticated;
grant select, insert, update, delete on public.support_threads, public.support_messages to service_role;
