import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientKey, createLimiter } from '@/lib/rateLimit'
import { MINIMUM_AGE } from '@/lib/ageGate'

export const runtime = 'nodejs'

// The member declares they are an adult. Only the server may write the field (a
// database trigger blocks the member's own client from setting it), and it is
// written once: confirming again never moves the original date.
const allow = createLimiter({ limit: 10, windowMs: 10 * 60 * 1000 })
const bodySchema = z.object({ confirmed: z.literal(true) })

export async function POST(request: Request) {
  if (!allow(clientKey(request.headers))) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: `You must confirm that you are ${MINIMUM_AGE} or older` },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('profiles')
    .update({ age_confirmed_at: now })
    .eq('id', user.id)
    .is('age_confirmed_at', null)
    .select('age_confirmed_at')
    .maybeSingle()

  if (error) {
    // 42703 / PGRST204: the column does not exist yet (migration not applied).
    return NextResponse.json(
      { error: 'Age confirmation is not available yet' },
      { status: 503 },
    )
  }
  if (data)
    return NextResponse.json({
      confirmed: true,
      age_confirmed_at: data.age_confirmed_at,
    })

  // Nothing updated: either already confirmed (fine) or there is no profile.
  const { data: existing } = await admin
    .from('profiles')
    .select('age_confirmed_at')
    .eq('id', user.id)
    .maybeSingle()
  if (!existing)
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  return NextResponse.json({
    confirmed: true,
    age_confirmed_at: existing.age_confirmed_at,
  })
}
