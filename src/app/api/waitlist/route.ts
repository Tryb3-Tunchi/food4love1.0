import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { waitlistSignupEmail } from '@/lib/email/templates'
import { sendTransactionalEmail } from '@/lib/email/transactional'
import { clientKey, createLimiter } from '@/lib/rateLimit'

export const runtime = 'nodejs'

// 20 submissions per address per 10 minutes: generous for a shared office or
// campus network, still stops scripted floods from one source.
const allowSignup = createLimiter({ limit: 20, windowMs: 10 * 60 * 1000 })

const waitlistSchema = z.object({
  email: z.string().trim().email().max(254),
  audience: z.enum(['food_lover', 'cook']),
  updatesConsent: z.boolean(),
  website: z.string().max(200).optional(),
})

export async function POST(request: Request) {
  if (!allowSignup(clientKey(request.headers))) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again in a few minutes.' },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = waitlistSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Check the email and try again' },
      { status: 400 },
    )
  }

  if (parsed.data.website) return NextResponse.json({ success: true })

  try {
    const supabase = createAdminClient()
    const normalizedEmail = parsed.data.email.toLowerCase()
    let subscriberId = ''
    let confirmationSentAt: string | null = null
    const { data: inserted, error } = await supabase
      .from('waitlist_subscribers')
      .insert({
        email: normalizedEmail,
        audience: parsed.data.audience,
        updates_consent: parsed.data.updatesConsent,
        consent_at: parsed.data.updatesConsent
          ? new Date().toISOString()
          : null,
        source: 'website',
        unsubscribe_token: randomUUID(),
      })
      .select('id, confirmation_sent_at')
      .single()

    if (inserted) {
      subscriberId = inserted.id
      confirmationSentAt = inserted.confirmation_sent_at
    }

    if (error?.code === '23505') {
      const { data: existing, error: lookupError } = await supabase
        .from('waitlist_subscribers')
        .select('id, confirmation_sent_at')
        .eq('email', normalizedEmail)
        .single()

      if (lookupError || !existing) {
        return NextResponse.json(
          { error: 'Could not save signup' },
          { status: 500 },
        )
      }

      const { error: updateError } = await supabase
        .from('waitlist_subscribers')
        .update({
          audience: parsed.data.audience,
          updates_consent: parsed.data.updatesConsent,
          consent_at: parsed.data.updatesConsent
            ? new Date().toISOString()
            : null,
          unsubscribed_at: null,
        })
        .eq('id', existing.id)

      if (updateError) {
        return NextResponse.json(
          { error: 'Could not save signup' },
          { status: 500 },
        )
      }
      subscriberId = existing.id
      confirmationSentAt = existing.confirmation_sent_at
    }

    if (error && error.code !== '23505') {
      console.error('Waitlist insert failed:', error.code)
      return NextResponse.json(
        { error: 'Could not save signup' },
        { status: 500 },
      )
    }

    if (confirmationSentAt) {
      return NextResponse.json({
        success: true,
        confirmation_email_status: 'already_sent',
      })
    }

    // The signup is already saved. From here on, nothing about the email may
    // turn a successful signup into an error for the visitor.
    const result = await sendTransactionalEmail({
      admin: supabase,
      kind: 'waitlist_confirmation',
      recipientKey: subscriberId,
      to: normalizedEmail,
      email: waitlistSignupEmail(),
    })

    if (result !== 'accepted' && result !== 'already_accepted') {
      // Not sent (provider down, rate limited, or not configured). The row keeps
      // confirmation_sent_at empty, so the next submission or the retry route
      // tries again. Idempotency keys make the retry safe.
      return NextResponse.json({
        success: true,
        confirmation_email_status: 'unavailable',
      })
    }

    // "accepted" means Resend took the message. It does not prove inbox delivery.
    const { error: confirmationUpdateError } = await supabase
      .from('waitlist_subscribers')
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq('id', subscriberId)
      .is('confirmation_sent_at', null)

    return NextResponse.json({
      success: true,
      confirmation_email_status: confirmationUpdateError
        ? 'unavailable'
        : result === 'already_accepted'
          ? 'already_sent'
          : 'sent',
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not save signup' },
      { status: 500 },
    )
  }
}
