-- Stores in-app notification feed preferences on each user's profile.
-- The existing profiles RLS policy limits profile updates to the owner.
alter table public.profiles
  add column if not exists notification_preferences jsonb not null
  default '{"messages":true,"swipeActivity":true,"bookings":true,"reviews":true}'::jsonb;