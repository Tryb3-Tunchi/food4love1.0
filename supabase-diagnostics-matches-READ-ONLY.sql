-- READ-ONLY diagnostics for "the notification says I matched, but the Matches
-- page is empty". Every statement is a SELECT: nothing is changed.
-- Run each block in the Supabase SQL editor and send back the results.

-- 1) Matches whose profile cannot be joined (the page used to hide these rows).
select m.id as match_id, m.status, m.created_at,
       m.user1_id, p1.id is null as user1_profile_missing,
       m.user2_id, p2.id is null as user2_profile_missing
  from public.matches m
  left join public.profiles p1 on p1.id = m.user1_id
  left join public.profiles p2 on p2.id = m.user2_id
 where p1.id is null or p2.id is null;

-- 2) Matches that exist but are not 'matched' (the page only lists 'matched').
select status, count(*) from public.matches group by status order by 2 desc;

-- 3) Duplicate matches for the same pair of people.
select least(user1_id, user2_id) as a, greatest(user1_id, user2_id) as b,
       count(*) as how_many, array_agg(id order by created_at) as match_ids
  from public.matches
 group by 1, 2
having count(*) > 1;

-- 4) Match notifications and what they point at. Shows the real "data" keys the
--    notify_on_match trigger writes, so the app can link to the right place.
select n.id, n.user_id, n.created_at, n.read, n.data
  from public.notifications n
 where n.type = 'match'
 order by n.created_at desc
 limit 20;

-- 5) Is there a visible match for each user who got a match notification?
select n.user_id,
       count(distinct n.id) as match_notifications,
       count(distinct m.id) filter (where m.status = 'matched') as visible_matches
  from public.notifications n
  left join public.matches m
    on (m.user1_id = n.user_id or m.user2_id = n.user_id)
 where n.type = 'match'
 group by n.user_id
having count(distinct n.id) > count(distinct m.id) filter (where m.status = 'matched');

-- 6) The notify_on_match trigger function is called by existing migrations but
--    is not defined in this repository. Export it so it can be version-controlled.
select pg_get_functiondef('public.notify_on_match'::regproc);

-- 7) How are unread notifications stored? (checks the "read" column exists/works)
select type, read, count(*) from public.notifications group by 1, 2 order by 1, 2;

-- 8) THE MOST LIKELY CAUSE: pairs who both liked each other, whose match row
--    exists but is NOT 'matched' (for example blocked by an admin). The old swipe
--    API ignored this conflict and told both people "It's a match!" while the
--    Matches page, which lists only 'matched' rows, showed nothing.
select m.id as match_id, m.status, m.created_at, m.expires_at, m.user1_id, m.user2_id
  from public.matches m
 where m.status <> 'matched'
   and exists (select 1 from public.swipes a
                where a.swiper_id = m.user1_id and a.swiped_id = m.user2_id
                  and a.action in ('like', 'superlike'))
   and exists (select 1 from public.swipes b
                where b.swiper_id = m.user2_id and b.swiped_id = m.user1_id
                  and b.action in ('like', 'superlike'))
 order by m.created_at desc;

-- 9) Mutual likes with no match row at all (the match was never created).
select a.swiper_id as user_a, a.swiped_id as user_b, a.created_at as a_liked_at
  from public.swipes a
  join public.swipes b
    on b.swiper_id = a.swiped_id and b.swiped_id = a.swiper_id
 where a.action in ('like', 'superlike')
   and b.action in ('like', 'superlike')
   and a.swiper_id < a.swiped_id
   and not exists (select 1 from public.matches m
                    where (m.user1_id = a.swiper_id and m.user2_id = a.swiped_id)
                       or (m.user1_id = a.swiped_id and m.user2_id = a.swiper_id))
 order by a.created_at desc;

-- 10) Is the profile "read" policy still open? The Matches page needs to read the
--     other person's profile. Expect a SELECT policy that allows signed-in users.
select policyname, cmd, roles, qual
  from pg_policies
 where schemaname = 'public' and tablename = 'profiles' and cmd in ('SELECT', 'ALL');

-- 11) Which triggers exist on matches and swipes (the match notification trigger
--     is not defined in this repository).
select event_object_table as table_name, trigger_name, action_timing, event_manipulation
  from information_schema.triggers
 where event_object_schema = 'public'
   and event_object_table in ('matches', 'swipes', 'notifications', 'messages')
 order by 1, 2;
