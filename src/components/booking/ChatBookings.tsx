'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  STATUS_LABELS,
  statusHint,
  type BookingStatus,
} from '@/lib/booking/lifecycle'
import { formatLagos } from '@/lib/booking/details'
import { useAuthStore } from '@/stores/useAuthStore'

interface ChatBooking {
  id: string
  status: BookingStatus
  payment_status: string | null
  scheduled_for: string | null
  amount: number | null
  price: number
  buyer_id: string
}

// The bookings that belong to THIS conversation, so both people see the request and its
// status where they are already talking. Reads go through row-level security, so only
// the two people in the booking can ever see a row; the query key starts with
// 'bookings' so a booking notification refreshes it without a reload.
export function ChatBookings({ matchId }: { matchId: string }) {
  const profile = useAuthStore((s) => s.profile)
  const { data } = useQuery({
    queryKey: ['bookings', 'match', matchId],
    enabled: !!profile?.id,
    queryFn: async (): Promise<ChatBooking[]> => {
      const { data, error } = await createClient()
        .from('bookings')
        .select(
          'id, status, payment_status, scheduled_for, amount, price, buyer_id',
        )
        .eq('match_id', matchId)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return (data ?? []) as ChatBooking[]
    },
    staleTime: 10_000,
  })

  if (!data || data.length === 0) return null
  const viewer =
    profile?.id && data[0].buyer_id === profile.id ? 'buyer' : 'cook'

  return (
    <section
      aria-label="Bookings in this conversation"
      className="space-y-2 border-b px-3 py-3 sm:px-4"
      style={{ borderColor: 'var(--border)' }}
    >
      {data.map((booking) => (
        <Link
          key={booking.id}
          href={`/bookings/${booking.id}`}
          className="flex min-h-14 items-center gap-3 rounded-xl border p-3 text-sm"
          style={{ borderColor: 'var(--divider)', background: 'var(--card)' }}
        >
          <CalendarClock
            className="h-5 w-5 shrink-0"
            aria-hidden="true"
            style={{ color: 'var(--accent)' }}
          />
          <span className="min-w-0 flex-1">
            <span
              className="block font-semibold"
              style={{ color: 'var(--text-1)' }}
            >
              {STATUS_LABELS[booking.status] ?? booking.status}
              {booking.scheduled_for
                ? ` · ${formatLagos(booking.scheduled_for)}`
                : ''}
            </span>
            <span
              className="block truncate text-xs"
              style={{ color: 'var(--text-2)' }}
            >
              {statusHint(
                {
                  status: booking.status,
                  payment_status: booking.payment_status,
                },
                viewer,
              )}
            </span>
          </span>
        </Link>
      ))}
    </section>
  )
}
