'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { STATUS_LABELS, type BookingStatus } from '@/lib/booking/lifecycle'
import { formatLagos } from '@/lib/booking/details'

interface BookingEvent {
  id: string
  actor_role: string
  action: string
  to_status: string | null
  created_at: string
}

const ACTION_TEXT: Record<string, string> = {
  request: 'Request sent',
  accept: 'Accepted by the cook',
  decline: 'Declined by the cook',
  propose_alternative: 'Another time suggested',
  accept_alternative: 'New time accepted',
  decline_alternative: 'New time declined',
  cancel: 'Cancelled',
  complete: 'Marked as completed',
}

// What happened to this booking and when. Row-level security lets only the two people in
// the booking read it. Before the booking migration is applied the table does not exist,
// and then the section simply does not appear.
export function BookingHistory({ bookingId }: { bookingId: string }) {
  const { data } = useQuery({
    queryKey: ['bookings', 'history', bookingId],
    queryFn: async (): Promise<BookingEvent[]> => {
      const { data, error } = await createClient()
        .from('booking_events')
        .select('id, actor_role, action, to_status, created_at')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true })
      if (error) return []
      return (data ?? []) as BookingEvent[]
    },
    staleTime: 10_000,
  })

  if (!data || data.length === 0) return null

  return (
    <section
      aria-label="Booking history"
      className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        History
      </h3>
      <ol className="space-y-2 text-sm">
        {data.map((event) => (
          <li
            key={event.id}
            className="flex justify-between gap-3 text-[var(--text)]"
          >
            <span>
              {ACTION_TEXT[event.action] ?? event.action}
              {event.to_status &&
              STATUS_LABELS[event.to_status as BookingStatus]
                ? ` · ${STATUS_LABELS[event.to_status as BookingStatus]}`
                : ''}
            </span>
            <time
              dateTime={event.created_at}
              className="shrink-0 text-xs text-[var(--text-muted)]"
            >
              {formatLagos(event.created_at)}
            </time>
          </li>
        ))}
      </ol>
    </section>
  )
}
