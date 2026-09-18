-- Run this in Supabase Dashboard → SQL Editor.
-- Adds video support to the `stories` table and locks it down with RLS
-- (it currently has none, so it's wide open to any authenticated client).

alter table stories alter column image_url drop not null;
alter table stories add column if not exists video_url text;

alter table stories enable row level security;

create policy "Stories are publicly readable" on stories
  for select using (true);

create policy "Cooks manage their own stories" on stories
  for all using (auth.uid() = cook_id) with check (auth.uid() = cook_id);

-- Storage: create a bucket first (Dashboard → Storage → New bucket → name
-- it "story-media" → toggle Public), then run this to scope uploads so a
-- cook can only write into their own folder while anyone can view/play.

create policy "Public read story media" on storage.objects
  for select using (bucket_id = 'story-media');

create policy "Cooks upload their own story media" on storage.objects
  for insert with check (
    bucket_id = 'story-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
