import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export type EmailKind = 'waitlist_confirmation' | 'welcome'

// queued    = we decided to send, Resend has not answered yet
// accepted  = Resend accepted the message (this is NOT proof of inbox delivery)
// failed    = Resend refused it or could not be reached; safe to retry
// delivered / bounced are reserved for a future Resend webhook.
export type EmailStatus =
  'queued' | 'accepted' | 'delivered' | 'bounced' | 'failed'

export type SendResult =
  'accepted' | 'already_accepted' | 'failed' | 'unavailable' | 'gave_up'

export const MAX_ATTEMPTS = 5

export function senderFor(kind: EmailKind) {
  // Existing variable names, in order of preference. Values are never logged.
  const candidates =
    kind === 'welcome'
      ? [
          process.env.WELCOME_FROM_EMAIL,
          process.env.WAITLIST_CONFIRMATION_FROM_EMAIL,
          process.env.RESEND_FROM_EMAIL,
        ]
      : [
          process.env.WAITLIST_CONFIRMATION_FROM_EMAIL,
          process.env.RESEND_FROM_EMAIL,
        ]
  return candidates.find((value) => !!value) ?? null
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
}): Promise<SendResult> {
  const { admin, kind, recipientKey, to, email } = input
  const apiKey = process.env.RESEND_API_KEY
  const from = senderFor(kind)
  if (!apiKey || !from) return 'unavailable'

  const tracked = await loadTracking(admin, kind, recipientKey)
  if (tracked && tracked !== 'unavailable') {
    if (tracked.status === 'accepted' || tracked.status === 'delivered') {
      return 'already_accepted'
    }
    if (tracked.attempts >= MAX_ATTEMPTS) return 'gave_up'
  }

  let status: EmailStatus = 'failed'
  let providerId: string | null = null
  let errorCode: string | null = null

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
    }
  } catch (error) {
    errorCode =
      error instanceof Error && error.name === 'TimeoutError'
        ? 'timeout'
        : 'network'
  }

  if (tracked !== 'unavailable' && tracked !== null) {
    await admin
      .from('email_deliveries')
      .update({
        status,
        attempts: tracked.attempts + 1,
        provider_message_id: providerId,
        last_error_code: errorCode,
        updated_at: new Date().toISOString(),
      })
      .eq('kind', kind)
      .eq('recipient_key', recipientKey)
  }

  if (status !== 'accepted') {
    console.error(`Email ${kind} not sent: ${errorCode}`)
    return 'failed'
  }
  return 'accepted'
}
