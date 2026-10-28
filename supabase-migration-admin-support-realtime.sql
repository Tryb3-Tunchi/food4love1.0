-- Apply after supabase-migration-admin-support-chat.sql on staging.
-- Enables scoped Supabase Realtime reads; all writes remain server-side through
-- the existing authenticated and audited API routes.

do $$
begin
  if to_regclass('public.support_threads') is null
    or to_regclass('public.support_messages') is null then
    raise exception
      'Support chat tables are missing. Apply supabase-migration-admin-support-chat.sql first.';
  end if;

  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    raise exception 'Supabase Realtime publication supabase_realtime does not exist';
  end if;
end $$;

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
grant select on public.support_threads, public.support_messages to authenticated;

drop policy if exists "Support thread participant or staff read" on public.support_threads;
create policy "Support thread participant or staff read"
  on public.support_threads
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
      and coalesce(
        auth.jwt() -> 'app_metadata' -> 'admin_permissions',
        '[]'::jsonb
      ) ? 'messages:manage'
    )
  );

drop policy if exists "Support message participant or staff read" on public.support_messages;
create policy "Support message participant or staff read"
  on public.support_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.support_threads thread
      where thread.id = support_messages.thread_id
        and (
          thread.user_id = auth.uid()
          or (
            auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
            and coalesce(
              auth.jwt() -> 'app_metadata' -> 'admin_permissions',
              '[]'::jsonb
            ) ? 'messages:manage'
          )
        )
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_threads'
  ) then
    alter publication supabase_realtime add table public.support_threads;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'support_messages'
  ) then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end $$;
