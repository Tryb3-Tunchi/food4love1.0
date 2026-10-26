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
  return booking.amount ?? booking.total_amount ?? 0
}

function bookingTime(booking: Booking) {
  const when =
    booking.delivery_date ?? booking.scheduled_at ?? booking.created_at
  return new Date(when).getTime()
}

export function splitBookings(bookings: Booking[]) {
  const pending = bookings.filter((b) => b.status === 'pending')
  const upcoming = bookings
    .filter((b) => ['confirmed', 'preparing', 'ready'].includes(b.status))
    .sort((a, b) => bookingTime(a) - bookingTime(b))
  const completed = bookings.filter((b) => b.status === 'delivered')
  const earned = completed.reduce((sum, b) => sum + bookingAmount(b), 0)

  return { pending, upcoming, completed, earned }
}
