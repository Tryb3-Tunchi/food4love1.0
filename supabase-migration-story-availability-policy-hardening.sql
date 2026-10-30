-- Remove legacy permissive policies that otherwise combine with newer
-- policies and allow non-cooks to write stories or expose expired stories.
drop policy if exists "Stories are publicly readable" on public.stories;
drop policy if exists "Read active stories" on public.stories;
drop policy if exists "Chefs create their own stories" on public.stories;
drop policy if exists "Chefs delete their own stories" on public.stories;
drop policy if exists "Cooks manage their own stories" on public.stories;
drop policy if exists "Active stories are publicly readable" on public.stories;
drop policy if exists "Active cooks manage their own stories" on public.stories;

create policy "Active stories are publicly readable"
  on public.stories for select to anon, authenticated
  using (expires_at > now());

create policy "Active cooks manage their own stories"
  on public.stories for all to authenticated
  using (
    cook_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'cook'
        and p.suspended = false
    )
  )
  with check (
    cook_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'cook'
        and p.suspended = false
    )
  );

drop policy if exists "Availability is publicly readable"
  on public.cook_availability;
drop policy if exists "Cooks manage their own availability"
  on public.cook_availability;

create policy "Availability is publicly readable"
  on public.cook_availability for select to anon, authenticated
  using (true);

create policy "Cooks manage their own availability"
  on public.cook_availability for all to authenticated
  using (
    cook_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'cook'
        and p.suspended = false
    )
  )
  with check (
    cook_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'cook'
        and p.suspended = false
    )
  );
