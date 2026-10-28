-- Apply to staging after inspecting existing messages/matches policies.
-- A soft-unmatched (blocked) pair retains messages for audit/history but cannot
-- continue reading or sending messages through the client API.
drop policy if exists "Message participants" on public.messages;
drop policy if exists "Active match participants read messages" on public.messages;
alter table public.messages
  add column if not exists sender_type text not null default 'user';
alter table public.messages
  add column if not exists staff_actor_id uuid references auth.users(id);
alter table public.messages
  alter column sender_id drop not null;
alter table public.messages
  drop constraint if exists messages_sender_type_check;
alter table public.messages
  add constraint messages_sender_type_check
  check (sender_type in ('user', 'staff'));
alter table public.messages
  drop constraint if exists messages_sender_identity_check;
alter table public.messages
  add constraint messages_sender_identity_check
  check (
    (sender_type = 'user' and sender_id is not null and staff_actor_id is null)
    or (sender_type = 'staff' and sender_id is null and staff_actor_id is not null)
  );

create policy "Active match participants read messages" on public.messages
  for select using (
    exists (
      select 1
      from public.matches m
      where m.id = messages.match_id
        and m.status = 'matched'
        and (m.user1_id = auth.uid() or m.user2_id = auth.uid())
    )
    or (
      auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
      and coalesce(auth.jwt() -> 'app_metadata' -> 'admin_permissions', '[]'::jsonb) ? 'messages:manage'
    )
  );

drop policy if exists "Send messages" on public.messages;
drop policy if exists "Active match participants send messages" on public.messages;
create policy "Active match participants send messages" on public.messages
  for insert with check (
    (
      (
        sender_type = 'user'
        and staff_actor_id is null
        and sender_id = auth.uid()
        and exists (
          select 1
          from public.matches m
          where m.id = messages.match_id
            and m.status = 'matched'
            and (m.user1_id = auth.uid() or m.user2_id = auth.uid())
        )
      )
      or (
        sender_type = 'staff'
        and sender_id = auth.uid()
        and staff_actor_id = auth.uid()
        and auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
        and coalesce(auth.jwt() -> 'app_metadata' -> 'admin_permissions', '[]'::jsonb) ? 'messages:manage'
        and exists (
          select 1 from public.matches m
          where m.id = messages.match_id and m.status = 'matched'
        )
      )
    )
  );