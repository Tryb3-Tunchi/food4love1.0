# FOOD4LOVE — Product Requirements Document

**Version:** 1.0 | **Status:** MVP Ready for Build | **Date:** June 2026

---

## 1. PRODUCT OVERVIEW

### Vision

Food4Love is a swipe-based food marketplace that connects home chefs with food lovers using Tinder-style discovery, real-time matching, chat, and meal booking.

### Mission

Make home-cooked food accessible to everyone, while enabling talented home chefs to earn from their passion.

### Target Market

- **Primary:** Lagos, Abuja, Port Harcourt, Nigeria
- **Users (Buyers):** Urban professionals, 22–40, who love food but lack time to cook
- **Chefs (Cooks):** Home cooks, 20–50, who want to monetize their cooking skills

---

## 2. CORE USER JOURNEYS

### Buyer Journey

1. Download / Open app → See landing page
2. Sign up → Role select (Buyer)
3. Onboarding (preferences, cuisines, location)
4. Driver.js guided tour
5. Swipe through chef cards
6. Like a chef → If chef likes back = Match
7. 24h match window → Start chat
8. Chat → View booking CTA
9. Book a meal → Pay
10. Receive meal → Rate & review

### Chef Journey

1. Sign up → Role select (Cook)
2. Onboarding (bio, photos, cuisines, pricing)
3. KYC verification (ID + face)
4. Post daily specials / stories
5. Appear in buyer discovery feed
6. Receive likes → Accept/reject matches
7. Chat with matched buyers
8. Confirm booking → Cook meal → Deliver
9. Receive payment → Build rating

---

## 3. FEATURE REQUIREMENTS (MVP)

### P0 — Must Have for Launch

- [x] Auth (email/password + OTP verify)
- [x] Role selection (Cook / Buyer)
- [x] Profile setup (bio, photos, cuisines, location)
- [x] Swipe deck (cook cards with drag physics)
- [x] Like / Pass actions
- [x] Mutual match detection
- [x] 24h match expiry
- [x] Real-time chat (Supabase Realtime)
- [x] Match celebration overlay
- [x] Bottom navigation (mobile)
- [x] Sidebar navigation (desktop)
- [x] Dark mode
- [x] Landing page
- [x] First-user tour (Driver.js)
- [x] Cook public profile (SEO)
- [x] Daily specials
- [x] Stories strip
- [x] Streak system
- [x] AI chat suggestions (Gemini Flash)
- [x] AI bio generator

### P1 — Next Sprint

- [ ] Booking & payment flow (Paystack integration)
- [ ] Push notifications (Web Push API)
- [ ] Superlike feature
- [ ] Chef stories upload
- [ ] Photo upload with compression
- [ ] KYC flow (ID upload)
- [ ] Referral system with rewards
- [ ] Admin dashboard
- [ ] Cook requests page
- [ ] Review & rating system

### P2 — Future

- [ ] Video profiles for chefs
- [ ] Group booking (order for multiple people)
- [ ] Scheduled meal delivery
- [ ] Subscription plans
- [ ] Multi-city expansion (Accra, Nairobi, London diaspora)
- [ ] Chef training/certification program

---

## 4. TECH ARCHITECTURE

### Frontend

- Next.js 14 (App Router, TypeScript)
- Tailwind CSS v3 with custom design tokens
- Framer Motion + React Spring (animations)
- @use-gesture/react (drag physics)
- Zustand (global state) + React Query (server state)
- Radix UI (accessible primitives)
- Driver.js (onboarding tour)

### Backend

- Supabase (PostgreSQL, Auth, Storage, Realtime)
- Next.js API Routes (Edge Functions)
- Google Gemini 1.5 Flash (AI features, free tier)
- Leaflet + OpenStreetMap (free maps)

### Database Tables

- profiles (id, full_name, role, bio, cuisines, photos, price_min, price_max, rating, streak, kyc_status, onboarding_complete, tour_completed)
- swipes (id, swiper_id, swiped_id, action, created_at)
- matches (id, user1_id, user2_id, status, expires_at)
- messages (id, match_id, sender_id, content, read_at)
- daily_specials (id, cook_id, title, description, price, image_url, available_until)
- stories (id, cook_id, image_url, caption, expires_at)
- bookings (id, match_id, cook_id, buyer_id, dish_title, price, status, scheduled_for)
- reviews (id, booking_id, reviewer_id, reviewee_id, rating, comment)

### Supabase RLS Policies (Critical)

- profiles: Public read, own write only
- swipes: Own read/write only
- matches: Read if participant only
- messages: Read if match participant only
- bookings: Read if participant only

---

## 5. DESIGN SYSTEM

### Colors

- Pepper: #E8390E (primary CTA, love)
- Ember: #F59E0B (warmth, match glow)
- Lime: #84CC16 (success, verified)
- Char: #0F0A05 (dark bg)
- Smoke: #1A1008 (dark card)
- Cream: #FEF7ED (light bg)

### Typography

- Display: DM Serif Display (hero moments only)
- Body: Space Grotesk (all text)
- Mono: JetBrains Mono (prices, codes)

### Principles

- Mobile-first, tablet/desktop-aware
- Dark mode default
- Warm, alive, sensory aesthetic
- Spring physics on interactions
- No skeleton-less loading states

---

## 6. METRICS & SUCCESS

### North Star Metric

**Weekly Active Matches** — users who complete at least one match→chat→booking cycle per week

### Launch Targets (Month 3)

- 500 verified chefs onboarded
- 5,000 registered users
- 1,000 weekly swipe sessions
- 200 matches per week
- 50 completed bookings per week
- 4.5+ average chef rating

### Investor KPIs

- CAC (Customer Acquisition Cost)
- Match-to-Chat Rate (target: >60%)
- Chat-to-Booking Rate (target: >20%)
- Chef Retention (30-day: target >70%)
- Buyer Repeat Rate (target: 40%+)

---

## 7. RISKS & MITIGATIONS

| Risk                                | Mitigation                                    |
| ----------------------------------- | --------------------------------------------- |
| Chef quality inconsistency          | KYC + rating system + suspension policy       |
| Food safety liability               | Terms of service, chef certification program  |
| Low liquidity (few chefs or buyers) | Launch city-by-city, curate first 100 chefs   |
| Payment fraud                       | Paystack integration, escrow model            |
| Match expiry frustration            | In-app notification, 4h warning before expiry |

---

## 8. COMPETITIVE LANDSCAPE

| Feature             | Food4Love | Chowdeck | Uber Eats | Homemade |
| ------------------- | --------- | -------- | --------- | -------- |
| Home chef focus     | ✅        | ❌       | ❌        | ✅       |
| Swipe discovery     | ✅        | ❌       | ❌        | ❌       |
| Real-time matching  | ✅        | ❌       | ❌        | ❌       |
| Nigerian market     | ✅        | ✅       | ✅        | ❌       |
| AI-powered features | ✅        | ❌       | ❌        | ❌       |

**Our moat:** The swipe-to-match mechanic creates emotional investment that restaurant delivery apps never will. Users root for their matches. This drives retention.

---

_Document owner: Product Team | Next review: Pre-launch_
