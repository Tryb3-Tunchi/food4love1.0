import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

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
    return NextResponse.json({ error: 'Check the email and try again' }, { status: 400 })
  }

  if (parsed.data.website) return NextResponse.json({ success: true })

  try {
    const supabase = await createClient()
    const { error } = await supabase.from('waitlist_subscribers').insert({
      email: parsed.data.email.toLowerCase(),
      audience: parsed.data.audience,
      updates_consent: parsed.data.updatesConsent,
      source: 'website',
    })

    if (error && error.code !== '23505') {
      console.error('Waitlist insert failed:', error.code)
      return NextResponse.json({ error: 'Could not save signup' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Could not save signup' }, { status: 500 })
  }
}