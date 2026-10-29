-- Review against the target project's live schema before running.
-- This migration makes the launch paths work without broadening user access.

-- A cook's menu may be read by customers only while the cook is verified,
-- active, and the special is active. Owners can read their own records.
drop policy if exists "Specials are publicly readable" on public.daily_specials;
drop policy if exists "Cooks manage their own specials" on public.daily_specials;
drop policy if exists "Verified cooks manage their own specials" on public.daily_specials;
drop policy if exists "Customers read verified active specials" on public.daily_specials;
drop policy if exists "Cooks read their own specials" on public.daily_specials;
drop policy if exists "Verified cooks create their own specials" on public.daily_specials;
drop policy if exists "Verified cooks update their own specials" on public.daily_specials;
drop policy if exists "Cooks delete their own specials" on public.daily_specials;

create policy "Customers read verified active specials"
  on public.daily_specials for select to anon, authenticated
  using (
    moderation_status = 'active'
    and available_until > now()
    and exists (
      select 1 from public.profiles p
      where p.id = cook_id
        and p.role = 'cook'
        and p.kyc_status = 'verified'
        and p.suspended = false
    )
  );

create policy "Cooks read their own specials"
  on public.daily_specials for select to authenticated
  using (cook_id = (select auth.uid()));

create policy "Verified cooks create their own specials"
  on public.daily_specials for insert to authenticated
  with check (
    cook_id = (select auth.uid())
    and moderation_status = 'active'
    and moderation_reason is null
    and moderated_by is null
    and moderated_at is null
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'cook'
        and p.kyc_status = 'verified'
        and p.suspended = false
    )
  );

create policy "Verified cooks update their own specials"
  on public.daily_specials for update to authenticated
  using (
    cook_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'cook'
        and p.kyc_status = 'verified'
        and p.suspended = false
    )
  )
  with check (
    cook_id = (select auth.uid())
    and moderation_status = 'active'
    and moderation_reason is null
    and moderated_by is null
    and moderated_at is null
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'cook'
        and p.kyc_status = 'verified'
        and p.suspended = false
    )
  );

create policy "Cooks delete their own specials"
  on public.daily_specials for delete to authenticated
  using (cook_id = (select auth.uid()));

-- Public story media must live in a public bucket because story rows store
-- getPublicUrl() URLs. Only active cook accounts can upload into their own
-- folder; public users can read the assets referenced by active stories.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'story-media', 'story-media', true, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update
set name = excluded.name,
    public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Cooks upload their own story media" on storage.objects;
create policy "Cooks upload their own story media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'story-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'cook'
        and p.suspended = false
    )
  );

-- Story highlights refresh from Realtime after the subscription is active.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Supabase Realtime publication is not available';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'stories'
  ) then
    execute 'alter publication supabase_realtime add table public.stories';
  end if;

end $$;

-- KYC files stay private. Owners may upload only under their own auth ID;
-- privileged review routes use the server-only service-role client for reads.
create unique index if not exists kyc_one_pending_per_user
  on public.kyc_submissions (user_id)
  where status = 'pending';

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'kyc-documents', 'kyc-documents', false, 52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "KYC owners upload their own documents" on storage.objects;
create policy "KYC owners upload their own documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- The current booking screens need service details and a trusted amount.
-- Existing legacy fields remain intact for old rows and admin reporting.
alter table public.bookings
  add column if not exists meal_description text,
  add column if not exists service_address text,
  add column if not exists special_requests text,
  add column if not exists guest_count integer not null default 1,
  add column if not exists amount integer,
  add column if not exists delivery_fee integer not null default 0,
  add column if not exists service_fee integer not null default 0,
  add column if not exists payment_reference text;

create unique index if not exists bookings_payment_reference_key
  on public.bookings (payment_reference)
  where payment_reference is not null;

-- Keep normal user messages participant-scoped. Staff messages identify only
-- the real authenticated admin and require the trusted messages:manage claim.
drop policy if exists "Active match participants send messages" on public.messages;
create policy "Active match participants send messages"
  on public.messages for insert to authenticated
  with check (
    (
      sender_type = 'user'
      and sender_id = (select auth.uid())
      and staff_actor_id is null
      and exists (
        select 1 from public.matches m
        where m.id = match_id
          and m.status = 'matched'
          and (m.user1_id = (select auth.uid()) or m.user2_id = (select auth.uid()))
      )
    )
    or (
      sender_type = 'staff'
      and sender_id is null
      and staff_actor_id = (select auth.uid())
      and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      and coalesce(
        (select auth.jwt() -> 'app_metadata' -> 'admin_permissions'),
        '[]'::jsonb
      ) ? 'messages:manage'
      and exists (
        select 1 from public.matches m
        where m.id = match_id and m.status = 'matched'
      )
    )
  );
