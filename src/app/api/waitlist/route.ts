import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

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
    const { error } = await supabase.from('waitlist_subscribers').insert({
      email: normalizedEmail,
      audience: parsed.data.audience,
      updates_consent: parsed.data.updatesConsent,
      consent_at: parsed.data.updatesConsent ? new Date().toISOString() : null,
      source: 'website',
      unsubscribe_token: randomUUID(),
    })

    if (error?.code === '23505') {
      const { data: existing, error: lookupError } = await supabase
        .from('waitlist_subscribers')
        .select('id')
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

      return NextResponse.json({ success: true })
    }

    if (error) {
      console.error('Waitlist insert failed:', error.code)
      return NextResponse.json(
        { error: 'Could not save signup' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Could not save signup' },
      { status: 500 },
    )
  }
}
