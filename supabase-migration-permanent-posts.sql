-- Permanent posts preserve story media and captions beyond the story expiry.
-- Apply only after confirming the target project does not already have a posts table.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  cook_id uuid not null references public.profiles(id) on delete cascade,
  story_id uuid references public.stories(id) on delete set null,
  image_url text,
  video_url text,
  caption text,
  created_at timestamptz not null default now(),
  constraint posts_has_content check (
    image_url is not null
    or video_url is not null
    or nullif(btrim(caption), '') is not null
  )
);

create unique index posts_story_id_unique
  on public.posts (story_id)
  where story_id is not null;

alter table public.posts enable row level security;

create policy "Posts are publicly readable"
  on public.posts for select
  using (true);

create policy "Cooks save their own stories as posts"
  on public.posts for insert
  with check (
    auth.uid() = cook_id
    and story_id is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'cook'
    )
    and exists (
      select 1
      from public.stories s
      where s.id = posts.story_id
        and s.cook_id = auth.uid()
    )
  );