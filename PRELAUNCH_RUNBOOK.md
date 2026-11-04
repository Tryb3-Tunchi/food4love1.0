# Food4Love prelaunch runbook

## 1. Configure staging

1. Create or select a non-production Supabase project and verify its URL and anon key.
2. Review and run `supabase-migration-waitlist.sql` in staging if it has not already been applied. Then review and run `supabase-migration-email-communications.sql`. The new migration adds account email consent, waitlist confirmation status, and private tables for audited admin announcements and unsubscribe tokens. It does not grant browser roles access to those tables.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the server environment. Never expose the service-role key as a `NEXT_PUBLIC_*` variable or commit it.
4. In Resend, verify the sending domain and configure its DNS records, including SPF and DKIM. Configure DMARC for the domain before sending to real subscribers.
5. Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `WAITLIST_CONFIRMATION_FROM_EMAIL`, `WAITLIST_FROM_EMAIL`, `ACCOUNT_UPDATES_FROM_EMAIL`, and `NEXT_PUBLIC_APP_URL` in the server environment. The sender addresses must use a verified Resend domain. The admin campaign interface uses the signed-in admin session and the `messages:manage` permission; it does not need a `WAITLIST_ADMIN_API_KEY`.
6. For signup verification, configure Supabase Auth custom SMTP with Resend. Use host `smtp.resend.com`, port `465`, username `resend`, and a Resend API key as the password. Set the sender to a verified Food4Love address such as `Food4Love <auth@food4love.app>`. In Supabase Auth > Email Templates > Confirm signup, set the subject to `Welcome to Food4Love — confirm your email` and paste `email-templates/signup-confirmation.html`. Ensure the production and localhost origins are allowed as Auth redirect URLs for `/auth/callback`.

## 2. Verify the waitlist

1. Open `/` and confirm the address changes to `/waitlist`; direct `/signup` URLs should also go to `/waitlist`, while `/login` remains available.
2. Submit a new email as a food lover without marketing consent. Confirm one subscriber is stored and `updates_consent` is false.
3. Confirm a new waitlist row gets a confirmation email even when marketing consent is unchecked. The message confirms the signup but does not subscribe the person to marketing updates.
4. Submit the same email as a cook with consent. Confirm the existing row is updated, not duplicated, its audience and consent reflect the latest choice, and `consent_at` is recorded.
5. Submit an invalid email and confirm the request is rejected. Fill the hidden website field and confirm no subscriber is created.
6. Create one account with email-update opt-in off and another with it on. Confirm the trigger stores the matching consent; both accounts receive only the signup confirmation email.
7. In Settings, enable and disable email updates. Confirm the preference and consent timestamp update for the signed-in account only.
8. Verify unauthenticated browser clients cannot select, update, or directly insert rows into the waitlist and announcement tables.

## 3. Send and unsubscribe

Use Admin > Announcements & email. App-member email is sent only to accounts that explicitly opted in and have confirmed email addresses. In-app announcements go to all active buyer and cook accounts, including members who have not opted into email. Waitlist campaigns go only to subscribers with `updates_consent = true` and no `unsubscribed_at`. The UI sends in batches, records each delivery, and does not expose recipient addresses to the browser. Confirm an admin without `messages:manage` receives a 403 and cannot load or send campaigns.

For the account signup email, the Supabase confirmation email acts as the branded welcome and verification email. Do not send a second welcome to unconfirmed addresses. Account marketing consent is separate and defaults off; users can change it in Settings. Announcement emails include unsubscribe links and one-click unsubscribe headers. Test SMTP and Resend delivery with test accounts before a production campaign.

Open the unsubscribe URL from a waitlist message and confirm `updates_consent` becomes false and `unsubscribed_at` is set. Open an account announcement unsubscribe link and confirm `profiles.email_updates_consent` becomes false. Confirm later campaigns skip both addresses. Test the email client's one-click unsubscribe action as well as the visible link. Rejoining the waitlist or enabling email updates in Settings records a new explicit preference.

## 4. Buyer and cook launch walkthrough

Use separate staging accounts and verify both expected behavior and database authorization at each step.

- Buyer: register, verify email, complete onboarding, discover verified cooks, change filters, pass/like, confirm a mutual match, chat, request a booking, complete a Paystack test payment, verify the server-side payment result, and submit a review where available.
- Cook: register, verify email, complete profile and photo upload, submit KYC, confirm pending cooks are not discoverable, approve KYC through the admin flow, post a special/story, receive and accept a request, chat, confirm the booking, and check status/notifications.
- Security: test as a different signed-in user and as anonymous; confirm users cannot read another user's private KYC documents, alter another profile, create unrelated matches/bookings, or read waitlist/campaign tables. Verify payment references and amounts against Paystack server responses rather than trusting client values.
- Operations: confirm storage limits/policies, payment webhook or verification behavior, account deletion/privacy retention, error reporting, and domain/Auth redirect URLs before production.

Do not use production credentials or real payments for this walkthrough. Keep public account creation closed until staging passes and production RLS/storage policies have been reviewed.
