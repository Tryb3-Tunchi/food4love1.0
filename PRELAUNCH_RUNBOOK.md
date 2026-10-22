# Food4Love prelaunch runbook

## 1. Configure staging

1. Create or select a non-production Supabase project and verify its URL and anon key.
2. Review `supabase-migration-waitlist.sql`, confirm the named tables/indexes do not conflict with staging data, then run it in the staging SQL editor. It upgrades the earlier waitlist table, enables RLS, removes anonymous table access, and grants table access only to Supabase `service_role`.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the server environment. Never expose the service-role key as a `NEXT_PUBLIC_*` variable or commit it.
4. In Resend, verify the sending domain and configure its DNS records, including SPF and DKIM. Configure DMARC for the domain before sending to real subscribers.
5. Set `RESEND_API_KEY`, `WAITLIST_FROM_EMAIL` to the verified sender, and a long random `WAITLIST_ADMIN_API_KEY`. Set `NEXT_PUBLIC_APP_URL` to the staging origin so unsubscribe links return to this deployment.

## 2. Verify the waitlist

1. Open `/` and confirm the address changes to `/waitlist`; direct `/signup` URLs should also go to `/waitlist`, while `/login` remains available.
2. Submit a new email as a food lover without marketing consent. Confirm one subscriber is stored and `updates_consent` is false.
3. Submit the same email as a cook with consent. Confirm the existing row is updated, not duplicated, its audience and consent reflect the latest choice, and `consent_at` is recorded.
4. Submit an invalid email and confirm the request is rejected. Fill the hidden website field and confirm no subscriber is created.
5. Verify unauthenticated browser clients cannot select, update, or directly insert rows into the waitlist tables.

## 3. Send and unsubscribe

Campaign delivery is an admin-only server API; keep the admin key out of browser code and logs. A campaign key is a UUID and must remain the same while continuing its paginated send. The API sends at most 25 recipients per request, skips opted-out addresses, records each delivery, and returns `nextAfterId` when another page remains.

```http
POST /api/waitlist/campaigns
Authorization: Bearer <WAITLIST_ADMIN_API_KEY>
Content-Type: application/json

{
  "campaignKey": "<one UUID reused for every page of this campaign>",
  "kind": "launch",
  "subject": "Food4Love is opening soon",
  "message": "Your launch update, coupon details, or referral URL goes here."
}
```

Repeat the request with the same content and `afterId` set to the returned `nextAfterId` until `hasMore` is false. Only users with `updates_consent = true` and no `unsubscribed_at` are eligible. Confirm test messages render correctly, land in the inbox, and include a working unsubscribe link and List-Unsubscribe headers.

Open the unsubscribe URL from a test message and confirm `updates_consent` becomes false and `unsubscribed_at` is set. Confirm a later campaign skips that address. Test the email client's one-click unsubscribe action as well as the visible link. Rejoining through the form is an explicit new preference and can restore consent.

## 4. Buyer and cook launch walkthrough

Use separate staging accounts and verify both expected behavior and database authorization at each step.

- Buyer: register, verify email, complete onboarding, discover verified cooks, change filters, pass/like, confirm a mutual match, chat, request a booking, complete a Paystack test payment, verify the server-side payment result, and submit a review where available.
- Cook: register, verify email, complete profile and photo upload, submit KYC, confirm pending cooks are not discoverable, approve KYC through the admin flow, post a special/story, receive and accept a request, chat, confirm the booking, and check status/notifications.
- Security: test as a different signed-in user and as anonymous; confirm users cannot read another user's private KYC documents, alter another profile, create unrelated matches/bookings, or read waitlist/campaign tables. Verify payment references and amounts against Paystack server responses rather than trusting client values.
- Operations: confirm storage limits/policies, payment webhook or verification behavior, account deletion/privacy retention, error reporting, and domain/Auth redirect URLs before production.

Do not use production credentials or real payments for this walkthrough. Keep public account creation closed until staging passes and production RLS/storage policies have been reviewed.
