-- Chat read receipts + notification read state + realtime publication.
--
-- REVIEW BEFORE RUNNING. Run in a staging project first if you have one.
-- Everything here is additive and safe to re-run. No rows are changed, deleted
-- or created. Run the read-only checks at the bottom FIRST.
--
-- ROLLBACK (all optional, nothing depends on them but the new UI features):
--   drop function if exists public.mark_messages_read(uuid);
--   drop trigger if exists food4love_guard_notification_update on public.notifications;
--   drop function if exists public.food4love_guard_notification_update();
--   drop policy if exists "Users read own notifications" on public.notifications;
--   drop policy if exists "Users update own notifications" on public.notifications;

begin;

-- 1) Read receipts -----------------------------------------------------------
-- The app wants to store "this person has seen your message". A plain UPDATE
-- policy on messages would let a user edit any column of messages sent to them,
-- so the update goes through a function that can touch read_at and nothing else,
-- and only for conversations the caller belongs to.
create or replace function public.mark_messages_read(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null then
    return 0;
  end if;

  update public.messages as m
     set read_at = now()
   where m.match_id = p_match_id
     and m.read_at is null
     and m.sender_id is distinct from auth.uid()
     and exists (
       select 1
         from public.matches as mt
        where mt.id = m.match_id
          and mt.status = 'matched'
          and (mt.user1_id = auth.uid() or mt.user2_id = auth.uid())
     );

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.mark_messages_read(uuid) from public, anon;
grant execute on function public.mark_messages_read(uuid) to authenticated;

-- 2) Notifications: owner can read and mark-read their own rows only ----------
-- The notifications table is not created by any migration in this repository
-- (it was created in the dashboard), so this block only runs if it exists.
do $$
begin
  if to_regclass('public.notifications') is null then
    raise notice 'public.notifications not found; skipping notification policies';
    return;
  end if;

  execute 'alter table public.notifications enable row level security';

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'notifications'
       and policyname = 'Users read own notifications'
  ) then
    execute $p$
      create policy "Users read own notifications"
        on public.notifications for select to authenticated
        using (auth.uid() = user_id)
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'notifications'
       and policyname = 'Users update own notifications'
  ) then
    execute $p$
      create policy "Users update own notifications"
        on public.notifications for update to authenticated
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id)
    $p$;
  end if;
end;
$$;

-- RLS cannot limit WHICH columns an UPDATE changes, so this guard makes sure a
-- signed-in user can flip "read" and nothing else (not the title, body, owner...).
create or replace function public.food4love_guard_notification_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and auth.uid() is not null then
    if new.user_id is distinct from old.user_id
       or new.type is distinct from old.type
       or new.title is distinct from old.title
       or new.body is distinct from old.body
       or new.data is distinct from old.data then
      raise exception 'Only the read state of a notification can be changed';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.food4love_guard_notification_update()
  from public, anon, authenticated;

do $$
declare
  expected_columns integer;
begin
  if to_regclass('public.notifications') is null then
    return;
  end if;

  -- The guard reads these five columns. If the real table names them
  -- differently, installing the guard would make every user update fail, so it
  -- is skipped instead and the table keeps working as it does today.
  select count(*) into expected_columns
    from information_schema.columns
   where table_schema = 'public' and table_name = 'notifications'
     and column_name in ('user_id', 'type', 'title', 'body', 'data');

  if expected_columns <> 5 then
    raise notice 'notifications columns differ from the app (found % of 5); guard trigger skipped', expected_columns;
    return;
  end if;

  execute 'drop trigger if exists food4love_guard_notification_update on public.notifications';
  execute 'create trigger food4love_guard_notification_update
             before update on public.notifications
             for each row execute function public.food4love_guard_notification_update()';
end;
$$;

-- 3) Realtime: notifications must be published for the bell to update live -----
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication not found; skipping';
    return;
  end if;
  if to_regclass('public.notifications') is not null and not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public' and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;

commit;

-- READ-ONLY CHECKS (run these first, they change nothing) ----------------------
-- STOP AND ASK before running this file if either of these is not as expected:
--
-- (a) The functions that create notifications must be SECURITY DEFINER
--     (prosecdef = true). Section 2 turns row level security on for
--     notifications; a trigger that is not security definer would then be refused
--     when it tries to insert. Expect true for both rows.
--   select proname, prosecdef from pg_proc
--    where pronamespace = 'public'::regnamespace
--      and proname in ('notify_on_match', 'notify_on_like');
--
-- (b) The notifications table must have these columns:
--     id, user_id, type, title, body, data, read, created_at.
--   select column_name, data_type from information_schema.columns
--    where table_schema = 'public' and table_name = 'notifications' order by 1;
--
-- Is RLS already on for notifications, and which policies exist?
--   select relrowsecurity from pg_class where oid = 'public.notifications'::regclass;
--   select policyname, cmd, roles from pg_policies where tablename = 'notifications';
-- Is notifications already published to realtime?
--   select * from pg_publication_tables
--    where pubname = 'supabase_realtime' and tablename in ('notifications','messages','matches');
