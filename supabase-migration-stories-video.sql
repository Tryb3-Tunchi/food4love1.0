-- Chef stories: table, video storage bucket, and access rules.
-- Run in Supabase Dashboard -> SQL Editor. Safe to run more than once.

-- 1. Table (already exists on most projects; created here if missing)
create table if not exists stories (
  id uuid default gen_random_uuid() primary key,
  cook_id uuid references profiles(id) on delete cascade,
  image_url text,
  video_url text,
  caption text,
  expires_at timestamptz default (now() + interval '24 hours'),
  created_at timestamptz default now()
);

alter table stories alter column image_url drop not null;
alter table stories add column if not exists video_url text;

-- 2. Who can read and write stories
alter table stories enable row level security;

drop policy if exists "Stories are publicly readable" on stories;
create policy "Stories are publicly readable" on stories
  for select using (true);

drop policy if exists "Cooks manage their own stories" on stories;
create policy "Cooks manage their own stories" on stories
  for all using (auth.uid() = cook_id) with check (auth.uid() = cook_id);

-- 3. Storage bucket for the story files (public so they can be viewed,
--    50 MB per file, photos and videos only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-media',
  'story-media',
  true,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 4. Who can use the bucket. Each cook gets a folder named after their user
--    id (created automatically on first upload) and can only add or remove
--    files inside it. Anyone can watch.
drop policy if exists "Public read story media" on storage.objects;
create policy "Public read story media" on storage.objects
  for select using (bucket_id = 'story-media');

drop policy if exists "Cooks upload their own story media" on storage.objects;
create policy "Cooks upload their own story media" on storage.objects
  for insert with check (
    bucket_id = 'story-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Cooks delete their own story media" on storage.objects;
create policy "Cooks delete their own story media" on storage.objects
  for delete using (
    bucket_id = 'story-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
