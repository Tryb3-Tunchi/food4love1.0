-- FOOD4LOVE: one "New Match" notification per match, ever  (SHARED DEPENDENCY: needs the matching owner's OK)
--
-- STATUS: PREPARED, NOT APPLIED ANYWHERE. notify_on_match() belongs to the matching workstream;
-- coordinate before running. The ONLY change to the function is an event_key in data and
-- ON CONFLICT DO NOTHING on its two inserts. Who is notified, the text and the trigger are unchanged.
--
-- WHY: today the match trigger writes no event_key, so nothing in the database stops a second
-- "New Match!" (and, with Web Push, a second push) if a match row is ever re-created or the trigger
-- fires twice. The unique index notifications_event_key_once (from the booking-verification or
-- web-push migration) turns a repeat into a no-op.
--
-- REQUIRES: the notifications_event_key_once index (created below if missing; same definition).
-- ROLLBACK: re-run the previous notify_on_match() definition (in the production schema export).

begin;

create unique index if not exists notifications_event_key_once
  on public.notifications (user_id, (data ->> 'event_key'))
  where data ? 'event_key';

create or replace function public.notify_on_match()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, type, title, body, data)
  values (
    new.user1_id, 'match', 'New Match!', 'You matched with someone. Start chatting!',
    jsonb_build_object('match_id', new.id, 'other_user_id', new.user2_id,
                       'event_key', 'match:' || new.id::text)
  )
  on conflict do nothing;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    new.user2_id, 'match', 'New Match!', 'You matched with someone. Start chatting!',
    jsonb_build_object('match_id', new.id, 'other_user_id', new.user1_id,
                       'event_key', 'match:' || new.id::text)
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.notify_on_match() from public, anon, authenticated;

commit;
