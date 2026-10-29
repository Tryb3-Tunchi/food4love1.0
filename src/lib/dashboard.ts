import type { Booking } from '@/services/bookings'
import type { Profile } from '@/types/db'

export interface ChecklistItem {
  key: string
  label: string
  done: boolean
  href: string
}

export function getProfileChecklist(profile: Profile): ChecklistItem[] {
  return [
    {
      key: 'photo',
      label: 'Add a profile photo',
      done: !!profile.avatar_url || !!profile.photos?.length,
      href: '/onboarding/photos',
    },
    {
      key: 'bio',
      label: 'Write a short bio',
      done: !!profile.bio?.trim(),
      href: '/onboarding/setup',
    },
    {
      key: 'location',
      label: 'Add your location',
      done: !!profile.location?.trim(),
      href: '/onboarding/setup',
    },
    {
      key: 'cuisines',
      label: 'Pick your specialties',
      done: !!profile.cuisines?.length,
      href: '/onboarding/setup',
    },
  ]
}

export function bookingAmount(booking: Booking) {
  return booking.amount ?? booking.price ?? 0
}

function bookingTime(booking: Booking) {
  const when = booking.scheduled_for ?? booking.created_at
  return new Date(when).getTime()
}

export type Period = 'week' | 'month' | 'all'

export const PERIOD_LABELS: Record<Period, string> = {
  week: 'Last 7 days',
  month: 'Last 30 days',
  all: 'All time',
}

export function greetingFor(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function summarizeOrders(
  bookings: Booking[],
  period: Period,
  now = new Date(),
) {
  const days = period === 'week' ? 7 : period === 'month' ? 30 : null
  const since = days ? now.getTime() - days * 86_400_000 : 0

  const completed = bookings.filter(
    (b) =>
      b.status === 'completed' &&
      b.payment_status !== 'refunded' &&
      new Date(b.updated_at ?? b.created_at).getTime() >= since,
  )

  return {
    newOrders: bookings.filter((b) => b.status === 'pending').length,
    inProgress: bookings.filter((b) => b.status === 'confirmed').length,
    completed: completed.length,
    earned: completed.reduce((sum, b) => sum + bookingAmount(b), 0),
  }
}

export function splitBookings(bookings: Booking[]) {
  const pending = bookings.filter((b) => b.status === 'pending')
  const upcoming = bookings
    .filter((b) => b.status === 'confirmed')
    .sort((a, b) => bookingTime(a) - bookingTime(b))
  const completed = bookings.filter((b) => b.status === 'completed')
  const earned = completed.reduce((sum, b) => sum + bookingAmount(b), 0)

  return { pending, upcoming, completed, earned }
}
