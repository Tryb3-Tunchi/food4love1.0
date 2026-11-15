'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { actOnBooking, type Booking } from '@/services/bookings'
import {
  applyAction,
  type Actor,
  type BookingAction,
} from '@/lib/booking/lifecycle'
import {
  DECLINE_KEYS,
  DECLINE_LABELS,
  type DeclineReason,
} from '@/lib/bookingDecline'
import { formatLagos, validateSchedule } from '@/lib/booking/details'

type Mode = null | 'decline' | 'propose' | 'cancel'

const button =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-bold transition disabled:cursor-not-allowed disabled:opacity-50'

// Only the actions the lifecycle rules allow for THIS person on THIS booking are shown
// (the same rules the server enforces, so a button never appears for a move the server
// would refuse). Every action goes through the server; nothing here changes data itself.
export function BookingActions({
  booking,
  viewer,
  onChanged,
}: {
  booking: Booking
  viewer: Actor
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<BookingAction | null>(null)
  const [mode, setMode] = useState<Mode>(null)
  const [reason, setReason] = useState<DeclineReason>('booked')
  const [note, setNote] = useState('')
  const [when, setWhen] = useState('')
  const [whenError, setWhenError] = useState('')

  const state = {
    status: booking.status,
    payment_status: booking.payment_status,
  }
  const can = (action: BookingAction) => applyAction(state, viewer, action).ok

  async function run(
    action: BookingAction,
    input: Parameters<typeof actOnBooking>[1],
    success: string,
  ) {
    setBusy(action)
    try {
      await actOnBooking(booking.id, input)
      toast.success(success)
      setMode(null)
      setNote('')
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update')
      onChanged() // the booking may have changed in the meantime
    } finally {
      setBusy(null)
    }
  }

  function sendAlternative() {
    const proposed = when ? new Date(when) : null
    const result = proposed
      ? validateSchedule(proposed)
      : ({ ok: false, reason: 'Choose a date and time.' } as const)
    if (!result.ok) {
      setWhenError(result.reason)
      return
    }
    setWhenError('')
    void run(
      'propose_alternative',
      {
        action: 'propose_alternative',
        proposed_at: proposed!.toISOString(),
        note: note.trim() || undefined,
      },
      'Suggestion sent',
    )
  }

  const cannotCancelBecausePaid =
    booking.payment_status === 'paid' &&
    ['pending', 'alternative_proposed', 'confirmed'].includes(booking.status)

  return (
    <div className="space-y-3">
      {/* The customer must answer a suggested time */}
      {booking.status === 'alternative_proposed' &&
        booking.proposed_scheduled_for && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
            <p className="font-semibold text-[var(--text)]">
              Suggested time: {formatLagos(booking.proposed_scheduled_for)}
            </p>
            {booking.proposed_note && (
              <p className="mt-1 text-[var(--text-muted)]">
                {booking.proposed_note}
              </p>
            )}
          </div>
        )}

      {can('accept') && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            run('accept', { action: 'accept' }, 'Booking accepted')
          }
          className={`${button} bg-[var(--primary)] text-white shadow-lg`}
        >
          {busy === 'accept' && (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          )}
          Accept booking
        </button>
      )}

      {can('accept_alternative') && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            run(
              'accept_alternative',
              { action: 'accept_alternative' },
              'New time accepted',
            )
          }
          className={`${button} bg-[var(--primary)] text-white shadow-lg`}
        >
          {busy === 'accept_alternative' && (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          )}
          Accept the new time
        </button>
      )}
      {can('decline_alternative') && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            run(
              'decline_alternative',
              { action: 'decline_alternative' },
              'New time declined',
            )
          }
          className={`${button} border border-[var(--border)] text-[var(--text)]`}
        >
          Decline the new time
        </button>
      )}

      {can('propose_alternative') && mode !== 'propose' && (
        <button
          type="button"
          onClick={() => setMode('propose')}
          className={`${button} border border-[var(--border)] text-[var(--text)]`}
        >
          Suggest another time
        </button>
      )}
      {mode === 'propose' && (
        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <label
            htmlFor="alt-time"
            className="text-sm font-semibold text-[var(--text)]"
          >
            New date and time
          </label>
          <input
            id="alt-time"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            aria-invalid={!!whenError}
            aria-describedby={whenError ? 'alt-time-error' : undefined}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[var(--text)]"
          />
          {whenError && (
            <p
              id="alt-time-error"
              role="alert"
              className="text-sm text-red-600"
            >
              {whenError}
            </p>
          )}
          <label
            htmlFor="alt-note"
            className="text-sm font-semibold text-[var(--text)]"
          >
            Message (optional)
          </label>
          <textarea
            id="alt-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            rows={2}
            className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[var(--text)]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={sendAlternative}
              className={`${button} bg-[var(--primary)] text-white`}
            >
              {busy === 'propose_alternative' && (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              )}
              Send suggestion
            </button>
            <button
              type="button"
              onClick={() => setMode(null)}
              className={`${button} border border-[var(--border)] text-[var(--text)]`}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {can('decline') && mode !== 'decline' && (
        <button
          type="button"
          onClick={() => setMode('decline')}
          className={`${button} border border-[var(--border)] text-[var(--text)]`}
        >
          Decline
        </button>
      )}
      {mode === 'decline' && (
        <fieldset className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <legend className="px-1 text-sm font-semibold text-[var(--text)]">
            Why can’t you take it?
          </legend>
          {DECLINE_KEYS.map((key) => (
            <label
              key={key}
              className="flex min-h-11 items-center gap-3 text-sm text-[var(--text)]"
            >
              <input
                type="radio"
                name="decline-reason"
                checked={reason === key}
                onChange={() => setReason(key)}
                className="h-5 w-5 accent-[var(--primary)]"
              />
              {DECLINE_LABELS[key]}
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                run(
                  'decline',
                  { action: 'decline', reason },
                  'Booking declined',
                )
              }
              className={`${button} bg-red-600 text-white`}
            >
              {busy === 'decline' && (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              )}
              Decline booking
            </button>
            <button
              type="button"
              onClick={() => setMode(null)}
              className={`${button} border border-[var(--border)] text-[var(--text)]`}
            >
              Back
            </button>
          </div>
        </fieldset>
      )}

      {can('complete') && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            run('complete', { action: 'complete' }, 'Marked as completed')
          }
          className={`${button} bg-[var(--primary)] text-white shadow-lg`}
        >
          {busy === 'complete' && (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          )}
          Mark as completed
        </button>
      )}

      {/* A cook answering a pending request uses Decline; Cancel is for everything else */}
      {can('cancel') && !can('decline') && mode !== 'cancel' && (
        <button
          type="button"
          onClick={() => setMode('cancel')}
          className={`${button} border border-[var(--border)] text-[var(--text)]`}
        >
          Cancel booking
        </button>
      )}
      {mode === 'cancel' && (
        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm text-[var(--text)]">
            Cancel this booking? The other person will be told.
          </p>
          <label htmlFor="cancel-reason" className="sr-only">
            Reason (optional)
          </label>
          <textarea
            id="cancel-reason"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason (optional)"
            maxLength={300}
            rows={2}
            className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-[var(--text)]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                run(
                  'cancel',
                  { action: 'cancel', reason: note.trim() || undefined },
                  'Booking cancelled',
                )
              }
              className={`${button} bg-red-600 text-white`}
            >
              {busy === 'cancel' && (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              )}
              Yes, cancel it
            </button>
            <button
              type="button"
              onClick={() => setMode(null)}
              className={`${button} border border-[var(--border)] text-[var(--text)]`}
            >
              Keep it
            </button>
          </div>
        </div>
      )}

      {cannotCancelBecausePaid && (
        <p className="text-center text-xs text-[var(--text-muted)]">
          This booking is paid. To cancel it and arrange a refund, contact
          Food4Love support from the Support page.
        </p>
      )}
    </div>
  )
}
