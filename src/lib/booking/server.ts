import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Notice, Actor } from '@/lib/booking/lifecycle'
import { bookingEmailContent, bookingUrl } from '@/lib/booking/email'

// The booking history and notification helpers used by every booking route.
// Everything here is best effort around the main action: a failure to write a history
// row, an in-app notification or an email must never undo or block the booking itself.

// True when the database does not have a column/table/function yet (the booking
// migration is not applied). The routes then fall back to the older behaviour.
export function isMissingSchema(
  error: {
    code?: string
    message?: string
  } | null,
): boolean {
  if (!error) return false
  return (
    ['PGRST204', 'PGRST205', 'PGRST202', '42703', '42P01', '42883'].includes(
      error.code ?? '',
    ) ||
    /could not find the .* column|does not exist/i.test(error.message ?? '')
  )
}

export async function recordBookingEvent(
  admin: SupabaseClient,
  event: {
    bookingId: string
    actorId: string | null
    actorRole: Actor | 'admin' | 'system'
    action: string
    from?: string | null
    to?: string | null
    note?: string | null
  },
) {
  try {
    await admin.from('booking_events').insert({
      booking_id: event.bookingId,
      actor_id: event.actorId,
      actor_role: event.actorRole,
      action: event.action,
      from_status: event.from ?? null,
      to_status: event.to ?? null,
      note: event.note?.slice(0, 500) ?? null,
    })
  } catch {
    // history unavailable (migration not applied): the booking still stands
  }
}

// Sends one email through Resend if (and only if) it is configured. Never throws.
async function sendEmail(input: {
  to: string
  subject: string
  html: string
  text: string
  key: string
}): Promise<'sent' | 'unavailable'> {
  const apiKey = process.env.RESEND_API_KEY
  const from =
    process.env.BOOKING_FROM_EMAIL ||
    process.env.ACCOUNT_UPDATES_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) return 'unavailable'
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // the same event can never email the same person twice
        'Idempotency-Key': input.key.slice(0, 200),
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    })
    return response.ok ? 'sent' : 'unavailable'
  } catch {
    return 'unavailable'
  }
}

// One in-app notification (and, if configured and wanted, one email) per booking event.
export async function notifyBookingParty(
  admin: SupabaseClient,
  input: {
    userId: string
    notice: Notice
    bookingId: string
    eventKey: string
  },
) {
  try {
    const { error } = await admin.from('notifications').insert({
      user_id: input.userId,
      type: 'booking',
      title: input.notice.title,
      body: input.notice.body,
      data: { booking_id: input.bookingId, event_key: input.eventKey },
    })
    // 23505: this exact event was already announced; send nothing more.
    if (error?.code === '23505') return
  } catch {
    return
  }

  try {
    const url = bookingUrl(process.env.NEXT_PUBLIC_APP_URL, input.bookingId)
    if (!url) return
    const { data: profile } = await admin
      .from('profiles')
      .select('notification_preferences')
      .eq('id', input.userId)
      .maybeSingle()
    const prefs = profile?.notification_preferences as
      { bookings?: boolean } | null | undefined
    if (prefs?.bookings === false) return // the member turned booking updates off
    const { data: authUser } = await admin.auth.admin.getUserById(input.userId)
    const to = authUser?.user?.email
    if (!to) return
    const content = bookingEmailContent({
      title: input.notice.title,
      body: input.notice.body,
      url,
    })
    await sendEmail({ to, ...content, key: input.eventKey })
  } catch {
    // email is a convenience on top of the in-app notification
  }
}
