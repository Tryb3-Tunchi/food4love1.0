-- Notify the other matched participant when a normal chat message is created.
--
-- This only writes the existing in-app notifications row. It does not send email,
-- alter message contents, or expose messages outside the existing match policies.
-- Apply as a reviewed migration after confirming messages and notifications have
-- the columns used below. Production migration application is intentionally manual.

begin;

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
  sender_name text;
begin
  select case
           when mt.user1_id = new.sender_id then mt.user2_id
           when mt.user2_id = new.sender_id then mt.user1_id
           else null
         end
    into recipient_id
    from public.matches as mt
   where mt.id = new.match_id
     and mt.status = 'matched';

  -- Invalid/nonparticipant messages do not create notifications. Existing RLS
  -- remains responsible for deciding whether the message itself may be written.
  if recipient_id is null or recipient_id = new.sender_id then
    return new;
  end if;

  select p.full_name
    into sender_name
    from public.profiles as p
   where p.id = new.sender_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    recipient_id,
    'message',
    'New message',
    coalesce(sender_name, 'Your match') || ' sent you a message',
    pg_catalog.jsonb_build_object('match_id', new.match_id)
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_message on public.messages;
create trigger trg_notify_message
  after insert on public.messages
  for each row
  execute function public.notify_on_message();

-- This function is trigger-only, never a public RPC.
revoke all on function public.notify_on_message() from public, anon, authenticated;

commit;
