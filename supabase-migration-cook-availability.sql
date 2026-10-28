-- Cook availability and service area.
-- Run in Supabase Dashboard -> SQL Editor. Safe to run more than once.
-- One row per cook. A cook with no row has no rules, so bookings behave
-- exactly as they did before.

create table if not exists cook_availability (
  cook_id uuid primary key references profiles(id) on delete cascade,
  -- {"mon": {"open": "09:00", "close": "20:00"}, "sun": null, ...}
  -- An empty object means "no weekly schedule" (any day is fine).
  weekly_hours jsonb not null default '{}'::jsonb,
  max_orders_per_day integer,
  notice_hours integer,
  service_areas text[] not null default '{}',
  is_paused boolean not null default false,
  updated_at timestamptz default now()
);

alter table cook_availability enable row level security;

-- Buyers need to read this to see whether a cook can take their booking.
drop policy if exists "Availability is publicly readable" on cook_availability;
create policy "Availability is publicly readable" on cook_availability
  for select using (true);

drop policy if exists "Cooks manage their own availability" on cook_availability;
create policy "Cooks manage their own availability" on cook_availability
  for all using (auth.uid() = cook_id) with check (auth.uid() = cook_id);
