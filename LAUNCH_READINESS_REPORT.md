# Food4Love Launch Readiness Audit

Audit date: 2026-10-19  
Branch: `feat/food4love-launch-readiness`

## Verified by code inspection

- The app is Next.js 14.2 App Router, TypeScript, npm (`package-lock.json`), with Node.js server output. `npm run build` and `npm start` are the production commands; static-only cPanel hosting is not established as compatible.
- Buyers and cooks are represented by `buyer` and `cook`. Signup puts name, phone, and role in Supabase user metadata. Onboarding persists `onboarding_complete` and the tour persists `tour_completed` on `profiles`. New auth users are provisioned by the proposed idempotent trigger migration, and incomplete profiles resume at setup after login.
- The active route-aware Driver.js tour is mounted in the authenticated app layout. Its selectors exist in the current route components and Profile exposes tour replay. A second legacy tour component appears unmounted; it is left in place because this audit does not establish that deleting it is safe against external references.
- Stories expire through `expires_at`; photo/video columns are represented in the story types and the video migration. Saving stories to permanent posts is protected against duplicate saves in application code and by a unique partial index on `posts.story_id` in the posts migration.
- The new story route now accepts images and videos, applies separate client-side size limits, previews the selected media, and writes the matching `image_url` or `video_url` field.
- The Discover bell now opens a modal. Notification preferences also appear in Settings and use the same `profiles.notification_preferences` field. Supported message, swipe, booking, and review preferences filter the in-app history and unread count without deleting notifications. Story notifications are not an existing notification type. These are in-app feed preferences only; no push, email, or background delivery is claimed.
- Existing SQL enables profile RLS and defines an owner-only profile update policy. The preferences migration adds only one JSONB column and does not change policies.
- Existing source includes bookings, Paystack API routes, chat/matches, requests, KYC review, and admin pages; older audit documents that describe those routes as absent are stale. Their production behavior still needs end-to-end and Supabase-backed verification.

## Issues found

- The tracked base schema does not create a profile-on-auth-user trigger. Signup records role/name metadata, but subsequent onboarding expects an existing profile. The proposed additive trigger migration creates only missing profiles and does not overwrite existing profile data. Check existing auth triggers in staging before applying it.
- The tracked base schema does not define the `notifications` table used by the app, nor preferences. Confirm the live notification table, its indexes, RLS policies, and Realtime publication. The preferences column is supplied by the new additive SQL file.
- Base schema policies do not grant client inserts to `matches` or participant inserts to `bookings`; request acceptance and booking flows may therefore fail under those policies. Do not broaden policies without staging tests and a reviewed participant/role predicate.
- The story-video SQL migration makes story reads public and permits cooks to manage their own rows. Its storage policies cover public reads and owner-folder inserts but not storage update/delete. Verify bucket visibility, MIME/size limits, and policies in the actual Supabase project.
- Profile Settings previously navigated to a route that did not exist. This change adds `/settings` with shared preferences.
- The worktree contained a pre-existing modification to `.env.example`; it was preserved. That file has a credential-like populated value and must be reviewed and rotated if real before publication. Its value is intentionally not reproduced here.
- No test files or test script are defined. No files, dependencies, or assets were removed: the existing tree and dynamic/reference usage did not establish a safe deletion.

## Supabase SQL

Two additive SQL files are proposed. `supabase-migration-auth-profile-trigger.sql` creates missing profile rows on auth registration, preserving any existing profile and limiting role values to the app's `cook` or `buyer` values. `supabase-migration-notification-preferences.sql` adds a non-null JSONB preferences column with defaults for messages, swipe activity, bookings, and reviews. Existing profile owner-update RLS remains the enforcement boundary; no new policy is created.

The repository currently has no `supabase/migrations` directory. First inspect staging for existing auth triggers, the preferences column, and the current `profiles` owner-update policy. Then apply the reviewed SQL files as executable SQL only in the staging Supabase SQL Editor, or move them into the project's approved migration workflow and apply through that workflow. Verify new signup, profile setup, and preference persistence in staging. Do not run against production until staging verification and explicit approval. Separately inspect notification-table RLS, story-media and KYC bucket configuration, and existing policies in the Supabase dashboard; this repository alone cannot prove the live project's state.

## Manual verification required

- Register and verify new buyer and cook accounts against staging, including confirmation redirect URLs and profile creation trigger behavior.
- Complete onboarding and replay/skip the tour on desktop and mobile with reduced motion enabled.
- Upload supported image and video formats; verify rejection limits, public playback, 24-hour visibility, expiry, and saving a story only once as a permanent post.
- Exercise notification history, Realtime updates, and each preference toggle against staging. Confirm preferences do not imply push/email delivery.
- Run buyer-to-cook request acceptance, matching, chat, booking, KYC review, and payment sandbox flows under actual staging RLS.
- Verify cPanel offers a supported Node.js application runtime (minimum Next.js requirement: Node.js 18.17), supports the `npm run build` / `npm start` workflow, and provides persistent server execution. Ask the provider for Node version, startup/port configuration, process management, filesystem/build constraints, and reverse-proxy details.
- Configure domain DNS and HTTPS using values supplied by the registrar/hosting provider; set Supabase Auth Site URL to `https://food4love.app` and allow the exact production and staging callback/redirect URLs.
- Required environment variable names found in source or project configuration: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `GOOGLE_GENERATIVE_AI_API_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, and `PAYSTACK_SECRET_KEY`. `SUPABASE_SERVICE_ROLE_KEY` is documented in setup examples; verify whether deployment code actually requires it and keep it server-only. Never use the service-role key in browser code.

## Priority after launch

1. Complete staging and real-device buyer/cook journey tests, including Supabase RLS and storage policy review.
2. Add automated coverage for auth/onboarding, media uploads, preferences, requests, matching, bookings, and payment verification; add CI checks and error monitoring.
3. Review security/privacy: auth profile provisioning trigger, admin authorization enforcement, RLS coverage for every table, KYC private-file access, rate limits, account deletion, privacy policy, and retention of sensitive identity media.
4. Improve operational details: image/media size enforcement at storage, abandoned upload cleanup, observability, map performance, and additional responsive/accessibility testing.
5. Explore optional Lagos discovery game only after launch: let users reach it at the daily swipe limit; show nearby real venues with clear labels separating real place data from simulated play; allow consent-based location access and manual location selection; simulate walking in, browsing a menu, ordering, eating, or takeaway without real orders, charges, bookings, or payments. Keep it isolated from matching, swipes, payments, bookings, and ordering. Before implementation, assess map/place licensing, provider costs, location privacy, and performance.

## Cleanup candidates

- `src/components/onboarding/OnboardingTour.tsx` may be removable: the authenticated layout mounts `src/components/tour/AppTour.tsx`, and current source search found no import of the older component. It is not deleted pending a complete external/dynamic reference and build check.
- `zipFile.zip`, `tsconfig.tsbuildinfo`, and `temp-seed.sql` are root artifacts, but their ownership/purpose is not sufficiently established to delete them in this pass.
- No dependency or asset is declared safe to remove from the evidence gathered.
