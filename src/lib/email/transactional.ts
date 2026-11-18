import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { parseRetryAfterMs } from '@/lib/email/retryPolicy'

type Admin = ReturnType<typeof createAdminClient>

export type EmailKind =
  | 'waitlist_confirmation'
  | 'welcome'
  | 'interest_verified'
  | 'tester_invitation'
  | 'password_recovery'

// queued     = we decided to send, Resend has not answered yet
// processing = one worker has claimed it and is sending right now
// accepted   = Resend accepted the message (this is NOT proof of inbox delivery)
// failed     = Resend refused it or could not be reached; safe to retry
// cancelled  = deliberately not sent (no consent, cook no longer verified, ...)
// delivered / bounced come from the Resend webhook.
export type EmailStatus =
  | 'queued'
  | 'processing'
  | 'accepted'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'cancelled'

export type SendResult =
  | 'accepted'
  | 'already_accepted'
  | 'failed'
  | 'unavailable'
  | 'gave_up'
  | 'cancelled'

export const MAX_ATTEMPTS = 5

export function senderFor(kind: EmailKind) {
  // Existing variable names, in order of preference. Values are never logged.
  const candidatesByKind: Record<EmailKind, (string | undefined)[]> = {
    welcome: [
      process.env.WELCOME_FROM_EMAIL,
      process.env.WAITLIST_CONFIRMATION_FROM_EMAIL,
      process.env.RESEND_FROM_EMAIL,
    ],
    waitlist_confirmation: [
      process.env.WAITLIST_CONFIRMATION_FROM_EMAIL,
      process.env.RESEND_FROM_EMAIL,
    ],
    // a booking-related update: same sender as the booking emails
    interest_verified: [
      process.env.BOOKING_FROM_EMAIL,
      process.env.ACCOUNT_UPDATES_FROM_EMAIL,
      process.env.RESEND_FROM_EMAIL,
    ],
    // a security message about the account: account-updates sender first
    password_recovery: [
      process.env.ACCOUNT_UPDATES_FROM_EMAIL,
      process.env.RESEND_FROM_EMAIL,
      process.env.WELCOME_FROM_EMAIL,
    ],
    // a personal "hello" from the team, like the welcome email
    tester_invitation: [
      process.env.WELCOME_FROM_EMAIL,
      process.env.ACCOUNT_UPDATES_FROM_EMAIL,
      process.env.RESEND_FROM_EMAIL,
    ],
  }
  return candidatesByKind[kind].find((value) => !!value) ?? null
}

interface Tracked {
  status: EmailStatus
  attempts: number
}

// Reads (or creates) the tracking row. Returns null when the table does not
// exist yet (migration not applied) so sending still works, just untracked.
async function loadTracking(
  admin: Admin,
  kind: EmailKind,
  recipientKey: string,
): Promise<Tracked | null | 'unavailable'> {
  const { error: insertError } = await admin
    .from('email_deliveries')
    .upsert(
      { kind, recipient_key: recipientKey, status: 'queued' },
      { onConflict: 'kind,recipient_key', ignoreDuplicates: true },
    )
  if (insertError) return 'unavailable'

  const { data, error } = await admin
    .from('email_deliveries')
    .select('status, attempts')
    .eq('kind', kind)
    .eq('recipient_key', recipientKey)
    .maybeSingle()
  if (error || !data) return 'unavailable'
  return { status: data.status as EmailStatus, attempts: data.attempts ?? 0 }
}

export async function sendTransactionalEmail(input: {
  admin: Admin
  kind: EmailKind
  recipientKey: string
  to: string
  email: { subject: string; html: string; text: string }
  // Optional (new email kinds only). Given the number of failed attempts so far, returns
  // the delay in ms before the next try, or null to give up. The answer is stored in
  // email_deliveries.next_attempt_at so the schedule survives a server restart. Left out
  // for the older kinds so they never touch a column an older database may not have.
  // `failure` says why the attempt failed (stored error code, and the provider's own
  // Retry-After hint) so the policy can stop at once for a request that can never succeed.
  scheduleRetry?: (
    attemptsMade: number,
    failure: { errorCode: string | null; retryAfterMs: number | null },
  ) => number | null
}): Promise<SendResult> {
  const { admin, kind, recipientKey, to, email, scheduleRetry } = input
  const apiKey = process.env.RESEND_API_KEY
  const from = senderFor(kind)
  if (!apiKey || !from) return 'unavailable'

  const tracked = await loadTracking(admin, kind, recipientKey)
  if (tracked && tracked !== 'unavailable') {
    if (tracked.status === 'accepted' || tracked.status === 'delivered') {
      return 'already_accepted'
    }
    if (tracked.status === 'cancelled') return 'cancelled'
    if (tracked.attempts >= MAX_ATTEMPTS) return 'gave_up'
  }

  let status: EmailStatus = 'failed'
  let providerId: string | null = null
  let errorCode: string | null = null
  let retryAfterMs: number | null = null

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Resend ignores a repeat of the same key for 24 hours, so a double
        // click, a retry or a duplicate event cannot send a second email.
        'Idempotency-Key': `${kind}:${recipientKey}`,
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        from,
        to: [to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    })

    if (response.ok) {
      status = 'accepted'
      const body = (await response.json().catch(() => null)) as {
        id?: string
      } | null
      providerId = body?.id ?? null
    } else {
      // 429 = rate limited, 4xx/5xx = provider refused. Only the code is kept.
      errorCode = `http_${response.status}`
      retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'))
    }
  } catch (error) {
    errorCode =
      error instanceof Error && error.name === 'TimeoutError'
        ? 'timeout'
        : 'network'
  }

  if (tracked !== 'unavailable' && tracked !== null) {
    const attemptsMade = tracked.attempts + 1
    const update: Record<string, unknown> = {
      status,
      attempts: attemptsMade,
      provider_message_id: providerId,
      last_error_code: errorCode,
      updated_at: new Date().toISOString(),
    }
    if (scheduleRetry) {
      const delay =
        status === 'accepted'
          ? null
          : scheduleRetry(attemptsMade, { errorCode, retryAfterMs })
      update.next_attempt_at =
        delay === null ? null : new Date(Date.now() + delay).toISOString()
    }
    await admin
      .from('email_deliveries')
      .update(update)
      .eq('kind', kind)
      .eq('recipient_key', recipientKey)
  }

  if (status !== 'accepted') {
    console.error(`Email ${kind} not sent: ${errorCode}`)
    return 'failed'
  }
  return 'accepted'
}
