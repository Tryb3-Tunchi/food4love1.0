import { hasWeeklySchedule } from '@/lib/availability'
import type { CookAvailability, DailySpecial, Profile } from '@/types/db'

export interface QualityCheck {
  key: string
  label: string
  hint: string
  done: boolean
  href: string
}

export const MIN_BIO_LENGTH = 40
export const MIN_DISHES = 3

export function getQualityChecks({
  profile,
  dishes,
  availability,
  waitingBookings,
}: {
  profile: Profile
  dishes: DailySpecial[]
  availability: CookAvailability | null
  waitingBookings: number
}): QualityCheck[] {
  const withPhoto = dishes.filter((d) => !!d.image_url).length

  return [
    {
      key: 'photo',
      label: 'Profile photo',
      hint: 'A clear photo of you helps buyers trust who is cooking.',
      done: !!profile.avatar_url,
      href: '/onboarding/photos',
    },
    {
      key: 'cover',
      label: 'Cover photo',
      hint: 'Use your best food photo. It is the first thing buyers see.',
      done: !!profile.photos?.length,
      href: '/dashboard',
    },
    {
      key: 'bio',
      label: 'A bio that says what you cook',
      hint: `At least ${MIN_BIO_LENGTH} characters: your style, your specialties, what makes your food yours.`,
      done: (profile.bio?.trim().length ?? 0) >= MIN_BIO_LENGTH,
      href: '/onboarding/setup',
    },
    {
      key: 'location',
      label: 'Location and specialties',
      hint: 'Buyers search by area and cuisine, so both need to be filled in.',
      done: !!profile.location?.trim() && !!profile.cuisines?.length,
      href: '/onboarding/setup',
    },
    {
      key: 'dishes',
      label: `At least ${MIN_DISHES} dishes on your menu`,
      hint: 'Keep names, prices and portions accurate so orders match what you cook.',
      done: dishes.length >= MIN_DISHES,
      href: '/cook/specials',
    },
    {
      key: 'dish-photos',
      label:
        dishes.length > 0
          ? `Photos on every dish (${withPhoto} of ${dishes.length})`
          : 'Photos on every dish',
      hint: 'Clear, well-lit photos of the actual food get more orders.',
      done: dishes.length > 0 && withPhoto === dishes.length,
      href: '/cook/specials',
    },
    {
      key: 'availability',
      label: 'Realistic weekly hours',
      hint: 'Only list days and times you can really cook, so you never have to cancel.',
      done: !!availability && hasWeeklySchedule(availability),
      href: '/cook/availability',
    },
    {
      key: 'replies',
      label:
        waitingBookings > 0
          ? `${waitingBookings} booking${waitingBookings === 1 ? '' : 's'} waiting for your reply`
          : 'No bookings waiting for a reply',
      hint: 'Answer quickly. Buyers move on if they are left waiting.',
      done: waitingBookings === 0,
      href: '/bookings',
    },
  ]
}

export function qualityPercent(checks: QualityCheck[]) {
  if (checks.length === 0) return 0
  return Math.round(
    (checks.filter((check) => check.done).length / checks.length) * 100,
  )
}
