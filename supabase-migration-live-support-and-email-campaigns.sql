-- Food4Love live support extensions. Apply to staging first.
-- Existing support rows and the existing account support flow are preserved.

begin;

do $$
begin
  if to_regclass('public.support_threads') is null
     or to_regclass('public.support_messages') is null then
    raise exception 'Apply the existing admin support chat migration first';
  end if;
end;
$$;

alter table public.support_threads
  alter column user_id drop not null,
  add column if not exists guest_name text,
  add column if not exists guest_email text,
  add column if not exists guest_token_hash text,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists last_message_at timestamptz,
  add column if not exists last_message_sender_type text,
  add column if not exists last_admin_read_at timestamptz,
  add column if not exists last_user_read_at timestamptz;

update public.support_threads thread
set last_message_at = (
      select message.created_at
      from public.support_messages message
      where message.thread_id = thread.id
      order by message.created_at desc
      limit 1
    ),
    last_message_sender_type = (
      select message.sender_type
      from public.support_messages message
      where message.thread_id = thread.id
      order by message.created_at desc
      limit 1
    )
where thread.last_message_at is null
  and exists (
    select 1 from public.support_messages message where message.thread_id = thread.id
  );

alter table public.support_threads
  drop constraint if exists support_threads_status_check,
  add constraint support_threads_status_check
    check (status in ('open', 'in_progress', 'resolved')),
  drop constraint if exists support_threads_identity_check,
  add constraint support_threads_identity_check
    check (
      (user_id is not null and guest_token_hash is null and guest_email is null)
      or
      (user_id is null and guest_token_hash is not null and guest_email is not null)
    ),
  drop constraint if exists support_threads_last_message_sender_check,
  add constraint support_threads_last_message_sender_check
    check (last_message_sender_type is null or last_message_sender_type in ('user', 'guest', 'staff'));

drop index if exists public.support_threads_one_open_per_user_idx;
create unique index support_threads_one_active_per_user_idx
  on public.support_threads (user_id)
  where user_id is not null and status in ('open', 'in_progress');
create unique index if not exists support_threads_guest_token_hash_key
  on public.support_threads (guest_token_hash)
  where guest_token_hash is not null;
create index if not exists support_threads_inbox_idx
  on public.support_threads (status, updated_at desc);
create index if not exists support_threads_assignee_inbox_idx
  on public.support_threads (assigned_to, status, updated_at desc);

alter table public.support_messages
  add column if not exists is_internal_note boolean not null default false;

alter table public.support_messages
  alter column sender_id drop not null,
  drop constraint if exists support_messages_sender_type_check,
  add constraint support_messages_sender_type_check
    check (sender_type in ('user', 'guest', 'staff')),
  drop constraint if exists support_messages_sender_identity_check,
  add constraint support_messages_sender_identity_check
    check (
      (sender_type = 'user' and sender_id is not null and staff_actor_id is null and not is_internal_note)
      or (sender_type = 'guest' and sender_id is null and staff_actor_id is null and not is_internal_note)
      or (sender_type = 'staff' and sender_id is null and staff_actor_id is not null)
    );

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_threads, public.support_messages from anon, authenticated;
grant select on public.support_threads, public.support_messages to authenticated;
grant all on public.support_threads, public.support_messages to service_role;

drop policy if exists "Support thread participant or staff read" on public.support_threads;
create policy "Support thread participant or staff read"
  on public.support_threads for select to authenticated
  using (
    user_id = auth.uid()
    or (
      auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
      and coalesce(auth.jwt() -> 'app_metadata' -> 'admin_permissions', '[]'::jsonb) ? 'messages:manage'
    )
  );

drop policy if exists "Support message participant or staff read" on public.support_messages;
create policy "Support message participant or staff read"
  on public.support_messages for select to authenticated
  using (
    (
      not is_internal_note
      and exists (
        select 1 from public.support_threads thread
        where thread.id = support_messages.thread_id and thread.user_id = auth.uid()
      )
    )
    or (
      auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
      and coalesce(auth.jwt() -> 'app_metadata' -> 'admin_permissions', '[]'::jsonb) ? 'messages:manage'
    )
  );

-- Email notifications use the existing durable transactional email outbox.
alter table public.email_deliveries
  drop constraint if exists email_deliveries_kind_check;
alter table public.email_deliveries
  add constraint email_deliveries_kind_check
    check (kind in (
      'waitlist_confirmation', 'welcome', 'interest_verified', 'tester_invitation',
      'password_recovery', 'referral_reward', 'support_alert'
    ));

commit;
