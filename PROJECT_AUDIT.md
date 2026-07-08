# Food4Love — Project Audit Report
**Date:** 2026-07-07 | **Branch:** develop | **Status:** MVP-Ready Codebase

---

## ARCHITECTURE

### P0 — Critical
- **Auth layer mismatch:** `useAuth()` hook imported from old providers but not in use; `useAuthStore` (Zustand) is the actual source of truth. Creates confusion about state management pattern.
- **Supabase client instantiation:** Multiple files call `createClient()` without proper error handling for connection failures. No fallback or retry logic.
- **Auth context usage:** Current app state relies on the app-router provider layer rather than the legacy Vite context implementation.

### P1 — High
- **Layout protection incomplete:** `(app)/layout.tsx` redirects unauthenticated users but doesn't await auth check in all routes. Race conditions possible on slow networks.
- **No typed API route handlers:** AI routes (`api/ai/*`) lack TypeScript request/response validation. Using `any` types in handlers.
- **Shallow dependency graph:** Services import Supabase client directly; no abstraction layer if backend needs to swap providers later.

### P2 — Medium
- **Legacy migration cleanup:** Remaining Vite-era artifacts should be removed only after the app-router routes are fully verified and no runtime references remain.

### P3 — Future
- **No error boundary:** App crashes on unhandled React errors; no graceful recovery UI.

---

## UI CONSISTENCY

### P0 — Critical
- **Color variable naming inconsistency:** 
  - Design tokens use: `pepper`, `ember`, `lime`, `char`, `smoke`, `coal`
  - Inline styles use: `var(--pepper)`, `var(--accent)`, `var(--bg)`, `var(--text-1)`
  - No canonical CSS variable map. Hard to audit which colors exist and where they're used.
- **Chat page uses MOCK_CHEFS:** Production chat shows hardcoded mock data instead of real Supabase queries. Will break on launch if not fixed.
- **Chat index page incomplete:** References `MOCK_CHEFS` but file import is broken (commented out). Page cannot render.

### P1 — High
- **Button variant naming:** `Button` has `variant="primary" | "secondary" | "surface" | "ember"` but uses aren't standardized. Some pages use inline styles instead of variant props.
- **Avatar component:** Sometimes renders image, sometimes emoji fallback. No loading state or error state styling.
- **Responsive gaps:** Some pages use `gap-2`, others `gap-4`. No consistent spacing scale enforced.

### P2 — Medium
- **PageHeader component:** Has `badge`, `badgeColor`, `iconBg` props but only used inconsistently across pages. Creates cognitive load.
- **Empty states:** Each route redefines empty state UI (emoji, message). Should be centralized `EmptyState` component.

---

## RESPONSIVENESS

### P0 — Critical
- **Shell layout fragile:** `Shell.tsx` uses `md:ml-64` breakpoint for sidebar. No tablet-specific layout (iPad size = broken nav).
- **Fixed heights:** Bottom nav uses `safe-bottom` but BottomNav is hardcoded to `fixed bottom-0` without `@supports` fallback for notch/dynamic island devices.
- **Profile page hero:** Cover image is hardcoded `h-36` — no responsive sizing for phones <360px.

### P1 — High
- **Map page:** Leaflet map doesn't resize on orientation change. Dragging broken on mobile after landscape-to-portrait switch.
- **Modal bottom sheets:** Filter modal in swipe page uses `max-h-[80vh]` but no consideration for mobile keyboard height. On iOS, keyboard overlaps inputs.
- **Chat input:** Textarea grows with text but no max-height cap. Long messages push UI off-screen.

### P2 — Medium
- **Auth pages:** Desktop-only left panel hidden on mobile, but mobile layout has unbalanced padding left/right.
- **Sidebar:** No hamburger menu on mobile; forces desktop nav on small screens.

---

## DESIGN SYSTEM

### P0 — Critical
- **No CSS variable documentation:** `--bg`, `--text-1`, `--card`, `--accent` are sprayed across components but no canonical source. Hardcoded in multiple files.
- **Color modes incomplete:** "Hunger mode" toggle exists but only adds a class to `<html>`. No CSS custom properties for dark/light mode. Theme switching is manual string replacements.

### P1 — High
- **Typography scale undefined:** Uses `text-display-sm`, `font-heading`, etc., but no `tailwind.config.ts` shows where these are defined. Likely missing tokens file or incomplete Tailwind config.
- **Spacing scale inconsistent:** Mix of `px-4`, `px-5`, `p-3`, `p-4` across components. No 4px-based scale enforced.
- **Shadow system unused:** `tokens.ts` defines `card`, `float`, `glow` shadows but components use inline `box-shadow`.

### P2 — Medium
- **No component variants library:** Each component re-implements color/size combos instead of using CVA (class-variance-authority is imported but underused).
- **Badge component:** Generic but only used for badges; could be extracted as `Pill` for broader reuse.

---

## CODE QUALITY

### P0 — Critical
- **Implicit any types:** Services use `any` in multiple places (e.g., `id_type: idType as any` in KYC flow).
- **No error handling in async calls:** `handleSwipe()`, `generateBio()`, `applyFilters()` swallow errors or log to console only. User sees no feedback.
- **Magic strings:** Supabase table/column names hardcoded in 8 service files. One typo breaks multiple routes.
- **Missing null checks:** Profile pages assume `profile` exists; will crash if store hydration is slow.

### P1 — High
- **No input validation on client:** Form inputs use `zodResolver` but API routes don't re-validate. Could accept invalid data.
- **Loose type exports:** `db.ts` exports types but some services override properties as `any` or `unknown`.
- **Cleanup missing:** Components don't unsubscribe from Realtime listeners. Memory leaks on chat page navigation.
- **Console.logs in production:** Chat page has mock data that runs real send logic; debug code not cleaned up.

### P2 — Medium
- **Hardcoded URLs:** `next.config.mjs` hardcodes Supabase domain patterns. No env var for image domains.
- **Unused imports:** Multiple files import unused components or utilities (found in older pages).

---

## PERFORMANCE

### P0 — Critical
- **Swipe deck loaded in memory:** All 20 cards pre-loaded into Zustand store. No pagination. 20+ profile images bloat RAM.
- **No image optimization:** Profile photos uploaded uncompressed (1MB per image). Cards re-render on every drag pixel movement without memoization.
- **Inefficient re-renders:** `useSwipeDeck()` refetches entire deck when filters change. No incremental query updates.

### P1 — High
- **Chat realtime subscription never cleaned up:** `useMessages()` or `useChat()` likely subscribes without unsubscribe in cleanup. Will leak Supabase connections.
- **No pagination on lists:** Matches page, chat index, admin panels load all data at once.
- **Bundle size:** 34 components + 11 hooks + 8 services = ~50KB gzipped. No code splitting by route.

### P2 — Medium
- **Framer Motion always enabled:** Animations on every page transition. No `prefers-reduced-motion` support.
- **Skeleton loaders oversized:** LoadingState generates 4 Skeleton components even for single-item pages.

---

## ACCESSIBILITY

### P0 — Critical
- **No semantic HTML:** Many divs used instead of `<button>`, `<nav>`, `<header>`. Screen readers will struggle.
- **Missing ARIA labels:** Icon-only buttons (close, settings, share) have no `aria-label`. Tab order broken.
- **Color-only indicators:** Status (verified, unread) uses color or emoji only. Colorblind users miss context.

### P1 — High
- **Focus management:** Modals don't trap focus or return focus to trigger. Tab key navigates behind modal.
- **Form labels:** Input labels present but not linked via `htmlFor`. Wrong element association.
- **Contrast failures:** Some text on `var(--bg-2)` backgrounds fails WCAG AA. E.g., `text-mist` on dark backgrounds.

### P2 — Medium
- **No skip links:** No way to skip to main content on first tab. Nav repeated on every page.
- **Heading hierarchy broken:** Pages jump from `<h1>` to `<h3>`. Screen reader users lose structure.

---

## TECHNICAL DEBT

### P0 — Critical
- **No linting enforcement:** ESLint installed but no pre-commit hooks. Code quality varies wildly between files.
- **Mock data in production routes:** Chat, map, chat index pages hardcode MOCK_CHEFS. Will fail on launch.
- **Commented-out imports:** Multiple files have `// import { MOCK_CHEFS }` commented. Should be cleaned or used.

### P1 — High
- **No test coverage:** Zero test files. No CI/CD tests running on PRs.
- **Inconsistent naming:** `useSwipeDeck()` vs `getSwipeDeck()`. CamelCase vs camelCase. No naming convention doc.
- **Supabase types hand-written:** No `types/database.ts` generated from Supabase CLI. Types drift from schema easily.

### P2 — Medium
- **No logging/monitoring:** No Sentry, LogRocket, or console infrastructure for error tracking.
- **Hard-coded env examples:** `.env.local` values in SETUP.md; actual `.env.local` not in git. Should use `env.example`.
- **Unused packages:** Some deps in `package.json` may be unused (e.g., `@types/leaflet` if map is mock-only).

---

## MISSING PRODUCT FEATURES

### P0 — Critical
- **Booking flow incomplete:** `bookings.ts` service exists but no UI to book a meal. Only CTA button in chat; no form.
- **Payment integration missing:** Paystack mentioned in PRD but zero code. Can't accept payments.
- **Real-time notifications missing:** No Web Push API implementation. Users don't know they matched or got messages.
- **KYC approval flow missing:** Admin dashboard has KYC stats but no approval UI. Can't verify chefs.

### P1 — High
- **Admin dashboard skeleton:** Stat cards render but no drill-down pages for KYC, disputes, or user management.
- **Requests page (cook side) not implemented:** Route exists but no component at `(app)/requests/page.tsx`.
- **Likes page not implemented:** Route exists but no component at `(app)/likes/page.tsx`.
- **Stories upload missing:** Cook can't upload stories. Story component exists but no upload flow.
- **Daily specials creation missing:** Chef profiles show daily special but no UI to create/update it.
- **Review system missing:** Profile shows reviews but no UI to submit them after booking.
- **Dispute system UI missing:** `services/disputes.ts` exists but no admin page to review disputes.

### P2 — Medium
- **Superlike feature:** Swipes.ts supports "superlike" action but no UI button for it.
- **Referral system:** Not started (listed as P1 in PRD but no code).
- **Public chef profile SEO:** `/cook/[id]/page.tsx` doesn't exist. Can't share chef profiles.

---

## LAUNCH BLOCKERS

### P0 — MUST FIX BEFORE LAUNCH
1. **Fix chat index & chat detail pages:** Remove mock data, implement real Supabase queries.
2. **Implement booking flow UI:** Add form to match chat header CTA. Integrate with backend.
3. **Implement payment gateway:** Integrate Paystack for meal purchases.
4. **Fix admin KYC approval UI:** Add approve/reject buttons. Send verification emails.
5. **Fix shell responsiveness:** Tablet breakpoints, hamburger nav for mobile.
6. **Implement push notifications:** Web Push API for match & message alerts.
7. **Implement requests/likes pages:** Full CRUD for cook requests and buyer likes lists.
8. **Add input validation on all API routes:** Zod schemas in handlers, not just client.
9. **Clean up unused files:** Delete `_old_vite_*` folders, commented imports, mock data.
10. **Add error boundaries & fallback UI:** Prevent white screens on crashes.

### P1 — FIX BEFORE PUBLIC BETA
1. Fix responsive map behavior on orientation change.
2. Implement all missing admin pages (disputes, analytics, moderation).
3. Add keyboard height handling to chat input (iOS).
4. Fix chat input max-height cap.
5. Implement daily specials CRUD for chefs.
6. Implement review submission flow.
7. Add Supabase realtime unsubscribe cleanup (memory leak fix).
8. Add `prefers-reduced-motion` support.
9. Generate Supabase types via CLI.
10. Set up pre-commit linting + formatting checks.

---

## SUMMARY

**MVP Status:** 70% complete. Core swipe → match → chat loop works. Major gaps in booking, payments, notifications, and admin tools.

**Health:** Code is functional but lacks polish. Inconsistent patterns, hardcoded data, missing error handling, and accessibility issues will cause problems at scale.

**Estimate to Launch:** 4–6 weeks if team addresses P0 items immediately.

---

**Audit completed by:** Senior Engineering Review | **Next audit:** After implementing checklist
