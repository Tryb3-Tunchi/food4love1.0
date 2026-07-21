---
name: Profiles service missing exports
description: profiles.ts only had getSwipeDeck; getProfile and updateProfile were missing and needed by useProfile hook and onboarding pages.
---

## Rule

`src/services/profiles.ts` — added `getProfile(id: string): Promise<Profile>` and `updateProfile(id: string, updates: Partial<Profile>): Promise<Profile>` using Supabase `.from('profiles')` queries. These were imported by `useProfile.ts`, `onboarding/photos`, `onboarding/role`, `onboarding/setup`, and `AppTour`.

**Why:** The service file was scaffolded with only the swipe-deck query. The hook and pages were written expecting the standard profile CRUD functions to exist.

**How to apply:** If you add new onboarding steps or profile-reading components, these two exports are available in the service. Do not duplicate the Supabase calls inline.
