# Food4Love

A Tinder-style platform for connecting food buyers with home chefs in Nigeria. Buyers swipe on chef profiles, match, chat, and book home-cooked meals.

## Stack

- **Framework**: Next.js 14 (App Router, Turbopack)
- **Database & Auth**: Supabase (Postgres + Row-Level Security)
- **AI**: Google Gemini Flash (free tier) via `@ai-sdk/google`
- **Styling**: Tailwind CSS + Radix UI + CVA
- **State**: Zustand + TanStack Query

## Running the app

```bash
npm run dev        # starts on port 5000
npm run build      # production build
npm run type-check # TypeScript check
```

The workflow **Start application** runs `npm run dev` and serves on port 5000.

## Environment variables

Set in Replit Secrets / Env Vars:

| Key                             | Type    | Purpose                             |
| ------------------------------- | ------- | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | env var | Supabase project URL                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | env var | Supabase public anon key            |
| `SUPABASE_SERVICE_ROLE_KEY`     | secret  | Supabase service role (server-only) |
| `GOOGLE_GENERATIVE_AI_API_KEY`  | secret  | Google Gemini API key               |
| `NEXT_PUBLIC_APP_URL`           | env var | Public app URL                      |
| `NEXT_PUBLIC_APP_NAME`          | env var | App name (Food4Love)                |

## Key routes

- `/` — Landing page
- `/login` / `/signup` — Auth
- `/onboarding/role` → `/onboarding/setup` → `/onboarding/photos` → `/onboarding/kyc` — Onboarding flow
- `/swipe` — Main discovery feed (swipe cards)
- `/matches` — Matches list
- `/chat/[matchId]` — Real-time chat
- `/profile` — User profile
- `/map` — Map view of nearby chefs
- `/admin` — Admin dashboard
- `/cook/[id]` — Public chef profile (SEO)

## AI endpoints

- `POST /api/ai/bio` — Generate chef bio
- `POST /api/ai/chat-suggestions` — Smart opening messages
- `POST /api/ai/taste-profile` — Convert food description to structured profile
- `POST /api/ai/smart-match` — Rank chef deck by taste compatibility
- `POST /api/ai/dispute-analysis` — Pre-analyze disputes

## Supabase setup

If starting with a fresh Supabase project:

1. Run `supabase-schema.sql` in the SQL Editor
2. Create storage buckets: `profile-photos` (public) and `kyc-documents` (private)
3. Enable Realtime for `messages` and `matches` tables

## User preferences

- Keep existing project structure and stack
