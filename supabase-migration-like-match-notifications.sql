-- Keep in-app like and match notifications working when an existing swipe is
-- updated by the API's ON CONFLICT upsert. This file is safe to re-run.
begin;

create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  swiper_name text;
begin
  if new.action not in ('like', 'superlike') then
    return new;
  end if;

  -- Do not create a second alert when a client repeats the same like.
  if tg_op = 'UPDATE'
    and old.action in ('like', 'superlike') then
    return new;
  end if;

  select p.full_name
    into swiper_name
    from public.profiles as p
    where p.id = new.swiper_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    new.swiped_id,
    'like',
    'Someone liked you!',
    coalesce(swiper_name, 'Someone') || ' liked your profile',
    jsonb_build_object('swiper_id', new.swiper_id, 'action', new.action)
  );

  return new;
end;
$$;

alter function public.notify_on_match()
  set search_path = public, pg_temp;

drop trigger if exists trg_notify_like on public.swipes;
create trigger trg_notify_like
  after insert or update on public.swipes
  for each row
  when (new.action in ('like', 'superlike'))
  execute function public.notify_on_like();

-- These functions are trigger entry points, not client-callable RPCs.
revoke all on function public.notify_on_like() from public, anon, authenticated;
revoke all on function public.notify_on_match() from public, anon, authenticated;

commit;
