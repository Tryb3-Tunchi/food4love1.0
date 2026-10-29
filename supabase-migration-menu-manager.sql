-- Menu manager: extra details for daily specials, plus pause support.
-- Run in Supabase Dashboard -> SQL Editor. Safe to run more than once.
-- Every column is optional, so existing specials keep working unchanged.

alter table daily_specials add column if not exists is_paused boolean not null default false;
alter table daily_specials add column if not exists serving_size integer;
alter table daily_specials add column if not exists lead_time_hours integer;
alter table daily_specials add column if not exists fulfillment_options text[];
alter table daily_specials add column if not exists fulfillment_notes text;
alter table daily_specials add column if not exists ingredients text;
alter table daily_specials add column if not exists allergens text[];
alter table daily_specials add column if not exists portions_available integer;

-- Editing, pausing and ending a special needs cooks to be allowed to update
-- their own rows. This is the same policy as supabase-migration-daily-specials-rls.sql,
-- repeated here so this script works on its own.
drop policy if exists "Specials are publicly readable" on daily_specials;
create policy "Specials are publicly readable" on daily_specials
  for select using (true);

drop policy if exists "Cooks manage their own specials" on daily_specials;
create policy "Cooks manage their own specials" on daily_specials
  for all using (auth.uid() = cook_id) with check (auth.uid() = cook_id);
