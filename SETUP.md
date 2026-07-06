# FOOD4LOVE — Setup Guide

## 1. Install dependencies
```bash
npm install
```

## 2. Set up environment variables
Edit `.env.local` with your real values:
- `NEXT_PUBLIC_SUPABASE_URL` → from Supabase project settings
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → from Supabase project settings  
- `SUPABASE_SERVICE_ROLE_KEY` → from Supabase project settings
- `GOOGLE_GENERATIVE_AI_API_KEY` → free at https://aistudio.google.com/app/apikey

## 3. Set up Supabase
1. Create a new project at https://supabase.com
2. Go to SQL Editor → paste contents of `supabase-schema.sql` → Run
3. Go to Storage → create two buckets:
   - `profile-photos` (public)
   - `kyc-documents` (private)
4. Enable Realtime for `messages` and `matches` tables

## 4. Run the app
```bash
npm run dev
```

Open http://localhost:3000

## 5. Admin access
Add your user's role as admin in Supabase profiles table manually for first admin user.

## Key routes
- `/` — Landing page
- `/login` — Login
- `/signup` — Signup
- `/onboarding/role` — Role selection
- `/onboarding/setup` — Profile setup
- `/onboarding/photos` — Photo upload
- `/onboarding/kyc` — KYC verification (cooks)
- `/swipe` — Main discovery feed
- `/matches` — Matches list
- `/chat/[matchId]` — Chat
- `/profile` — User profile
- `/map` — Map view
- `/admin` — Admin dashboard (⚠️ protect this route)
- `/cook/[id]` — Public chef profile (SEO)

## What's borrowed from top platforms
- **Tinder/Bumble**: Swipe physics, drag-follow, match celebration, 24h expiry
- **Chowdeck**: Dark warm aesthetic, bottom nav, card design, typography
- **Uber Eats**: Booking flow structure, real-time status updates
- **DoorDash**: Dispute system with evidence upload
- **Airbnb**: KYC verification gate, chef public profiles, trust layer
- **Bumble**: Chef must accept match (cook sees requests, buyer initiates)
- **Linear/Vercel**: Design system discipline, CVA component variants
- **WhatsApp**: Nigerian market context, share referral link via WhatsApp

## AI Features (Google Gemini Flash - FREE)
- `/api/ai/bio` — Generates chef bio from cuisine info
- `/api/ai/chat-suggestions` — Smart opening message suggestions
- `/api/ai/taste-profile` — Converts food description to structured profile
- `/api/ai/smart-match` — Ranks chef deck by user taste compatibility
- `/api/ai/dispute-analysis` — Pre-analyzes disputes before admin review

## Investor KPIs to track
- Weekly Active Matches
- Match → Chat rate (target 60%+)
- Chat → Booking rate (target 20%+)
- Chef 30-day retention (target 70%+)
- Buyer repeat rate (target 40%+)
