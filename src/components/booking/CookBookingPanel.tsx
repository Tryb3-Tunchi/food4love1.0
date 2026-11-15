'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Bell, Loader2, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

interface BookingStatusResponse {
  cook_name: string | null
  state: 'verified' | 'under_review' | 'rejected' | 'not_verified' | 'suspended'
  label: string
  bookable: boolean
  explanation: string
  can_express_interest: boolean
  interest: {
    id: string
    notify_when_verified: boolean
    created_at: string
  } | null
}

async function fetchStatus(cookId: string): Promise<BookingStatusResponse> {
  const response = await fetch(`/api/booking-status?cook_id=${cookId}`, {
    cache: 'no-store',
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Could not load')
  return body as BookingStatusResponse
}

// What a customer sees about a cook's availability for booking, wherever it is shown
// (chat, booking page). The server decides; this only displays it. A verified cook shows
// a Book button; anyone else shows why, plus the choices that do NOT create a booking:
// ask to be told, or look at verified cooks.
export function CookBookingPanel({
  cookId,
  cookName,
  matchId,
}: {
  cookId: string
  cookName?: string
  matchId?: string | null
}) {
  const queryClient = useQueryClient()
  const [notify, setNotify] = useState(false) // never pre-ticked: consent is explicit

  const status = useQuery({
    queryKey: ['booking-status', cookId],
    queryFn: () => fetchStatus(cookId),
    staleTime: 15_000,
  })

  const ask = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/booking-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cook_id: cookId, notify_when_verified: notify }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok)
        throw new Error(body.error || 'Could not save your request')
    },
    onSuccess: () => {
      toast.success('Request saved. This is not a booking.')
      void queryClient.invalidateQueries({
        queryKey: ['booking-status', cookId],
      })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const withdraw = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/booking-interests', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cook_id: cookId }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Could not withdraw')
    },
    onSuccess: () => {
      toast.success('Request withdrawn')
      void queryClient.invalidateQueries({
        queryKey: ['booking-status', cookId],
      })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const realName = cookName || status.data?.cook_name || ''
  const first = realName.split(' ')[0] || 'this cook'
  const fullName = realName || 'this cook'

  if (status.isLoading) {
    return (
      <div
        role="status"
        aria-label="Checking verification"
        className="flex items-center gap-2 rounded-2xl border p-4 text-sm"
        style={{ borderColor: 'var(--divider)', color: 'var(--text-2)' }}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Checking whether {first} can take bookings…
      </div>
    )
  }

  if (status.isError || !status.data) {
    return (
      <div
        role="alert"
        className="rounded-2xl border p-4 text-sm"
        style={{ borderColor: 'var(--divider)', color: 'var(--text-2)' }}
      >
        <p>We could not check this cook’s verification just now.</p>
        <button
          type="button"
          onClick={() => void status.refetch()}
          className="mt-2 min-h-11 rounded-full border px-4 text-sm font-semibold"
          style={{ borderColor: 'var(--divider)', color: 'var(--text-1)' }}
        >
          Try again
        </button>
      </div>
    )
  }

  const data = status.data

  if (data.bookable) {
    return (
      <section
        aria-label={`Booking ${fullName}`}
        className="rounded-2xl border p-4"
        style={{ borderColor: 'var(--divider)', background: 'var(--card)' }}
      >
        <p
          className="flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: 'var(--success)' }}
        >
          <BadgeCheck className="h-4 w-4" aria-hidden="true" />
          {data.label} by Food4Love
        </p>
        {matchId ? (
          <Link
            href={`/bookings/new?cookId=${cookId}&matchId=${matchId}`}
            className="mt-3 flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-white"
            style={{ background: 'var(--accent)' }}
          >
            Book {first}
          </Link>
        ) : (
          <p className="mt-2 text-sm" style={{ color: 'var(--text-2)' }}>
            Match with {first} and start a conversation to book.
          </p>
        )}
      </section>
    )
  }

  return (
    <section
      aria-label={`${fullName} is not available for bookings yet`}
      className="rounded-2xl border p-4"
      style={{ borderColor: 'var(--divider)', background: 'var(--card)' }}
    >
      <p
        className="flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: 'var(--text-1)' }}
      >
        <ShieldAlert
          className="h-4 w-4"
          aria-hidden="true"
          style={{ color: 'var(--accent)' }}
        />
        {data.label}
      </p>
      <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-2)' }}>
        {data.explanation}
      </p>

      {data.interest ? (
        <div
          className="mt-3 rounded-xl p-3 text-sm"
          style={{ background: 'var(--accent-soft)', color: 'var(--text-1)' }}
        >
          <p className="flex items-center gap-1.5 font-semibold">
            <Bell className="h-4 w-4" aria-hidden="true" />
            You asked about {first}
          </p>
          <p className="mt-1" style={{ color: 'var(--text-2)' }}>
            {data.interest.notify_when_verified
              ? `We will let you know when ${first} is verified. This is not a booking and nothing has been charged.`
              : 'You chose not to be notified. This is not a booking and nothing has been charged.'}
          </p>
          <button
            type="button"
            disabled={withdraw.isPending}
            onClick={() => withdraw.mutate()}
            className="mt-2 min-h-11 rounded-full border px-4 text-sm font-semibold disabled:opacity-60"
            style={{ borderColor: 'var(--divider)' }}
          >
            {withdraw.isPending ? 'Withdrawing…' : 'Withdraw my request'}
          </button>
        </div>
      ) : data.can_express_interest ? (
        <div className="mt-3 space-y-3">
          <label
            className="flex items-start gap-3 text-sm"
            style={{ color: 'var(--text-1)' }}
          >
            <input
              type="checkbox"
              checked={notify}
              onChange={(event) => setNotify(event.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
            />
            <span>Let me know when {first} has been verified.</span>
          </label>
          <button
            type="button"
            disabled={ask.isPending}
            onClick={() => ask.mutate()}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: 'var(--accent)' }}
          >
            {ask.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            I’m interested in booking {first}
          </button>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            This only tells {first} that someone is interested. It is not a
            booking and no payment is taken.
          </p>
        </div>
      ) : null}

      <Link
        href="/swipe"
        className="mt-3 flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-semibold"
        style={{ borderColor: 'var(--divider)', color: 'var(--text-1)' }}
      >
        Explore verified cooks
      </Link>
    </section>
  )
}
