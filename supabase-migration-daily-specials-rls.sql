-- Run this in Supabase Dashboard → SQL Editor.
-- daily_specials already has RLS enabled on your live project but no
-- policies, so every insert/update/delete is silently denied by default.
-- This lets cooks manage their own specials, and lets everyone read active ones.

create policy "Specials are publicly readable" on daily_specials
  for select using (true);

create policy "Cooks manage their own specials" on daily_specials
  for all using (auth.uid() = cook_id) with check (auth.uid() = cook_id);
