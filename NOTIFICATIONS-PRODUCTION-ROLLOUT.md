# Web Push: production rollout and pilot with real members

Status at the time of the Draft PR: everything below is **prepared, not done**. No production
migration has been applied, no production Edge Function is deployed, and no production VAPID key exists.

## What is already proven on staging (`food4love-staging`)

| Check                                                                                                                                  | Result |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Lockdown with real Auth/PostgREST, customer + cook accounts (no spoofed create/edit/delete; writers and mark-as-read still work)       | 25/25  |
| Web Push database: RLS, functions closed to browsers, ownership, multiple devices, preferences, queue, retries, expiry, account switch | 62/62  |
| Edge Function fails closed in real Deno (every misconfiguration or wrong secret is refused before any database access)                 | 18/18  |
| Deployed Edge Function: auth (401 for anything but the exact secret) and isolation probe (reads/writes only the staging database)      | 14/14  |
| Activation: pg_cron + pg_net, both jobs active, trigger → pg_net → Edge Function → database runs on its own                            | 9/9    |
| Service worker registers and activates in a production build; secure context; `PushManager` present                                    | yes    |

**Not proven yet:** delivery to a real phone. The first real deliveries will happen in the pilot below.

## Safety properties members can rely on

- **Recipient only.** A push is queued only for the devices of the notification's own `user_id`. A
  device belongs to exactly one account; if a second account registers the same browser, the device moves to
  that account. Sign-out cancels the browser subscription.
- **Explicit opt-in, twice.** The member must be enrolled (pilot list, server-side) **and** tap "Turn on
  notifications on this device" **and** accept the browser's permission prompt. Nothing is enabled for anyone
  automatically.
- **No backlog blast.** Only notifications created after a device registers are pushed. Anything older than 24
  hours, or already read, is skipped.
- **Lock-screen safe.** Push text is generic per category ("New message"): never names, message text, addresses
  or amounts.
- **Fails closed.** If `PUSH_ENROLLMENT` and `PUSH_PILOT_USER_IDS` are both unset, nobody can register.
  Without the function secret or VAPID keys, the Edge Function refuses to run.

## Production checklist, in order (each step needs approval; check the project ref every time)

### 0. Before touching the database

1. **Back up** the `notifications` table, structure and data. The free plan has no automatic backups.
2. **Read-only pre-check on production.** Run the staging pre-check and grants-check scripts against production,
   adapted to that project. Confirm:
   - the current `notifications` policies and grants, and that `PUBLIC` has no grant
   - the writer functions are SECURITY DEFINER
   - no `push_*` objects exist yet
   - **no duplicate `(user_id, data->>'event_key')` rows exist**, or the unique index in `web-push` cannot be
     created and the migration rolls back. Query:
     `select user_id, data->>'event_key' k, count(*) from public.notifications where data ? 'event_key' group by 1,2 having count(*) > 1;`
3. **Dependencies from the previous phase** (production state to confirm, not assume):
   - Has `supabase-migration-booking-verification.sql` (the `event_key` index) been applied to production?
     `web-push` creates the index if it is missing.
   - Has the other developer's `supabase-migration-chat-message-notifications.sql` been applied? Push works
     either way; without it, chat messages simply create no notification.
   - **Payments owner:** `src/app/api/payments/verify/route.ts` writes the cook's "Payment Received"
     notification with the buyer's session. That write already fails today and keeps failing after the
     lockdown. Fix: use the service-role client plus `event_key payment:<booking_id>` (see
     `NOTIFICATIONS-COORDINATION.md`).
   - The production signup trigger and privacy items from the staging phase are independent of push.

### 1. Database

| Order | File                                                    | SHA-256                                                            | Notes                                                                                                                              |
| ----- | ------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `supabase-migration-notifications-write-lockdown.sql`   | `863d810c15bb4fefac7b8dd299d5917730ea0942066f6ca68ff93eddf695ff82` | self-verifying; aborts if any browser write path remains                                                                           |
| 2     | `supabase-migration-web-push.sql`                       | `c3a936471a4b65f98c234609e8fe297e79cc1313e4bde531bbdbac7f5f49848f` | current version, already includes the helper revokes (staging received the same end state via the separate helper-privileges file) |
| —     | `supabase-migration-web-push-helper-privileges.sql`     | `448d02c2…4ebf`                                                    | **not needed** on production (harmless if run)                                                                                     |
| 3     | `supabase-migration-web-push-activation.sql`            | `e4068c3987c7f9761a3cce3748898ad0a4a10e9b1614b01f95073e66bc5eb408` | only after step 2 below; needs the two Vault secrets                                                                               |
| later | `supabase-migration-match-notification-idempotency.sql` | `f76983ae…1b34`                                                    | needs the matching owner's OK                                                                                                      |

After steps 1 and 2, rerun the real-service suite against production **with two consenting pilot
accounts, never real customers' accounts**, or re-run the read-only checks only.

### 2. Credentials and Edge Function

1. Generate a **new production** VAPID pair, outside the repo:
   `node scripts/generate-vapid-keys.mjs <owner-only-folder> production`. Never reuse the staging pair.
   Changing the pair later disconnects every subscribed device.
2. Build the function secrets file (`VAPID_KEYS_JSON`, `PUSH_DISPATCH_SECRET`,
   `VAPID_SUBJECT=mailto:contact@food4love.app`) and set it with
   `supabase secrets set --env-file <file> --project-ref <production-ref>`. Values never go into chat or shell
   history.
3. `supabase functions deploy push-dispatch --project-ref <production-ref> --no-verify-jwt`. The function
   checks its own secret.
4. Verify on production: 401 without the secret and for a near-miss; 200 and `claimed: 0` with it. Optionally
   run the no-send isolation probe with a pilot account.
5. Create the Vault secrets `food4love_push_dispatch_url` (the **production** function URL) and
   `food4love_push_dispatch_secret`, then apply the activation file (step 3 of the database table).

### 3. App (Vercel, Production environment only)

| Variable                       | Value                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | the production public key                                                     |
| `PUSH_PILOT_USER_IDS`          | the pilot testers' profile ids (comma-separated)                              |
| `PUSH_ENROLLMENT`              | leave **unset** during the pilot; set to `open` only for general availability |

- Merging this branch into `develop` deploys the code (`vercel.json` deploys `develop`). That is safe **before**
  the database steps: the push routes report "not available" and the settings show the pilot notice. The
  lockdown is SQL, so it does not apply itself.
- The service worker (`/sw.js`, cache `food4love-static-v2`) updates on members' devices automatically.
  Offline and update behaviour is unchanged.

### 4. Rollback (any time)

| What to stop              | How                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stop new registrations    | clear `PUSH_PILOT_USER_IDS` and redeploy                                                                                                         |
| Stop all delivery at once | `select cron.unschedule('food4love-push-sweep')`, then `delete from vault.secrets where name like 'food4love_push_%'` (the kick becomes a no-op) |
| Remove one tester         | delete their `push_subscriptions` rows                                                                                                           |
| Remove the function       | `supabase functions delete push-dispatch`                                                                                                        |
| Remove the push schema    | the ROLLBACK block in `supabase-migration-web-push.sql`. Notifications themselves are untouched.                                                 |
| Undo the lockdown         | the ROLLBACK block in its header. This restores the old, weaker policy, so it is a last resort only.                                             |

## Pilot with existing members (no Samsung test needed first)

1. **Pick 4 to 10 consenting testers.** Include customers and cooks, Android (Chrome or Samsung Internet) and
   iPhone (iOS 16.4+). Ask each person personally, and record their consent and their profile id.
2. Add their ids to `PUSH_PILOT_USER_IDS` in Vercel **Production** and redeploy. Nobody else can register a
   device.
3. **Tester instructions:**
   - **Android:** open Food4Love in Chrome.
   - **iPhone:** in Safari, tap Share → Add to Home Screen, then open Food4Love from the Home Screen icon.
   - Then: Settings → Push notifications → **Turn on notifications on this device** → **Allow** → **Send a
     test**. "Send a test" goes only to that tester's own devices.
4. **Real events between testers only.** For example, a tester customer and a tester cook match, message and
   book each other. Check three cases: app open, app in the background, and app closed.
5. **Watch delivery without reading anyone's content** (counts only):
   `select category, status, error_code, count(*) from notification_push_deliveries where created_at > now() - interval '1 day' group by 1,2,3;`
6. **Expected side effect:** admin announcements create a notification for every member, so they will also
   push to the pilot devices (category "Other updates", which testers can switch off). Avoid sending
   announcements during the pilot, or tell testers in advance.
7. **Exit criteria before `PUSH_ENROLLMENT=open`:**
   - a test push received on at least one Android and one iPhone
   - a message, a match and a booking push between testers
   - tapping a push opens the right page and marks the notification read
   - no `permanent` failures, and nothing stuck in `sending`
