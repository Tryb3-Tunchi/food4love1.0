import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { adultStates } from '@/lib/adultCheck'
import { AGE_REQUIRED_CODE, AGE_REQUIRED_MESSAGE } from '@/lib/ageGate'
import { clientKey, createLimiter } from '@/lib/rateLimit'
import { canExpressInterest } from '@/lib/booking/verification'
import { isMissingSchema } from '@/lib/booking/server'

// "Tell me when this cook is available."
//
// An interest request is NOT a booking: it creates no booking, no payment and no
// confirmation, and it cannot be used to get around the verification rule. It lives in
// its own table. The customer sees only their own requests; the cook is told that
// someone is interested but never who.

const createSchema = z.object({
  cook_id: z.string().uuid(),
  // true only when the customer explicitly asked to be told; never assumed
  notify_when_verified: z.boolean(),
})
const withdrawSchema = z.object({ cook_id: z.string().uuid() })

const allow = createLimiter({ limit: 10, windowMs: 60 * 60 * 1000 })

async function currentUser() {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  return user
}

const unavailable = () =>
  NextResponse.json(
    { error: 'Interest requests are not available yet.' },
    { status: 503 },
  )

export async function GET() {
  const user = await currentUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('booking_interests')
    .select(
      'id, cook_id, status, notify_when_verified, created_at, cook:profiles!booking_interests_cook_id_fkey(full_name, avatar_url)',
    )
    .eq('customer_id', user.id) // own rows only
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    if (isMissingSchema(error)) return NextResponse.json({ interests: [] })
    return NextResponse.json(
      { error: 'Could not load requests' },
      { status: 500 },
    )
  }
  return NextResponse.json({ interests: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await currentUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!allow(`${user.id}:${clientKey(request.headers)}`)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    )
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { cook_id: cookId, notify_when_verified: notify } = parsed.data
  if (cookId === user.id)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const admin = createAdminClient()
  const [{ data: customer }, { data: cook }] = await Promise.all([
    admin
      .from('profiles')
      .select('role, suspended, onboarding_complete')
      .eq('id', user.id)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('role, suspended, kyc_status, onboarding_complete')
      .eq('id', cookId)
      .maybeSingle(),
  ])
  if (
    !customer ||
    customer.role !== 'buyer' ||
    customer.suspended ||
    !customer.onboarding_complete
  ) {
    return NextResponse.json(
      { error: 'Your account is not eligible' },
      { status: 403 },
    )
  }
  // Same adult rule as matching and booking.
  const adults = await adultStates(admin, [user.id])
  if (adults.get(user.id) === 'required') {
    return NextResponse.json(
      { error: AGE_REQUIRED_MESSAGE, code: AGE_REQUIRED_CODE },
      { status: 403 },
    )
  }

  const eligible = canExpressInterest(cook)
  if (!eligible.ok) {
    return NextResponse.json(
      {
        error:
          eligible.reason === 'already_bookable'
            ? 'This cook is verified now. You can book them directly.'
            : 'This cook is not available for interest requests.',
        code: eligible.reason,
      },
      { status: eligible.reason === 'already_bookable' ? 409 : 400 },
    )
  }

  // Do not let a withdraw-and-ask-again loop pester the cook.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recent, error: recentError } = await admin
    .from('booking_interests')
    .select('id')
    .eq('customer_id', user.id)
    .eq('cook_id', cookId)
    .gt('created_at', dayAgo)
    .limit(1)
  if (recentError && isMissingSchema(recentError)) return unavailable()
  if (recent && recent.length > 0) {
    return NextResponse.json(
      {
        error:
          'You already asked about this cook recently. We will let you know when something changes.',
        code: 'already_requested',
      },
      { status: 409 },
    )
  }

  const { data: created, error } = await admin
    .from('booking_interests')
    .insert({
      customer_id: user.id,
      cook_id: cookId,
      notify_when_verified: notify,
    })
    .select('id, status, notify_when_verified, created_at')
    .single()
  if (error || !created) {
    if (error && isMissingSchema(error)) return unavailable()
    if (error?.code === '23505') {
      return NextResponse.json(
        {
          error: 'You already asked about this cook.',
          code: 'already_requested',
        },
        { status: 409 },
      )
    }
    if (/already be booked/i.test(error?.message ?? '')) {
      return NextResponse.json(
        {
          error: 'This cook is verified now. You can book them directly.',
          code: 'already_bookable',
        },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: 'Could not save your request' },
      { status: 500 },
    )
  }

  // Tell the cook that someone is interested, without saying who.
  try {
    await admin.from('notifications').insert({
      user_id: cookId,
      type: 'booking',
      title: 'A food lover is interested in booking you',
      body: 'Someone would like to book you once you are verified. Finish verification so they can.',
      data: { kind: 'interest', event_key: `interest:${created.id}:created` },
    })
    await admin
      .from('booking_interests')
      .update({ cook_notified_at: new Date().toISOString() })
      .eq('id', created.id)
  } catch {
    // the request is saved even if the notification could not be written
  }

  return NextResponse.json({ interest: created }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const user = await currentUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = withdrawSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('booking_interests')
    .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
    .eq('customer_id', user.id) // can only withdraw your own
    .eq('cook_id', parsed.data.cook_id)
    .eq('status', 'active')
    .select('id')
  if (error) {
    if (isMissingSchema(error)) return unavailable()
    return NextResponse.json({ error: 'Could not withdraw' }, { status: 500 })
  }
  if (!data || data.length === 0)
    return NextResponse.json(
      { error: 'No active request found' },
      { status: 404 },
    )
  return NextResponse.json({ withdrawn: true })
}
