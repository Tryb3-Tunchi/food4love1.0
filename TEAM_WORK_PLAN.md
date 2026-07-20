# Food4Love — Team Work Plan & Milestone Assignments

**Status:** In Progress | **Last updated:** 2026-07-19

---

## 🚀 Project Overview & Completed Foundation

Based on the `DOCUMENTATION.md`, the project has established a strong engineering foundation and a comprehensive design system. The following key areas are considered complete and stable:

- **Engineering Foundation:** Solid Next.js (App Router) project setup with TypeScript (strict mode), Tailwind CSS, Framer Motion, GSAP, Radix UI, React Hook Form with Zod, Zustand (client state), and Tanstack Query (server state) integrated. Supabase provides backend services and authentication.
- **Design System:** A comprehensive custom design token system (`src/design/tokens.ts`) is implemented and actively used, with global CSS variables for theming.
- **Marketing & Landing Page Rework:** The entire marketing landing page (`/`) has been rebuilt with a premium, dynamic design, including advanced GSAP/ScrollTrigger animations.
- **Role-Based Theming Foundation:** A dynamic theme system using CSS variables allows distinct visual lead colors for buyer and cook experiences, applied to the core app shell and auth/onboarding pages.
- **CI/Prettier/PR Template Setup:** `prettier` is configured, a GitHub Actions CI workflow for linting and building is active, and a comprehensive PR template is in place.
- **Initial App Page Styling:** The `AppPage`, `PageHeader`, and `SwipeCard` components on the `/swipe` page have received substantial styling updates, replacing hardcoded colors with theme variables.

**What must remain untouched:**
As per our established rules and the "Safety Check" in `DOCUMENTATION.md`, all existing business logic, routing, authentication mechanisms (Supabase `signInWithPassword`, `signUp`, `auth.getUser`), onboarding logic, matching logic (`checkMutualLike`, `createMatch`), core swipe logic (`recordSwipe`, `useSwipeDeck`, `nextCard`), chat functionality, direct Supabase queries, Zustand store implementations, and AI API integrations are considered stable and **must not be rewritten or modified** during UI/styling work. Our focus is on extending and refining the existing architecture.

---

## 🎯 Current Milestone: Core Experience UI Polish (🎨 MILESTONE 3 Focus)

**Goal:** Achieve a professional, accessible UI with consistent design language, with an immediate focus on the "Swipe Experience."

**Current Feature Focus:** Swipe Experience UI Polish.

### **Current UI Polish Milestone: Tunchi (Tocukwu.O) with AI Assistance**

**Tunchi (Tocukwu.O)** will be handling this current milestone's UI Polish entirely, with my (AI) assistance. This ensures a consistent and swift completion of the user experience refinements.

- **My (AI) Next Task:** Review and update `src/components/swipe/MatchCelebration.tsx` to align with the new design system and role-based theming.
- **My (AI) Following Tasks:** After `MatchCelebration.tsx`, I will proceed to review and update other core UI components within the `/swipe` and `/matches` routes, and then extend the UI polish to other main application pages like `/profile`, `/matches`, `/chat`, `/requests`, and `/map`, ensuring consistency with role-based themes.

---

## 📋 Milestone 0: CRITICAL LAUNCH BLOCKERS — Detailed Assignments

This milestone is critical for making the app launchable and is structured to address foundational issues before moving to broader features. The existing arrangement of tasks within this milestone is highly professional and correctly prioritizes dependencies.

### **Phase 0.1 — Fix Broken Pages & Remove Mock Data** (Assigned to: Tunchi (Tocukwu.O))

**Goal:** Ensure all core pages are functional and free of mock data in preparation for real data integration.

- [ ] Remove `MOCK_CHEFS`, `MOCK_CONVERSATIONS` from chat index page. Replace with real Supabase query.
- [ ] Remove mock data from chat detail page (`[matchId]/page.tsx`). Wire Supabase `messages` table.
- [ ] Fix import errors on chat pages (`MOCK_CHEFS` reference).
- [ ] Implement `(app)/requests/page.tsx` for cooks to see incoming match requests.
- [ ] Implement `(app)/likes/page.tsx` for cooks to see who liked them.
- [ ] Remove legacy migration artifacts once the app-router implementation is fully verified.
- [ ] Clean up all commented-out imports and debug logs.

**PR Title:** `fix: remove mock data and implement missing app pages`

---

### **Phase 0.2 — Fix Type Safety & Input Validation**

**Goal:** Enhance application robustness through strict typing and input validation.

- **Assigned to: Katura (Franklin.I)**
  - [ ] Generate Supabase types via `supabase gen types typescript` and commit.
    - _Note:_ This task is independent, foundational, and crucial for overall type safety. It will generate `src/types/db.ts` with updated types based on the Supabase schema.

- **Assigned to: Tunchi (Tocukwu.O)**
  - [ ] Add `as any` removals in `onboarding/kyc/page.tsx`. Use proper type unions.
  - [ ] Add Zod validation to all API route handlers (`/api/ai/*` routes).
  - [ ] Add null checks before accessing `profile` in all pages (use optional chaining).

**PR Title:** `refactor: strict types and input validation`

---

### **Phase 0.3 — Implement Booking Flow** (Assigned to: Tunchi (Tocukwu.O))

**Goal:** Establish the end-to-end booking process within the application.

- [ ] Create `src/components/booking/BookingForm.tsx` component (meal selection, delivery time, special requests).
- [ ] Add booking UI to chat header (replace mock CTA).
- [ ] Create `/app/(app)/bookings/new` route for standalone booking form.
- [ ] Implement `createBooking()` service call.
- [ ] Add booking success confirmation screen.
- [ ] Test end-to-end: match → chat → book → confirmation.

**PR Title:** `feat: booking flow UI and integration`

---

### **Phase 0.4 — Payment Gateway Integration** (Assigned to: You - 75%)

**Goal:** Integrate a payment gateway to enable financial transactions.

- [ ] Integrate Paystack SDK (`@paystack/inline-js` or REST API).
- [ ] Create `/api/payments/initialize` endpoint (POST with amount, reference, user email).
- [ ] Create `/api/payments/verify` endpoint (GET with reference, check Paystack).
- [ ] Add payment modal to booking form.
- [ ] On successful payment, update `bookings.status = 'confirmed'`.
- [ ] Add payment receipt page.
- [ ] Test sandbox mode with test cards.

**PR Title:** `feat: Paystack payment integration`

---

### **Phase 0.5 — Admin KYC Approval UI** (Assigned to: You - 75%)

**Goal:** Provide administrative tools for managing Know Your Customer (KYC) approvals.

- [ ] Create `/admin/kyc/page.tsx` with list of pending KYC submissions.
- [ ] Add approve/reject buttons with comment input.
- [ ] Send email notification on approval (Supabase auth email or SendGrid).
- [ ] Update `kyc_status` in profiles table on action.
- [ ] Add KYC detail modal (display ID photo, video preview, user info).
- [ ] Add analytics: approval rate, average review time.

**PR Title:** `feat: admin kyc review and approval flow`

---

### **Phase 0.6 — Web Push Notifications** (Assigned to: You - 75%)

**Goal:** Implement web push notifications for critical user interactions.

- [ ] Register service worker in `src/lib/service-worker.ts`.
- [ ] Implement `requestNotificationPermission()` utility.
- [ ] Create `/api/notifications/subscribe` endpoint (store push subscription in DB).
- [ ] Create `/api/notifications/send` endpoint (send to subscribed users).
- [ ] Trigger notifications on: match created, new message, booking confirmed.
- [ ] Add "disable notifications" setting in user profile.
- [ ] Test on mobile browsers (Chrome, Firefox).

**PR Title:** `feat: web push notifications`

---

### **Phase 0.7 — Fix Responsive Layout** (Assigned to: You - 75%)

**Goal:** Ensure the application is fully responsive and adaptable across various devices.

- [ ] Add tablet breakpoint styles to `Shell.tsx` (hamburger nav, adjusted sidebar).
- [ ] Add `@supports (padding: max(0px)) { padding-bottom: max(...) }` for safe-area on bottom nav.
- [ ] Fix profile hero cover image scaling for small phones.
- [ ] Fix map re-render on orientation change (resize observer).
- [ ] Test responsive behavior at 375px, 768px, 1024px, 1440px widths.

**PR Title:** `fix: responsive design and layout issues`

---

### **Phase 0.8 — Error Boundaries & Fallback UI** (Assigned to: You - 75%)

**Goal:** Implement robust error handling and graceful fallback UIs.

- [ ] Create `src/components/ErrorBoundary.tsx` (React Error Boundary component).
- [ ] Wrap `<Providers>` in error boundary.
- [ ] Create fallback error page with "Go home" button.
- [ ] Add error logging (e.g., Sentry stub).
- [ ] Add try-catch around all async operations in pages.

**PR Title:** `fix: error boundaries and crash recovery`

---

## ✅ Milestone 0 Completion Criteria:

- ✓ App has no hardcoded mock data in production routes
- ✓ All type warnings gone (`npm run lint`)
- ✓ Full booking → payment flow works
- ✓ Admin can approve/reject KYC
- ✓ Users get push notifications on match/message
- ✓ App responsive on all screen sizes
- ✓ No white-screen crashes

---

## 📊 Subsequent Milestones & Division of Labor

The remaining milestones (MILESTONE 1: ADMIN & OPERATIONS, MILESTONE 2: USER FEATURES & SOCIAL, MILESTONE 4: PERFORMANCE & OPTIMIZATION, MILESTONE 5: POLISH & LAUNCH PREP, MILESTONE 6+: POST-LAUNCH FEATURES) will follow this structure. As we complete Milestone 0, we will update this document with detailed assignments for subsequent milestones, maintaining the 75%/25% split and respecting dependencies.

This approach ensures a professional, structured, and efficient development process, allowing us to leverage our respective strengths while building a high-quality product.
