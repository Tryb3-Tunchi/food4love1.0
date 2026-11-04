import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { waitlistSignupEmail } from '@/lib/email/templates'

export const runtime = 'nodejs'

const waitlistSchema = z.object({
  email: z.string().trim().email().max(254),
  audience: z.enum(['food_lover', 'cook']),
  updatesConsent: z.boolean(),
  website: z.string().max(200).optional(),
})

export async function POST(request: Request) {
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

    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.WAITLIST_CONFIRMATION_FROM_EMAIL
    if (!resendApiKey || !fromEmail) {
      return NextResponse.json({
        success: true,
        confirmation_email_status: 'unavailable',
      })
    }

    const email = waitlistSignupEmail(parsed.data.audience)
    try {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `waitlist-signup:${subscriberId}`,
        },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          from: fromEmail,
          to: [normalizedEmail],
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      })

      if (!emailResponse.ok) {
        return NextResponse.json({
          success: true,
          confirmation_email_status: 'unavailable',
        })
      }

      const sentAt = new Date().toISOString()
      const { error: confirmationUpdateError } = await supabase
        .from('waitlist_subscribers')
        .update({ confirmation_sent_at: sentAt })
        .eq('id', subscriberId)
        .is('confirmation_sent_at', null)

      return NextResponse.json({
        success: true,
        confirmation_email_status: confirmationUpdateError
          ? 'unavailable'
          : 'sent',
      })
    } catch {
      return NextResponse.json({
        success: true,
        confirmation_email_status: 'unavailable',
      })
    }
  } catch {
    return NextResponse.json(
      { error: 'Could not save signup' },
      { status: 500 },
    )
  }
}
