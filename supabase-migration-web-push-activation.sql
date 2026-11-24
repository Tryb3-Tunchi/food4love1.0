-- FOOD4LOVE: Web Push ACTIVATION  (step 3; STAGING FIRST; needs separate approval)
--
-- Run only after:
--   1. supabase-migration-notifications-write-lockdown.sql
--   2. supabase-migration-web-push.sql
--   3. the Edge Function "push-dispatch" is deployed to THIS project with its secrets
--      (see supabase/functions/push-dispatch/README.md)
--   4. two Vault secrets exist in THIS project (Dashboard > Project Settings > Vault, or SQL below).
--      Values are NOT in this file and must never be committed:
--        food4love_push_dispatch_url     https://<project-ref>.supabase.co/functions/v1/push-dispatch
--        food4love_push_dispatch_secret  the same random value as the function's PUSH_DISPATCH_SECRET
--      SQL form (run by hand, values typed in the SQL editor, not saved anywhere):
--        select vault.create_secret('<url>', 'food4love_push_dispatch_url');
--        select vault.create_secret('<secret>', 'food4love_push_dispatch_secret');
--
-- What it does: enables pg_net (HTTP from Postgres) and pg_cron, then schedules
--   food4love-push-sweep    every minute: wake the function if any delivery is due (retries,
--                           missed kicks). Costs nothing when the queue is empty.
--   food4love-push-cleanup  daily 03:17 UTC: trims the delivery log and dead devices.
--
-- ROLLBACK: select cron.unschedule('food4love-push-sweep'); select cron.unschedule('food4love-push-cleanup');
--           (pg_net / pg_cron can stay enabled; other features may use them.)

begin;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

do $$
begin
  if to_regprocedure('public.food4love_push_kick()') is null then
    raise exception 'Run supabase-migration-web-push.sql first';
  end if;
  if (select count(*) from vault.decrypted_secrets
       where name in ('food4love_push_dispatch_url', 'food4love_push_dispatch_secret')
         and coalesce(decrypted_secret, '') <> '') <> 2 then
    raise exception 'Vault secrets food4love_push_dispatch_url / food4love_push_dispatch_secret are missing';
  end if;
  if (select decrypted_secret from vault.decrypted_secrets where name = 'food4love_push_dispatch_url')
       not like 'https://%.supabase.co/functions/v1/push-dispatch' then
    raise exception 'food4love_push_dispatch_url must be https://<ref>.supabase.co/functions/v1/push-dispatch';
  end if;
end;
$$;

select cron.unschedule(jobid) from cron.job
 where jobname in ('food4love-push-sweep', 'food4love-push-cleanup');

select cron.schedule('food4love-push-sweep', '* * * * *',
  $$select public.food4love_push_kick() where public.food4love_push_has_due()$$);

select cron.schedule('food4love-push-cleanup', '17 3 * * *',
  $$select public.food4love_push_cleanup()$$);

-- refuse to commit unless exactly these two jobs exist and are active
do $$
begin
  if (select count(*) from cron.job
       where jobname in ('food4love-push-sweep', 'food4love-push-cleanup') and active) <> 2 then
    raise exception 'push cron jobs were not scheduled as expected';
  end if;
  if to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb, integer)') is null then
    raise exception 'pg_net http_post is not available with the expected signature';
  end if;
end;
$$;

commit;

-- CHECK: select jobname, schedule, active from cron.job where jobname like 'food4love-push-%';
