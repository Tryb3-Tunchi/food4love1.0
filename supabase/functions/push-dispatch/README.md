# push-dispatch (Supabase Edge Function)

Sends Food4Love Web Push notifications. It drains `public.notification_push_deliveries` and takes
no input. The database wakes it with a `pg_net` call when a delivery is queued, and a `pg_cron`
sweep runs every minute for retries.

```
notification row ──trigger──► push queue ──pg_net kick / cron──► push-dispatch ──► FCM / Apple / Mozilla / WNS ──► sw.js
 (source of truth)            (one row per device)                (encrypt + VAPID)                                  (shows it)
```

- **Library:** `jsr:@negrel/webpush@0.5.0` (RFC 8291 `aes128gcm` + RFC 8292 VAPID, Web Crypto only).
  An independent decrypt check passed, and the function has run under real Deno 2.9 against local
  fakes. Each message gets a fresh sender key.
- **Pure logic:** `../_shared/push-core.ts` holds the payload text, safe URLs, status mapping and the
  worker loop. Node tests cover it in `tests/push-core.test.mjs`.

## Activate on STAGING (each step needs approval; check the project ref first)

Staging ref: `pnqjzlzcvrtkpzhonjft`. Production is never a target of these steps.

1. Generate the staging keys outside the repo:
   `node scripts/generate-vapid-keys.mjs C:\dev\sample-data\food4love-staging staging`
2. Apply the migrations in order:
   `supabase-migration-notifications-write-lockdown.sql`, then `supabase-migration-web-push.sql`.
3. Set the function secrets. Values come from the generated file; never paste them into chat or git:
   `npx supabase secrets set --project-ref pnqjzlzcvrtkpzhonjft VAPID_KEYS_JSON=... PUSH_DISPATCH_SECRET=... VAPID_SUBJECT=mailto:<team address>`
4. Deploy the function. `--no-verify-jwt` is needed because the database has no user JWT; the
   function checks its own secret instead.
   `npx supabase functions deploy push-dispatch --project-ref pnqjzlzcvrtkpzhonjft --no-verify-jwt`
5. Create the two Vault secrets in the staging SQL editor:
   - `food4love_push_dispatch_url`: `https://pnqjzlzcvrtkpzhonjft.supabase.co/functions/v1/push-dispatch`
   - `food4love_push_dispatch_secret`: the same value as `PUSH_DISPATCH_SECRET`
6. Apply `supabase-migration-web-push-activation.sql`. It enables pg_net and pg_cron and schedules the sweep and cleanup.
7. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in the staging app's environment, then build with
   `next build && next start`. The service worker only registers in production builds.

## Checks after activation

- Call the function without the header. Expected: `401`.
- `select status, error_code, count(*) from notification_push_deliveries group by 1, 2;`
- `select jobname, active from cron.job where jobname like 'food4love-push-%';`
- `select * from net._http_response order by created desc limit 5;` (results of the kicks)

## Rollback

Unschedule the cron jobs (see the activation file), then `npx supabase functions delete push-dispatch`,
then run the ROLLBACK block in `supabase-migration-web-push.sql`. Notifications themselves are not affected.
