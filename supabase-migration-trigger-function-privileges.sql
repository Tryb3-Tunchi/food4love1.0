-- Keep trigger-only helpers out of the browser-facing Supabase RPC surface.
-- Trigger execution itself does not require client EXECUTE privileges.

begin;

revoke all on function public.booking_guard() from public, anon, authenticated;
revoke all on function public.booking_events_no_update() from public, anon, authenticated;
revoke all on function public.booking_interest_guard() from public, anon, authenticated;
revoke all on function public.booking_interest_on_verification() from public, anon, authenticated;
revoke all on function public.tester_invitations_guard() from public, anon, authenticated;

commit;
