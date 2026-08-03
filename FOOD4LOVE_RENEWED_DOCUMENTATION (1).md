# FOOD4LOVE — RENEWED PROJECT DOCUMENTATION
## Version 2.0 | Status: MVP Core Complete — Booking & Payments Missing
## Last Updated: 2026-08-01

---

## 1. WHAT'S ACTUALLY BUILT (Verified)

### ✅ P0 — Core Discovery & Matching (COMPLETE)
| Feature | Status | Notes |
|---------|--------|-------|
| Auth (email/password + OTP) | ✅ Live | Supabase Auth, middleware protected routes |
| Role selection (Cook / Buyer) | ✅ Live | Onboarding flow at `/onboarding/role` |
| Profile setup | ✅ Live | Bio, photos, cuisines, pricing, location |
| KYC verification page | ✅ Live | `/onboarding/kyc` — form submits to `kyc_submissions` table |
| Swipe deck | ✅ Live | Real Supabase data via `useSwipeDeck`, drag physics with `@use-gesture/react` + Framer Motion |
| Like / Pass / Superlike (backend) | ✅ Live | `swipes` table records actions; superlike action supported in schema |
| Mutual match detection | ✅ Live | `checkMutualLike()` → `createMatch()` triggers match celebration |
| 24h match expiry | ✅ Live | Visible on `/matches` page with countdown + "Act fast" badge |
| Real-time chat | ✅ Live | Supabase Realtime on `messages` table |
| Match celebration overlay | ✅ Live | Framer Motion animation with confetti-style overlay |
| Bottom nav (mobile) | ✅ Live | 5-tab navigation |
| Sidebar nav (desktop) | ✅ Live | Collapsible sidebar |
| Dark mode | ✅ Live | `next-themes` with warm dark palette |
| Landing page | ✅ Live | Marketing page at `/` |
| First-user tour | ✅ Live | Driver.js integrated |
| Cook public profile | ✅ Live | Route exists at `/cook/[id]` |
| Daily specials (display) | ✅ Live | Schema + display on chef cards |
| Stories strip (display) | ✅ Live | Schema + UI strip on swipe/map pages |
| Streak system | ✅ Live | Shows fire emoji + count on swipe page header |
| AI chat suggestions | ✅ Live | `/api/ai/chat-suggestions` — Gemini Flash |
| AI bio generator | ✅ Live | `/api/ai/bio` — Gemini Flash |
| AI taste profile | ✅ Live | `/api/ai/taste-profile` |
| AI smart match | ✅ Live | `/api/ai/smart-match` |
| AI dispute analysis | ✅ Live | `/api/ai/dispute-analysis` |
| Admin dashboard skeleton | ✅ Live | Stats cards, seed button, quick links |
| Chat index page | ✅ Live | **REAL DATA** — queries `matches` with `other_user` and `last_message` |
| Matches list page | ✅ Live | **REAL DATA** — expiry logic, unread badges |
| Map view | ✅ Live | Leaflet + OpenStreetMap integration |
| Profile page | ✅ Live | Self-profile view and edit |
| Filter system | ✅ Live | Cuisine, price max, distance filters on swipe deck |
| Seed demo data | ✅ Live | Admin page button creates 4 realistic chef accounts |

### ⚠️ P0 — Critical Gaps (BLOCKING LAUNCH)
| Feature | Status | Notes |
|---------|--------|-------|
| Booking flow UI | ❌ Missing | `bookings.ts` service exists. No form. Chat CTA is a mock button. |
| Payment gateway | ❌ Missing | `@paystack/inline-js` in `package.json` but zero integration code. |
| Push notifications | ❌ Missing | No service worker, no Web Push API implementation. |
| Admin KYC approval UI | ❌ Skeleton | `/admin/kyc` linked from dashboard but page is likely empty or broken. |
| Admin disputes page | ❌ Skeleton | `/admin/disputes` linked but no real implementation. |
| Admin users page | ❌ Skeleton | `/admin/users` linked but no real implementation. |
| Admin bookings page | ❌ Skeleton | `/admin/bookings` linked but no real implementation. |
| Cook requests page | ❌ Missing | `/requests` route doesn't exist. Cooks can't see who liked them. |
| Buyer likes page | ❌ Missing | `/likes` route doesn't exist. Buyers can't see their outgoing likes. |
| Review system | ❌ Missing | Schema exists. No UI to submit or display reviews post-booking. |
| Error boundaries | ❌ Missing | App will white-screen on unhandled errors. |

### 📋 P1 — Next Sprint Features
| Feature | Status | Notes |
|---------|--------|-------|
| Superlike UI button | ❌ Missing | Backend supports it. No frontend button. |
| Chef stories upload | ❌ Missing | Display exists. No upload flow. |
| Daily specials creation | ❌ Missing | Display exists. No chef CRUD. |
| Photo upload compression | ⚠️ Partial | `browser-image-compression` in deps. Verify it's wired. |
| Referral system | ❌ Not started | Listed in PRD, no code. |
| Public chef profile SEO | ⚠️ Partial | Route exists. Need Open Graph meta tags. |
| Read receipts | ❌ Missing | `read_at` column exists. No UI logic. |
| Typing indicators | ❌ Missing | Supabase Realtime presence not wired. |

---

## 2. WHAT NEEDS TO BE REMOVED / CLEANED

### Mock Data Cleanup
- [ ] **VERIFY** chat detail page (`/chat/[matchId]/page.tsx`) — the audit flagged mock data here
- [ ] **VERIFY** map page — audit flagged `MOCK_CHEFS` usage
- [ ] Remove any `// import { MOCK_CHEFS }` commented lines
- [ ] Remove `MOCK_CONVERSATIONS` if still present anywhere
- [ ] Delete `_old_vite_*` folders if they exist
- [ ] Remove `zipFile.zip` from repo (already committed, add to `.gitignore`)
- [ ] Remove `tsconfig.tsbuildinfo` from repo (add to `.gitignore`)

### Type Safety Cleanup
- [ ] Remove all `as any` casts (notably in `onboarding/kyc/page.tsx`)
- [ ] Generate `src/types/database.ts` from Supabase CLI
- [ ] Add Zod validation to ALL `/api/*` route handlers
- [ ] Add null checks (`?.`) before accessing `profile` in all pages

---

## 3. RENEWED MILESTONE PLAN

### 🎯 MILESTONE 0: "Money Flow" — Make It a Business (7 days)
**Theme:** Without booking + payment, this is just a chat app. Fix that first.

#### Phase 0.1 — Booking Flow (Days 1-2)
**Goal:** Buyer can book a meal from chat.
- [ ] Create `src/components/booking/BookingForm.tsx`
  - Meal selection (from chef's daily specials or free text)
  - Delivery/pickup time picker
  - Special requests textarea
  - Price display (from chef profile)
- [ ] Add "Book a Meal" CTA button to chat header (`/chat/[matchId]`)
- [ ] Create `/app/(app)/bookings/new` standalone route
- [ ] Wire `createBooking()` service (already exists in `src/services/bookings.ts`)
- [ ] Create booking success confirmation screen with booking ID
- [ ] Add "My Bookings" link to buyer nav
- [ ] **Test:** match → chat → book → confirmation

**PR:** `feat: booking flow UI and service integration`

#### Phase 0.2 — Paystack Payment (Days 3-4)
**Goal:** Money moves from buyer to platform.
- [ ] Create `/api/payments/initialize` endpoint
  - Accept: amount (in kobo), email, reference, metadata (booking_id)
  - Call Paystack initialize API
  - Return authorization_url
- [ ] Create `/api/payments/verify` endpoint
  - Accept: reference
  - Call Paystack verify API
  - On success: update `bookings.status = 'confirmed'`, create payment record
- [ ] Add Paystack inline JS modal to booking form
- [ ] Create payment receipt page `/bookings/[id]/receipt`
- [ ] Add payment status badge to booking list
- [ ] **Test:** Full flow with Paystack test cards
  - Card: 4084084084084084081, CVV: 408, Expiry: any future date

**PR:** `feat: Paystack payment integration`

#### Phase 0.3 — Admin KYC Approval (Day 5)
**Goal:** Verify chefs before they can accept bookings.
- [ ] Create `/admin/kyc/page.tsx`
  - Table of pending KYC submissions
  - Columns: name, ID type, submitted at, actions
- [ ] Create KYC detail modal
  - Display ID photo, selfie, face video
  - Approve / Reject buttons
  - Rejection reason textarea
- [ ] Wire `updateKycStatus()` in admin service
- [ ] On approval: update `profiles.kyc_status = 'verified'`
- [ ] On rejection: update `profiles.kyc_status = 'rejected'` + store reason
- [ ] Send email notification (use Supabase auth email or add SendGrid later)

**PR:** `feat: admin kyc review and approval flow`

#### Phase 0.4 — Cook Requests & Buyer Likes (Day 6)
**Goal:** Complete the match loop for cooks.
- [ ] Create `/app/(app)/requests/page.tsx`
  - List of buyers who liked the cook (status: pending match)
  - Accept → creates match, opens chat
  - Reject → records pass
- [ ] Create `/app/(app)/likes/page.tsx`
  - List of chefs the buyer liked (but no mutual match yet)
  - Option to "superlike" or cancel like
- [ ] Add "Requests" badge to cook bottom nav
- [ ] Add "Likes" to buyer profile menu

**PR:** `feat: cook requests and buyer likes pages`

#### Phase 0.5 — Error Boundaries & Cleanup (Day 7)
**Goal:** App doesn't crash in production.
- [ ] Create `src/components/ErrorBoundary.tsx`
- [ ] Wrap app shell in error boundary
- [ ] Create fallback error UI with "Go home" and "Try again"
- [ ] Add try-catch to all async page operations
- [ ] Clean all mock data references
- [ ] Run `npm run lint` and `npm run type-check` — fix all errors
- [ ] Generate Supabase types: `supabase gen types typescript`

**PR:** `fix: error boundaries, type safety, and mock data cleanup`

**Milestone 0 Exit Criteria:**
- [ ] Buyer can book a meal from chat
- [ ] Buyer can pay with Paystack (sandbox)
- [ ] Admin can approve/reject KYC submissions
- [ ] Cook can see and accept match requests
- [ ] No mock data anywhere
- [ ] `npm run build` passes with 0 errors
- [ ] `npm run lint` passes with 0 warnings

---

### 🎯 MILESTONE 1: "Trust & Social" — Make It Sticky (5 days)
**Theme:** Reviews, stories, and social features that drive retention.

#### Phase 1.1 — Reviews & Ratings (Days 1-2)
- [ ] Create `/bookings/[id]/review` route (accessible after booking confirmed)
- [ ] Review form: 1-5 star rating, comment, optional photo
- [ ] Store in `reviews` table
- [ ] Display reviews on chef public profile
- [ ] Auto-calculate `profiles.rating` and `profiles.review_count`
- [ ] Prevent duplicate reviews (one per booking)

**PR:** `feat: reviews and chef ratings`

#### Phase 1.2 — Chef Daily Specials CRUD (Day 3)
- [ ] Create `/cook/specials/page.tsx` (chef-only route)
- [ ] Form: title, description, price, photo upload, available until
- [ ] Upload to Supabase Storage `daily-specials/` bucket
- [ ] List active & expired specials
- [ ] Edit/delete specials
- [ ] Display on chef card in swipe deck

**PR:** `feat: daily specials management for chefs`

#### Phase 1.3 — Chef Stories Upload (Day 4)
- [ ] Create `/cook/stories/page.tsx`
- [ ] Upload story image (compress to 1MB max)
- [ ] Set expiry (24h default)
- [ ] Display stories strip on swipe/map pages
- [ ] Auto-delete expired stories (daily cron or on-read cleanup)

**PR:** `feat: chef stories upload and display`

#### Phase 1.4 — Messaging Polish (Day 5)
- [ ] Read receipts: update `messages.read_at` when recipient opens chat
- [ ] Typing indicators: Supabase Realtime presence channel
- [ ] Emoji reactions to messages
- [ ] Block user feature (add `blocked` to matches status)

**PR:** `feat: enhanced messaging with read receipts and typing`

---

### 🎯 MILESTONE 2: "Operations" — Admin Can Run the Platform (4 days)
**Theme:** Admin tools to manage users, disputes, and see metrics.

#### Phase 2.1 — Admin User Management (Day 1)
- [ ] `/admin/users` — sortable, filterable table
- [ ] Search by name, email, phone
- [ ] Soft delete (set `is_deleted = true`)
- [ ] Ban/suspend (set `is_active = false`)
- [ ] Bulk actions + CSV export

**PR:** `feat: admin user management panel`

#### Phase 2.2 — Admin Disputes (Day 2)
- [ ] `/admin/disputes` — list unresolved
- [ ] Detail view: evidence, chat history, AI recommendation
- [ ] Resolve actions: refund buyer, pay chef, dismiss
- [ ] Audit trail notes

**PR:** `feat: admin dispute resolution`

#### Phase 2.3 — Admin Analytics (Day 3)
- [ ] Real metrics on `/admin` dashboard (replace mocked stats)
  - Weekly matches, match→chat rate, chat→booking rate
  - Top chefs by bookings, ratings
  - Revenue, average order value
- [ ] Simple charts (Recharts)
- [ ] Date range picker

**PR:** `feat: admin analytics dashboard`

#### Phase 2.4 — Audit Logs (Day 4)
- [ ] Create `audit_logs` table
- [ ] Log all admin actions
- [ ] `/admin/logs` viewer with filters

**PR:** `feat: audit logging and compliance`

---

### 🎯 MILESTONE 3: "Performance & Polish" — Make It Professional (4 days)
**Theme:** Speed, accessibility, and design consistency.

#### Phase 3.1 — Image Optimization
- [ ] Replace all `<img>` with Next.js `<Image>`
- [ ] Compress uploads to 500KB max
- [ ] WebP with JPEG fallback
- [ ] Target Lighthouse 90+

**PR:** `perf: image optimization with next/image`

#### Phase 3.2 — Pagination & Infinite Scroll
- [ ] Swipe deck: fetch 10 at a time, load next batch
- [ ] Admin lists: 20 per page
- [ ] Chat history: last 50, load older on scroll
- [ ] React Query cache invalidation on mutations

**PR:** `perf: pagination and infinite scroll`

#### Phase 3.3 — Accessibility (WCAG AA)
- [ ] `aria-label` on all icon buttons
- [ ] Fix heading hierarchy (h1 → h2 → h3)
- [ ] Focus styles on all interactive elements
- [ ] Color contrast compliance
- [ ] Skip-to-main link
- [ ] Focus trapping in modals
- [ ] `prefers-reduced-motion` support

**PR:** `a11y: wcag aa compliance and accessibility audit`

#### Phase 3.4 — Code Quality
- [ ] Code-split heavy routes (`dynamic()`)
- [ ] Lazy-load Framer Motion on non-animation pages
- [ ] Remove unused dependencies
- [ ] Bundle analyze with `webpack-bundle-analyzer`
- [ ] Target <200KB gzipped JS
- [ ] Add pre-commit hooks (husky + lint-staged)

**PR:** `perf: route-based code splitting and bundle optimization`

---

### 🎯 MILESTONE 4: "Launch Prep" — Ready for Real Users (3 days)
**Theme:** Monitoring, security, and final QA.

#### Phase 4.1 — Security & Compliance
- [ ] Verify RLS policies active on ALL tables in Supabase dashboard
- [ ] Add rate limiting to API routes
- [ ] CSRF protection verification
- [ ] OWASP Top 10 review
- [ ] Privacy policy & ToS pages

**PR:** `security: rls policies and rate limiting`

#### Phase 4.2 — Monitoring
- [ ] Integrate Sentry (free tier)
- [ ] Vercel Analytics or Plausible
- [ ] `/api/health` endpoint
- [ ] Uptime monitoring

**PR:** `ops: error tracking and analytics`

#### Phase 4.3 — Final QA
- [ ] Full user journey test on staging
- [ ] Device testing: iPhone, Android, iPad
- [ ] Cross-browser: Safari, Chrome, Firefox
- [ ] Load test: 100 concurrent users
- [ ] Regression test all P0 features

**PR:** `test: full user journey and device testing`

---

## 4. IMMEDIATE ACTION ITEMS (Do Today)

1. **Create `.env.example`** — document all required env vars for new devs
2. **Add to `.gitignore`:**
   ```
   .env.local
   tsconfig.tsbuildinfo
   zipFile.zip
   ```
3. **Generate Supabase types:**
   ```bash
   npx supabase gen types typescript --project-id YOUR_PROJECT_ID --schema public > src/types/database.ts
   ```
4. **Set up pre-commit hooks:**
   ```bash
   npx husky-init && npm install
   # Add to .husky/pre-commit:
   npm run lint && npm run type-check
   ```
5. **Verify mock data is gone:**
   ```bash
   grep -r "MOCK_" src/ --include="*.ts" --include="*.tsx"
   # Should return nothing
   ```
6. **Verify your 4 real profiles show up in swipe deck** — test the full match → chat flow with real accounts

---

## 5. TECH STACK SUMMARY

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS v3 + custom design tokens |
| Animation | Framer Motion + React Spring + @use-gesture/react |
| State | Zustand (global) + React Query (server) |
| UI Primitives | Radix UI |
| Database | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| AI | Google Gemini 1.5 Flash (free tier) |
| Maps | Leaflet + OpenStreetMap |
| Payments | Paystack (integration pending) |
| Onboarding | Driver.js |

---

## 6. DATABASE SCHEMA (Already Implemented)

Tables: `profiles`, `daily_specials`, `stories`, `swipes`, `matches`, `messages`, `bookings`, `kyc_submissions`, `disputes`, `reviews`

RLS: Enabled on all tables. Policies defined for profiles, swipes, matches, messages, bookings, kyc_submissions, disputes.

Realtime: Enabled on `messages` and `matches`.

Storage buckets needed: `profile-photos` (public), `kyc-documents` (private), `daily-specials` (public).

---

## 7. ROUTE MAP

| Route | Status | Access |
|-------|--------|--------|
| `/` | ✅ | Public |
| `/login`, `/signup` | ✅ | Public |
| `/onboarding/role` | ✅ | Auth required |
| `/onboarding/setup` | ✅ | Auth required |
| `/onboarding/photos` | ✅ | Auth required |
| `/onboarding/kyc` | ✅ | Cook only |
| `/swipe` | ✅ | Auth required |
| `/matches` | ✅ | Auth required |
| `/chat` | ✅ | Auth required |
| `/chat/[matchId]` | ✅ | Auth required, match participant |
| `/profile` | ✅ | Auth required |
| `/map` | ✅ | Auth required |
| `/requests` | ❌ MISSING | Cook only |
| `/likes` | ❌ MISSING | Auth required |
| `/bookings/new` | ❌ MISSING | Auth required |
| `/bookings/[id]` | ❌ MISSING | Auth required |
| `/bookings/[id]/review` | ❌ MISSING | Auth required, post-meal |
| `/cook/[id]` | ✅ | Public |
| `/cook/specials` | ❌ MISSING | Cook only |
| `/cook/stories` | ❌ MISSING | Cook only |
| `/admin` | ✅ | Admin only |
| `/admin/kyc` | ⚠️ Skeleton | Admin only |
| `/admin/disputes` | ⚠️ Skeleton | Admin only |
| `/admin/users` | ⚠️ Skeleton | Admin only |
| `/admin/bookings` | ⚠️ Skeleton | Admin only |
| `/admin/logs` | ❌ MISSING | Admin only |

---

## 8. SUCCESS METRICS

| Metric | Current | Target | How to Check |
|--------|---------|--------|-------------|
| Build Success | Unknown | 100% | `npm run build` |
| Type Errors | Unknown | 0 | `npm run type-check` |
| Lint Errors | Unknown | 0 | `npm run lint` |
| Lighthouse Perf | Unknown | 85+ | Chrome DevTools |
| Test Coverage | 0% | 60%+ | `npm test -- --coverage` |
| Bundle Size | Unknown | <200KB gzipped | `webpack-bundle-analyzer` |

---

*Document maintained by: Engineering Team*
*Next review: After Milestone 0 completion*
