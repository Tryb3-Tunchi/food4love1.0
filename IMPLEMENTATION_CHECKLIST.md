# Food4Love — Implementation Checklist & Roadmap
**Status:** Ready for structured sprints | **Last updated:** 2026-07-07

---

## HOW TO USE THIS DOCUMENT

1. Each **Milestone** groups related work into a single PR.
2. Within each milestone, tasks are ordered by dependency.
3. Mark task status as: `[ ]` (pending) → `[→]` (in-progress) → `[✓]` (done).
4. Link to PR when task is started.
5. Aim for one PR per milestone (typically 3-5 days of work).

---

## 🚨 MILESTONE 0: CRITICAL LAUNCH BLOCKERS
**Goal:** Make the app launchable (no broken pages, no mock data in prod).  
**Estimated Time:** 5 days  
**Status:** Not started

### Phase 0.1 — Fix Broken Pages & Remove Mock Data
- [ ] Remove MOCK_CHEFS, MOCK_CONVERSATIONS from chat index page. Replace with real Supabase query.
- [ ] Remove mock data from chat detail page (`[matchId]/page.tsx`). Wire Supabase `messages` table.
- [ ] Fix import errors on chat pages (MOCK_CHEFS reference).
- [ ] Implement `(app)/requests/page.tsx` for cooks to see incoming match requests.
- [ ] Implement `(app)/likes/page.tsx` for cooks to see who liked them.
- [ ] Remove `_old_vite_pages/` and `_old_vite_providers/` folders.
- [ ] Clean up all commented-out imports and debug logs.

**PR Title:** `fix: remove mock data and implement missing app pages`

### Phase 0.2 — Fix Type Safety & Input Validation
- [ ] Add `as any` removals in `onboarding/kyc/page.tsx`. Use proper type unions.
- [ ] Add Zod validation to all API route handlers (`/api/ai/*` routes).
- [ ] Add null checks before accessing `profile` in all pages (use optional chaining).
- [ ] Generate Supabase types via `supabase gen types typescript` and commit.

**PR Title:** `refactor: strict types and input validation`

### Phase 0.3 — Implement Booking Flow
- [ ] Create `src/components/booking/BookingForm.tsx` component (meal selection, delivery time, special requests).
- [ ] Add booking UI to chat header (replace mock CTA).
- [ ] Create `/app/(app)/bookings/new` route for standalone booking form.
- [ ] Implement `createBooking()` service call.
- [ ] Add booking success confirmation screen.
- [ ] Test end-to-end: match → chat → book → confirmation.

**PR Title:** `feat: booking flow UI and integration`

### Phase 0.4 — Payment Gateway Integration
- [ ] Integrate Paystack SDK (`@paystack/inline-js` or REST API).
- [ ] Create `/api/payments/initialize` endpoint (POST with amount, reference, user email).
- [ ] Create `/api/payments/verify` endpoint (GET with reference, check Paystack).
- [ ] Add payment modal to booking form.
- [ ] On successful payment, update `bookings.status = 'confirmed'`.
- [ ] Add payment receipt page.
- [ ] Test sandbox mode with test cards.

**PR Title:** `feat: Paystack payment integration`

### Phase 0.5 — Admin KYC Approval UI
- [ ] Create `/admin/kyc/page.tsx` with list of pending KYC submissions.
- [ ] Add approve/reject buttons with comment input.
- [ ] Send email notification on approval (Supabase auth email or SendGrid).
- [ ] Update `kyc_status` in profiles table on action.
- [ ] Add KYC detail modal (display ID photo, video preview, user info).
- [ ] Add analytics: approval rate, average review time.

**PR Title:** `feat: admin kyc review and approval flow`

### Phase 0.6 — Web Push Notifications
- [ ] Register service worker in `src/lib/service-worker.ts`.
- [ ] Implement `requestNotificationPermission()` utility.
- [ ] Create `/api/notifications/subscribe` endpoint (store push subscription in DB).
- [ ] Create `/api/notifications/send` endpoint (send to subscribed users).
- [ ] Trigger notifications on: match created, new message, booking confirmed.
- [ ] Add "disable notifications" setting in user profile.
- [ ] Test on mobile browsers (Chrome, Firefox).

**PR Title:** `feat: web push notifications`

### Phase 0.7 — Fix Responsive Layout
- [ ] Add tablet breakpoint styles to `Shell.tsx` (hamburger nav, adjusted sidebar).
- [ ] Add `@supports (padding: max(0px)) { padding-bottom: max(...) }` for safe-area on bottom nav.
- [ ] Fix profile hero cover image scaling for small phones.
- [ ] Fix map re-render on orientation change (resize observer).
- [ ] Test responsive behavior at 375px, 768px, 1024px, 1440px widths.

**PR Title:** `fix: responsive design and layout issues`

### Phase 0.8 — Error Boundaries & Fallback UI
- [ ] Create `src/components/ErrorBoundary.tsx` (React Error Boundary component).
- [ ] Wrap `<Providers>` in error boundary.
- [ ] Create fallback error page with "Go home" button.
- [ ] Add error logging (e.g., Sentry stub).
- [ ] Add try-catch around all async operations in pages.

**PR Title:** `fix: error boundaries and crash recovery`

**Completion Criteria:**
- ✓ App has no hardcoded mock data in production routes
- ✓ All type warnings gone (`npm run lint`)
- ✓ Full booking → payment flow works
- ✓ Admin can approve/reject KYC
- ✓ Users get push notifications on match/message
- ✓ App responsive on all screen sizes
- ✓ No white-screen crashes

---

## 📊 MILESTONE 1: ADMIN & OPERATIONS
**Goal:** Admin can monitor, moderate, and support the platform.  
**Estimated Time:** 3 days  
**Status:** Not started  
**Depends on:** Milestone 0

### Phase 1.1 — Admin User Management
- [ ] Create `/admin/users/page.tsx` with sortable, filterable table (role, verified status, created date).
- [ ] Add delete user action (soft delete, set `is_deleted = true`).
- [ ] Add ban/suspend user action (set `is_active = false`).
- [ ] Add search box (name, email, phone).
- [ ] Add bulk actions (select multiple, ban all).
- [ ] Export users to CSV.

**PR Title:** `feat: admin user management panel`

### Phase 1.2 — Admin Disputes & Moderation
- [ ] Create `/admin/disputes/page.tsx` (list unresolved disputes).
- [ ] Create `/admin/disputes/[id]/page.tsx` (detail view with evidence, chat history).
- [ ] Add resolve actions: refund buyer, pay chef, dismiss dispute.
- [ ] Add notes/comments for audit trail.
- [ ] Send email to both parties with resolution.

**PR Title:** `feat: admin dispute resolution`

### Phase 1.3 — Admin Analytics Dashboard
- [ ] Add real metrics to `/admin/page.tsx` (currently mocked).
- [ ] Query: total weekly matches, match-to-chat rate, chat-to-booking rate.
- [ ] Query: top 10 chefs by booking volume, ratings, reviews.
- [ ] Query: weekly revenue, average order value, transaction count.
- [ ] Add simple charts (using Chart.js or Recharts).
- [ ] Add date range picker (last 7, 30, 90 days).

**PR Title:** `feat: admin analytics dashboard`

### Phase 1.4 — Admin Audit Logs
- [ ] Create audit log table in Supabase: `{id, admin_id, action, resource_type, resource_id, timestamp, changes}`.
- [ ] Log all admin actions: approve KYC, ban user, resolve dispute, delete content.
- [ ] Create `/admin/logs/page.tsx` to view audit trail.
- [ ] Filter by admin, action type, resource type, date range.

**PR Title:** `feat: audit logging and compliance`

**Completion Criteria:**
- ✓ Admin can view, search, ban users
- ✓ Admin can resolve disputes with evidence
- ✓ Admin can see key metrics & trends
- ✓ All admin actions logged

---

## 🔐 MILESTONE 2: USER FEATURES & SOCIAL
**Goal:** Core user features beyond swipe-match-chat.  
**Estimated Time:** 4 days  
**Status:** Not started  
**Depends on:** Milestone 0

### Phase 2.1 — Daily Specials Management (Chef)
- [ ] Create `/cook/specials/page.tsx` (chef-only route).
- [ ] UI: create daily special form (title, description, price, photo, available until time).
- [ ] Upload special image to Supabase storage (`daily-specials/`).
- [ ] List chef's active & expired specials.
- [ ] Edit/delete specials.
- [ ] Auto-expire specials at set time (cron job or Next.js API route).

**PR Title:** `feat: daily specials management for chefs`

### Phase 2.2 — Reviews & Ratings
- [ ] Create `/bookings/[id]/review` route (accessible after booking confirmed).
- [ ] Review form: rating (1-5 stars), comment, photo upload.
- [ ] Store review in `reviews` table.
- [ ] Display reviews on chef profile (public & private).
- [ ] Auto-calculate chef rating (average of all reviews).
- [ ] Add review moderation (admin can hide/delete).
- [ ] Prevent duplicate reviews (one per booking).

**PR Title:** `feat: reviews and chef ratings`

### Phase 2.3 — Stories Feature (Chef)
- [ ] Create `/cook/stories/page.tsx` (chef-only).
- [ ] Upload story image (1MB compression).
- [ ] Set expiry (24h default).
- [ ] Display stories strip on swipe/map pages (chef stories).
- [ ] Auto-delete expired stories (daily cron or delete on-read).
- [ ] Track view count per story.

**PR Title:** `feat: chef stories and expiring content`

### Phase 2.4 — Messaging Enhancements
- [ ] Implement read receipts (message `read_at` timestamp).
- [ ] Add typing indicators (Supabase Realtime presence).
- [ ] Add emoji reactions to messages.
- [ ] Add message search in chat (full-text search on Supabase).
- [ ] Add block user feature (prevent messaging).
- [ ] Add pin/star important messages.

**PR Title:** `feat: enhanced messaging UX`

### Phase 2.5 — Buyer Preferences & Saved Chefs
- [ ] Add "save chef" button (hearts/wishlist).
- [ ] Create `/saved-chefs` route (buyer-only).
- [ ] Save filter preferences (cuisines, price range, distance).
- [ ] Auto-apply saved filters on swipe page.
- [ ] Notify buyer when saved chef posts daily special.

**PR Title:** `feat: saved chefs and preferences`

**Completion Criteria:**
- ✓ Chefs can create daily specials visible in chat & swipe
- ✓ Buyers can leave reviews after meals
- ✓ Chefs can upload expiring stories
- ✓ Messages have read receipts & typing indicators
- ✓ Buyers can save favorite chefs

---

## 🎨 MILESTONE 3: DESIGN SYSTEM & ACCESSIBILITY
**Goal:** Professional, accessible UI with consistent design language.  
**Estimated Time:** 4 days  
**Status:** Not started  
**Depends on:** Milestone 0

### Phase 3.1 — CSS Variable Standardization
- [ ] Document all CSS variables in `src/styles/variables.css`.
- [ ] Export theme from `tokens.ts`: colors, spacing, typography, shadows.
- [ ] Replace all `var(--bg)` with semantic tokens (e.g., `var(--bg-primary)`).
- [ ] Create theme switcher: dark (default), light, hunger mode.
- [ ] Apply dark/light theme via CSS cascade (no inline class toggling).

**PR Title:** `refactor: centralized design system and themes`

### Phase 3.2 — Component Library Audit
- [ ] Audit all UI components in `src/components/ui/`.
- [ ] Standardize on CVA for all variants (Button, Input, Badge, Card).
- [ ] Document component props & variants in Storybook (optional).
- [ ] Create `src/components/ui/EmptyState.tsx` (reuse across pages).
- [ ] Rename duplicate components (e.g., `Sheet` vs `Modal`).

**PR Title:** `refactor: ui component standardization`

### Phase 3.3 — Accessibility Fixes (WCAG AA)
- [ ] Add `aria-label`, `aria-describedby` to all icon buttons.
- [ ] Fix heading hierarchy (h1 → h2 → h3, no gaps).
- [ ] Add focus styles to all interactive elements.
- [ ] Test color contrast with WAVE or Axe DevTools (target AA standard).
- [ ] Add `skip-to-main` link.
- [ ] Implement focus trapping in modals.
- [ ] Add `lang="en"` to `<html>` tag.
- [ ] Test with screen reader (NVDA or JAWS).

**PR Title:** `a11y: wcag aa compliance and accessibility audit`

### Phase 3.4 — Motion & Responsiveness
- [ ] Add `prefers-reduced-motion` media query support.
- [ ] Remove unnecessary Framer Motion animations (keep only delightful ones).
- [ ] Fix chat input max-height (prevent overflow on mobile).
- [ ] Handle keyboard height on iOS (adjust input position).
- [ ] Test on iOS Safari, Chrome Android at various viewport sizes.

**PR Title:** `fix: motion preferences and mobile input handling`

**Completion Criteria:**
- ✓ Single source of truth for colors, spacing, typography
- ✓ All components use CVA pattern
- ✓ WCAG AA contrast & ARIA labels passing
- ✓ No unnecessary animations; respects `prefers-reduced-motion`
- ✓ Mobile inputs work with keyboard open

---

## 📱 MILESTONE 4: PERFORMANCE & OPTIMIZATION
**Goal:** Sub-3s load time, smooth 60fps interactions.  
**Estimated Time:** 3 days  
**Status:** Not started  
**Depends on:** Milestone 0

### Phase 4.1 — Image Optimization
- [ ] Implement Next.js `<Image>` component for all photos (auto-resize, format selection, lazy load).
- [ ] Add placeholder blur data URIs.
- [ ] Compress profile photos on upload (max 500KB).
- [ ] Serve WebP with JPEG fallback.
- [ ] Test with Lighthouse, aim for 90+ score.

**PR Title:** `perf: image optimization with next/image`

### Phase 4.2 — Data Fetching & Pagination
- [ ] Paginate swipe deck (fetch 10 at a time, load next batch on scroll near end).
- [ ] Paginate admin lists (users, disputes, logs) — 20 items per page.
- [ ] Paginate chat message history (last 50, load older on scroll).
- [ ] Add React Query cache invalidation on mutations (bookings, reviews, etc.).
- [ ] Implement infinite scroll (Intersection Observer) for chefs list.

**PR Title:** `perf: pagination and infinite scroll`

### Phase 4.3 — Code Splitting & Bundle Optimization
- [ ] Code-split by route (`dynamic()` for heavy components like Map, Admin).
- [ ] Lazy-load animations library (Framer Motion) only on swipe/match pages.
- [ ] Remove unused dependencies (audit `package.json`).
- [ ] Build and analyze bundle with `webpack-bundle-analyzer`.
- [ ] Target <200KB gzipped JS.

**PR Title:** `perf: route-based code splitting`

### Phase 4.4 — Realtime Optimization
- [ ] Implement unsubscribe cleanup in all Supabase Realtime hooks.
- [ ] Add debouncing to typing indicators (don't send on every keystroke).
- [ ] Batch message updates (buffer 100ms before re-rendering).
- [ ] Memory profiling: check for leaks on long chat sessions.

**PR Title:** `perf: realtime subscriptions and memory leaks`

**Completion Criteria:**
- ✓ Lighthouse score 85+ (Performance, Accessibility, Best Practices)
- ✓ Swipe deck paginated, doesn't load 100 profiles at once
- ✓ Admin lists paginated
- ✓ All Realtime subscriptions cleaned up on unmount
- ✓ Bundle size < 200KB gzipped

---

## 🚀 MILESTONE 5: POLISH & LAUNCH PREP
**Goal:** Ready for public launch & marketing.  
**Estimated Time:** 2 days  
**Status:** Not started  
**Depends on:** Milestones 0–4

### Phase 5.1 — Launch Checklists
- [ ] Create seed data script for demo chefs (already in admin page, refactor into seed file).
- [ ] Document runbook for first-time deploys (env setup, Supabase migrations).
- [ ] Test deployment to Vercel (staging & prod).
- [ ] Set up custom domain, SSL cert, DNS.
- [ ] Add status page URL to footer.
- [ ] Create README for developers (setup, architecture, testing).

**PR Title:** `docs: launch documentation and deployment guides`

### Phase 5.2 — Monitoring & Observability
- [ ] Integrate Sentry for error tracking (free tier).
- [ ] Add basic analytics (Vercel Analytics or Plausible).
- [ ] Set up Supabase realtime query logging.
- [ ] Create health check endpoint `/api/health`.
- [ ] Add uptime monitoring (Uptimerobot or similar).

**PR Title:** `ops: error tracking and analytics`

### Phase 5.3 — Security & Compliance
- [ ] Enable Supabase Row-Level Security (RLS) on all tables (currently missing on critical ones).
- [ ] Audit RLS policies: profiles, swipes, matches, messages.
- [ ] Add rate limiting to API endpoints (Vercel Skew or Node.js `express-rate-limit`).
- [ ] CSRF protection (Next.js handles by default, verify).
- [ ] Review OWASP top 10 (SQL injection, XSS, CSRF, etc.).
- [ ] Privacy policy & terms of service (legal review).

**PR Title:** `security: rls policies and rate limiting`

### Phase 5.4 — Content & Marketing
- [ ] Update landing page with launch copy & social proof.
- [ ] Create onboarding tour copy (Driver.js already integrated, update step text).
- [ ] Add demo video links (sample matches, chat, bookings).
- [ ] Create FAQ page.
- [ ] Set up email templates (welcome, reset password, order confirmation).

**PR Title:** `content: landing page and marketing copy`

### Phase 5.5 — QA & Final Testing
- [ ] Full user journey test (sign up → onboarding → swipe → match → chat → book → pay → review).
- [ ] Test on actual devices: iPhone 12/14/15, Samsung Galaxy S20+, iPad.
- [ ] Cross-browser: Safari, Chrome, Firefox, Edge.
- [ ] Load testing: simulate 100 concurrent users swiping.
- [ ] Regression testing of all P0 features.

**PR Title:** `test: full user journey and device testing`

**Completion Criteria:**
- ✓ All launch blockers fixed
- ✓ Admin can seed demo data
- ✓ Errors tracked in Sentry
- ✓ Analytics set up
- ✓ RLS policies enforced
- ✓ Rate limiting active
- ✓ Full QA pass on iOS, Android, desktop

---

## 🔮 MILESTONE 6+: POST-LAUNCH FEATURES (P2/P3)
**Goal:** User growth & engagement features post-MVP.  
**Estimated Time:** 2+ weeks  
**Status:** Backlog  
**Dependencies:** All prior milestones done

### Future Sprints (Not Yet Started)
- **Public Chef Profiles:** Implement `/cook/[id]/page.tsx` with SEO, Open Graph meta tags.
- **Referral System:** Invite friends, earn rewards, track referral chain.
- **Superlike Feature:** UI button, premium indicator, increased match rate.
- **Video Profiles:** Allow chefs to upload 15s intro video.
- **Subscription Plans:** Tier-based access (free swiper, pro chef, admin).
- **Multi-City Support:** Add city selection, region filtering.
- **Push Notification Campaigns:** Marketing emails & in-app promos.
- **ML-Powered Matching:** Rank swipe deck by taste profile compatibility.
- **Chef Certification Program:** Training modules, badges.

---

## 📋 QUICK REFERENCE: TASK TEMPLATES

### When Starting a New Task
```
- [ ] Task description
  - Sub-task A
  - Sub-task B
  - Sub-task C (testing)
```

### Before Marking Task Complete
- ✓ Code written & tested locally
- ✓ PR created with clear description
- ✓ Code review completed
- ✓ Tests passing
- ✓ Merged to develop

### PR Naming Convention
```
feat: user-facing feature description
fix: bug fix description
refactor: code quality or performance improvement
docs: documentation updates
chore: build, dependencies, config changes
perf: performance optimization
a11y: accessibility improvements
test: test coverage additions
ops: deployment, monitoring, infrastructure
```

---

## 🎯 SUCCESS METRICS

After each milestone, measure:

| Metric | Target | Check With |
|--------|--------|-----------|
| Build Success | 100% | `npm run build` with no errors |
| Lighthouse Score | 85+ | Chrome DevTools Lighthouse |
| Test Coverage | 60%+ | `npm test -- --coverage` |
| Type Errors | 0 | `npm run lint` |
| ESLint Warnings | 0 | Next.js lint |
| Broken Links | 0 | Broken Link Checker |
| Accessibility | WCAG AA | axe DevTools, WAVE |
| Performance | < 3s FCP | Lighthouse, WebPageTest |
| Security | No vulns | npm audit, OWASP checklist |

---

**Document maintained by:** Engineering Team  
**Last reviewed:** 2026-07-07  
**Next review:** After Milestone 0 completion
