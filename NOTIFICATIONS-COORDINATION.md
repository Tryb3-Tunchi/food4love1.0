# Notifications ↔ core features: what each workstream must coordinate

Branch: `feat/food4love-notifications-and-experience-audit`. This branch owns the delivery
infrastructure: in-app notification rules, Web Push, device subscriptions and the service worker.
The other workstream owns matching, booking, chat, dashboards and core RLS. The two branches are
built to merge independently. Push attaches to the `notifications` **table**, so every existing
producer gets push without anyone editing producer code.

## 1. Chat messages → notifications (owned by the chat developer; resolved)

- **Their trigger:** PR #40 added `supabase-migration-chat-message-notifications.sql`
  (`trg_notify_message`, one in-app notification per message). This branch **withdrew** its own
  draft trigger, so there is exactly one chat trigger.
- **Compatibility:** tested in the sandbox after the lockdown and web-push migrations, and it works
  unchanged. It is a SECURITY DEFINER function, so the lockdown doesn't affect it.
- **Push side (this branch):** `food4love_enqueue_push` pushes only the first unread message
  notification per conversation. Every message still appears in the feed, but a burst doesn't
  buzz the phone once per message, and reading the conversation re-arms the push.
- **Findings for the chat owner** (suggestions, not changed here):
  1. The trigger has no `exception when others` handler. If the notification insert ever fails, the
     **message itself is rejected**; this was reproduced in the sandbox by making the notifications
     table unavailable.
  2. There is no `event_key`. Adding `'event_key', 'message:' || new.id` would make a retried
     insert unable to double-notify.
- **Status of their migration:** not applied to staging by this branch; that stays with them.

## 2. Match notifications: idempotency (needs the matching owner's OK)

- **Prepared:** `supabase-migration-match-notification-idempotency.sql` replaces `notify_on_match()`.
  The only change is `event_key = 'match:<id>'` plus `ON CONFLICT DO NOTHING` on its two inserts.
  Recipients, text and the trigger are unchanged.
- **If you also edit `notify_on_match()`:** keep the event_key, or tell us and we drop this file.

## 3. Payment "Payment Received!" notification (payments owner; not changed here)

- **Problem:** `src/app/api/payments/verify/route.ts` inserts the cook's notification with the
  **buyer's** session client. RLS never allowed a member to write another member's row, so this
  insert fails, and the error is ignored. The wallet and Paystack webhook paths use the service-role
  client and work.
- **After `supabase-migration-notifications-write-lockdown.sql`,** members can't insert notifications
  at all, so this path stays broken until it is fixed.
- **Required fix (about 3 lines, payments owner):**
  - Use `createAdminClient()` for that insert.
  - Add `data.event_key = 'payment:<booking_id>'` there and in `payments/wallet` and
    `webhooks/paystack`, so a webhook plus a verify can't announce the same payment twice
    (`23505` = already announced).
- **Better long-term:** move all three into `notifyBookingParty()` in `src/lib/booking/server.ts`,
  which already handles event keys and email.

## 4. Things the notification branch relies on (please keep stable or tell us)

- `notifications` columns `user_id, type, title, body, data, read`, and the type values
  `match|like|message|booking|request|review|system`.
- `data.match_id`, `data.booking_id`, `data.kind`, `data.cook_id`: these drive click destinations
  (`src/lib/notificationRoutes.ts` and `supabase/functions/_shared/push-core.ts`).
- `profiles.role` (`cook` / `buyer`): used to pick the right page when a push is tapped.
- `profiles.notification_preferences` jsonb: this branch adds a `push` object inside it. Existing
  keys are untouched.
- Writers must use the service-role client or a SECURITY DEFINER function. After the lockdown,
  members can only read their own rows and flip `read`.

## 5. Files this branch touched that others might also touch

| File                                                       | Change                                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/app/providers.tsx`                                    | mounts `<PushSessionGuard />` (1 import, 1 line)                                    |
| `src/components/notifications/NotificationCenter.tsx`      | app icon badge sync (1 effect)                                                      |
| `src/components/notifications/NotificationPreferences.tsx` | renders the push section; key type narrowed                                         |
| `src/types/db.ts`                                          | optional `push` field on `NotificationPreferences`                                  |
| `public/sw.js`                                             | push / notificationclick / pushsubscriptionchange handlers; offline logic unchanged |
| `tsconfig.json`                                            | excludes the Deno entry file from the Next type-check                               |

No file under `src/app/api/bookings`, `src/lib/booking`, `src/hooks/useChat.ts`, matching, swipes or
dashboards was modified.
