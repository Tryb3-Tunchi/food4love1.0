import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logOpsEvent } from '@/lib/admin/ops'
import { verifySvixSignature } from '@/lib/admin/intelligence/webhookSignature'

export const runtime = 'nodejs'

// Resend tells us what happened to an email after it was accepted: delivered,
// bounced, marked as spam. Every call is signature-checked, so only genuine
// Resend events can change anything. No email addresses are stored.
const STATUS_FOR_EVENT: Record<string, 'delivered' | 'bounced'> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 503 },
    )
  }

  const body = await request.text()
  if (body.length > 20_000) {
    return NextResponse.json({ error: 'Too large' }, { status: 413 })
  }
  const valid = verifySvixSignature({
    id: request.headers.get('svix-id'),
    timestamp: request.headers.get('svix-timestamp'),
    signatureHeader: request.headers.get('svix-signature'),
    body,
    secret,
  })
  if (!valid)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })

  let event: {
    type?: string
    created_at?: string
    data?: { email_id?: string }
  }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const type = typeof event.type === 'string' ? event.type.slice(0, 40) : null
  const messageId =
    typeof event.data?.email_id === 'string' ? event.data.email_id : null
  const eventId = request.headers.get('svix-id')
  if (!type || !eventId) return NextResponse.json({ ok: true })

  try {
    const admin = createAdminClient()
    // The unique webhook id makes a replayed delivery harmless.
    const { error } = await admin.from('email_events').upsert(
      {
        provider_event_id: eventId,
        provider_message_id: messageId,
        event_type: type,
        occurred_at: event.created_at ?? new Date().toISOString(),
      },
      { onConflict: 'provider_event_id', ignoreDuplicates: true },
    )
    if (error) return NextResponse.json({ ok: true }) // table not applied yet

    const next = STATUS_FOR_EVENT[type]
    if (next && messageId) {
      await admin
        .from('email_deliveries')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('provider_message_id', messageId)
        // Never move a bounced email back to delivered because of a late event.
        .neq('status', 'bounced')
    }
    if (type === 'email.bounced' || type === 'email.complained') {
      await logOpsEvent({
        severity: 'warning',
        service: 'email',
        code: type,
        summary: `Resend reported ${type.replace('email.', '')} for a message`,
      })
    }
  } catch {
    // Always answer 200 so Resend does not retry endlessly on our own faults.
  }
  return NextResponse.json({ ok: true })
}
