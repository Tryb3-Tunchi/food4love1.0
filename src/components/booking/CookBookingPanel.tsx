'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Bell, Loader2, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  INTEREST_FAILED_MESSAGE,
  INTEREST_SAVED_MESSAGE,
} from '@/lib/booking/interestCopy'

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

const SIGNED_OUT = 'signed_out'

async function fetchStatus(cookId: string): Promise<BookingStatusResponse> {
  const response = await fetch(`/api/booking-status?cook_id=${cookId}`, {
    cache: 'no-store',
  })
  if (response.status === 401) throw new Error(SIGNED_OUT)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Could not load')
  return body as BookingStatusResponse
}

interface AskResult {
  message: string
  duplicate: boolean
}

// What a customer sees about a cook's availability for booking, wherever it is shown
// (chat, booking page). The server decides; this only displays it. A verified cook shows
// a Book button; anyone else shows why, plus the choices that do NOT create a booking:
// ask to be told when the cook is verified, or look at verified cooks.
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
  // The answer to the last press, shown in a polite live region (not only a toast, which a
  // screen reader may never announce).
  const [feedback, setFeedback] = useState<{
    tone: 'ok' | 'bad'
    text: string
  } | null>(null)

  const status = useQuery({
    queryKey: ['booking-status', cookId],
    queryFn: () => fetchStatus(cookId),
    staleTime: 15_000,
    retry: (count, error) => error.message !== SIGNED_OUT && count < 2,
  })

  // The press itself is the customer's consent to be notified, so the button says exactly
  // that. (It used to be a separate unticked checkbox plus a button labelled "I'm
  // interested", and pressing the button alone silently saved "do not notify".)
  const ask = useMutation({
    mutationFn: async (): Promise<AskResult> => {
      let response: Response
      try {
        response = await fetch('/api/booking-interests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cook_id: cookId, notify_when_verified: true }),
        })
      } catch {
        throw new Error(INTEREST_FAILED_MESSAGE)
      }
      const body = await response.json().catch(() => ({}))
      if (response.status === 401) throw new Error(SIGNED_OUT)
      if (!response.ok) throw new Error(body.error || INTEREST_FAILED_MESSAGE)
      return {
        message: body.message || INTEREST_SAVED_MESSAGE,
        duplicate: !!body.duplicate,
      }
    },
    onMutate: () => setFeedback(null),
    onSuccess: (result) => {
      setFeedback({ tone: 'ok', text: result.message })
      toast.success(
        result.duplicate ? 'Already on your list' : 'You’re on the list!',
      )
      void queryClient.invalidateQueries({
        queryKey: ['booking-status', cookId],
      })
    },
    onError: (error: Error) => {
      if (error.message === SIGNED_OUT) {
        void queryClient.invalidateQueries({
          queryKey: ['booking-status', cookId],
        })
        return
      }
      // Never pretend it worked. The button stays enabled so they can simply try again.
      setFeedback({
        tone: 'bad',
        text: error.message || INTEREST_FAILED_MESSAGE,
      })
    },
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
      setFeedback(null)
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

  // The session ended while the page was open. Keep them where they are: sign in, then
  // come straight back here.
  if (status.error?.message === SIGNED_OUT) {
    const here =
      typeof window === 'undefined'
        ? '/swipe'
        : `${window.location.pathname}${window.location.search}`
    return (
      <div
        className="rounded-2xl border p-4 text-sm"
        style={{ borderColor: 'var(--divider)', color: 'var(--text-2)' }}
      >
        <p>Sign in to be notified when {first} is verified.</p>
        <Link
          href={`/login?next=${encodeURIComponent(here)}`}
          className="mt-3 flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-white"
          style={{ background: 'var(--accent)' }}
        >
          Sign in
        </Link>
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

  const interest = data.interest
  const notifyButton = (
    <button
      type="button"
      disabled={ask.isPending}
      onClick={() => ask.mutate()}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-bold text-white disabled:opacity-60"
      style={{ background: 'var(--accent)' }}
    >
      {ask.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Bell className="h-4 w-4" aria-hidden="true" />
      )}
      {ask.isPending ? 'Saving…' : `Notify me when ${first} is verified`}
    </button>
  )

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

      {interest ? (
        <div
          className="mt-3 rounded-xl p-3 text-sm"
          style={{ background: 'var(--accent-soft)', color: 'var(--text-1)' }}
        >
          <p className="flex items-center gap-1.5 font-semibold">
            <Bell className="h-4 w-4" aria-hidden="true" />
            {interest.notify_when_verified
              ? 'You’re on the list'
              : `You asked about ${first}`}
          </p>
          <p className="mt-1" style={{ color: 'var(--text-2)' }}>
            {interest.notify_when_verified
              ? `We’ll let you know as soon as ${first} is verified. This is not a booking and nothing has been charged.`
              : 'Notifications are off for this request. This is not a booking and nothing has been charged.'}
          </p>
          {!interest.notify_when_verified && (
            <div className="mt-3">{notifyButton}</div>
          )}
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
          {notifyButton}
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            We’ll tell you once, in the app and by email, when {first} is
            verified. This is not a booking and no payment is taken.
          </p>
        </div>
      ) : null}

      {/* Announced to screen readers and visible to everyone. Not a toast alone. */}
      <div role="status" aria-live="polite" className="mt-3 empty:mt-0">
        {feedback && (
          <p
            className="rounded-xl px-3 py-2 text-sm font-medium"
            style={{
              background:
                feedback.tone === 'ok'
                  ? 'var(--accent-soft)'
                  : 'rgba(207,80,70,0.1)',
              color: feedback.tone === 'ok' ? 'var(--text-1)' : 'var(--danger)',
            }}
          >
            {feedback.text}
          </p>
        )}
      </div>

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
