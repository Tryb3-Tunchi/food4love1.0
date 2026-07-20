# Food4Love Project Guide

## 1. Project Understanding

- **What Food4Love is**: Food4Love is a premium consumer startup designed to seamlessly connect "Food Lovers" with talented home chefs across Nigeria. It's a platform for discovering authentic, high-quality home-cooked meals tailored to individual preferences.
- **Product Vision**: To transform the act of ordering food into a warm, human, and delightful experience. The vision is to build a trusted community where home chefs can thrive and food lovers can consistently find comforting, thoughtful meals that feel personal, moving beyond the generic and impersonal nature of traditional takeout.
- **Target Users**: Primarily, these are individuals looking for high-quality, home-cooked meals and, conversely, home chefs who wish to build a customer base and earn from their cooking.
- **Experience We Are Trying to Build**: A premium, visually stunning, modern, and trustworthy digital space. The interface should feel intuitive, inviting, and joyful, drawing strong inspiration from the emotional and aesthetic qualities of leading consumer products like Chowdeck, Airbnb, Apple, and Pinterest, while maintaining a distinct, warm, African-inspired identity.

## 2. Current Engineering State

- **Tech Stack**:
  - **Framework**: Next.js 14.2.5 (App Router)
  - **Frontend**: React, TypeScript (strict mode)
  - **Styling**: Tailwind CSS v3 with a custom design token system
  - **Animation**: Framer Motion (general UI), GSAP (GreenSock Animation Platform) with ScrollTrigger (advanced, layout-safe animations)
  - **UI Primitives**: Radix UI
  - **Form Management**: React Hook Form with Zod (validation)
  - **Client State**: Zustand (in use)
  - **Server State**: Tanstack Query (`@tanstack/react-query` is installed in `package.json` for server-side data fetching and caching)
- **Architecture**: Component-based UI within Next.js App Router route groups (`(marketing)`, `(auth)`, `(app)`).
- **Design System**: Custom tokens (`src/design/tokens.ts`) for colors, typography, spacing, radii, shadows, integrated via `tailwind.config.ts`, and exposed as global CSS variables in `src/app/globals.css`.
- **Shared UI Components**: `Button`, `Input`, `Card`, `Avatar`, `Badge`, `AppPage`, `PageHeader`, `Shell`, `SidebarNav`, `BottomNav`, `AppTopBar`.
- **Routing Structure**: Next.js App Router for organized and type-safe navigation.
- **Authentication**: Supabase handles user authentication (sign-up, sign-in, sessions), integrated with Next.js server-side rendering where applicable.
- **State Management**:
  - **Client State**: Zustand is effectively used for global client-side state (e.g., `useAuthStore` for user profiles, `useSwipeStore` for swipe deck).
  - **Server State**: Tanstack Query (`@tanstack/react-query`) is the chosen library for managing server-side data fetching, caching, synchronization, and updates. While core hooks might need specific integration, the library is already available for use across data-intensive pages (e.g., `/swipe`, `/matches`).
- **Backend/Services**: Supabase provides the database and backend services. Custom API routes (`src/app/api`) handle AI integrations (smart matching, chat suggestions, dispute analysis, chef bio generation).
- **Animations Already Integrated**: Framer Motion for general transitions. GSAP and ScrollTrigger are integrated for premium, layout-safe animations across marketing pages. Global ambient CSS animations provide varied motion moods.

## 3. Progress So Far

- **Engineering Foundation**: Solid Next.js project setup with TypeScript, Tailwind, and Supabase integration.
- **Design System**: Comprehensive custom design token system implemented and actively used.
- **Marketing & Landing Page Rework**:
  - Complete rebuild of the entire marketing landing page (`/`) to embody the premium, dynamic design direction (Chowdeck-inspired header, hero, horizontal card rails, motion).
  - Fixed an auto-scroll bug on the landing page related to the global tour component.
- **Role-Based Theming Foundation**: Implemented a dynamic theme system using CSS variables that allows distinct visual lead colors for buyer (softer green) and cook (warmer accents) experiences, applied to core app shell and auth/onboarding pages.
- **Marketing Animation Foundation**: Fully integrated GSAP/ScrollTrigger and applied them to the marketing landing page elements (`MarketingMotionShell`), creating specific, professional animations. Ambient CSS animations are also globally integrated.
- **CI/Prettier/PR Template Setup**:
  - `prettier` is configured with ESLint for automated code formatting.
  - A GitHub Actions CI workflow (`ci.yml`) is active for linting, formatting checks, and building on PRs.
  - A comprehensive `.github/PULL_REQUEST_TEMPLATE.md` is in place.
- **Initial App Page Styling**:
  - The `AppPage` and `PageHeader` components on the `/swipe` page have been updated to use dynamic theme variables.
  - The `SwipeCard` component on the `/swipe` page has received substantial styling updates, replacing hardcoded colors for its background, text, icons, "LIKE"/"PASS" stamps, and daily special badges with theme variables.

## 4. Current Work In Progress

- **Branch**: `feat/app-ui-refresh`
- **Page currently being improved**: `/swipe`
- **Components already updated**:
  - `src/app/(app)/swipe/page.tsx` (specifically its `PageHeader` usage).
  - `src/components/swipe/SwipeCard.tsx`.
- **Components still remain**:
  - `src/components/swipe/SwipeActions.tsx` (currently being updated).
  - Other main application pages (e.g., `/profile`, `/matches`, `/chat`, `/requests`, `/map`) need styling review and application of role-based themes.

## 5. Safety Check

The following parts of the application's business logic must remain untouched during UI/styling work:

- **Authentication**: Supabase `signInWithPassword`, `signUp`, `auth.getUser` implementations.
- **Onboarding**: Logic for role selection, KYC status updates, user profile updates.
- **Matching Logic**: `checkMutualLike` and `createMatch` functions.
- **Swipe Logic**: `recordSwipe` service, `useSwipeDeck` hook, `nextCard` functionality within `useSwipeStore`.
- **Chat**: Core logic for sending/receiving messages, `useMessages` hook, `BookingCTA` component's functionality.
- **Supabase Queries**: All direct Supabase `from`, `select`, `update`, and `insert` operations.
- **Stores**: Zustand stores (`useAuthStore`, `useSwipeStore`, `useNotificationStore`).
- **API Integrations**: AI-powered endpoints (smart matching, chat suggestions, dispute analysis, bio generation).
- **Routing**: Next.js `redirect`, `usePathname`, `useSearchParams` functions.

## 6. Product & Design Direction

The design philosophy for Food4Love is centered on creating an emotionally engaging and high-quality digital product, moving far beyond a utilitarian application. We are crafting an experience that is:

- **Warm & Human**: Evoked by an inviting color palette (warm base, versatile green accents), friendly typography, and UI elements that emphasize personal connection and care (e.g., custom chef cards, personalized interactions). The goal is for users to feel a personal connection to their food and chefs.
- **Premium & Modern**: Achieved through a clean, uncluttered aesthetic, generous use of whitespace, and refined UI components. This avoids the "template" or "admin dashboard" feel, instead presenting a sophisticated and contemporary look that suggests high value.
- **Delightful & Trustworthy**: Delivered via subtle, purposeful animations that enhance user flow without distracting (inspired by GSAP's capabilities for smooth transitions and scroll-linked effects). Trust is built through transparent information display (verified chefs, clear ratings) and a polished, consistent user interface.

The aim is to capture the aspirational emotional quality of leading consumer brands like Chowdeck (dynamic, product-first visuals, strong branding), Airbnb (human, inviting, focused on experience), Apple (clean, intuitive, premium), and Pinterest (visually rich, inspiring), while ensuring Food4Love retains its unique African-inspired identity and warmth. Every visual decision should reinforce these core values, making the app feel thoughtfully crafted and engaging.

## 7. Next Step

The next implementation task is to finish applying the styling refinements to the `SwipeActions` component within [src/components/swipe/SwipeActions.tsx](file:///c:/Users/user/Downloads/food4lov3/food4love/src/components/swipe/SwipeActions.tsx). This specifically involves updating the "Superlike" and "Like" button styles to consistently use the new CSS variables for role-based theming.

## 8. Confidence Check

I understand the current repository state and can continue implementation without rewriting existing working logic.
