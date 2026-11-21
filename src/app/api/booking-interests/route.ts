import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { adultStates } from '@/lib/adultCheck'
import { AGE_REQUIRED_CODE, AGE_REQUIRED_MESSAGE } from '@/lib/ageGate'
import { clientKey, createLimiter } from '@/lib/rateLimit'
import { canExpressInterest } from '@/lib/booking/verification'
import { isMissingSchema } from '@/lib/booking/server'
import {
  INTEREST_DUPLICATE_MESSAGE,
  INTEREST_FAILED_MESSAGE,
  INTEREST_SAVED_MESSAGE,
} from '@/lib/booking/interestCopy'

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

// A burst brake per server instance (it counts every press, repeats included). The policy
// that holds across instances is the database count of new requests per hour below; this
// is kept in line with it so a person is never blocked by one limit while allowed by the other.
const allow = createLimiter({ limit: 20, windowMs: 60 * 60 * 1000 })

async function currentUser() {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  return user
}

// The customer always sees the same plain message. The cause goes to the server log, where
// the team can act on it, instead of being invented for the customer.
const failed = () =>
  NextResponse.json(
    { error: INTEREST_FAILED_MESSAGE, code: 'save_failed' },
    { status: 500 },
  )

// The table does not exist, so the booking migration has not been applied to this database.
const unavailable = () => {
  console.error(
    'booking_interests is missing: run supabase-migration-booking-verification.sql',
  )
  return NextResponse.json(
    { error: INTEREST_FAILED_MESSAGE, code: 'unavailable' },
    { status: 503 },
  )
}

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

  // Already on the list? Then this is a repeat. Say so with a success (not an error), and
  // if the request was saved WITHOUT notifications, this press switches them on. A person
  // who pressed the old "I'm interested" button without ticking the box was otherwise stuck.
  const { data: existing, error: existingError } = await admin
    .from('booking_interests')
    .select('id, status, notify_when_verified, created_at')
    .eq('customer_id', user.id)
    .eq('cook_id', cookId)
    .eq('status', 'active')
    .maybeSingle()
  if (existingError && isMissingSchema(existingError)) return unavailable()
  if (existing) {
    if (notify && !existing.notify_when_verified) {
      const { error: upgradeError } = await admin
        .from('booking_interests')
        .update({
          notify_when_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('customer_id', user.id)
        .eq('status', 'active')
      if (upgradeError) return failed()
      return NextResponse.json({
        interest: { ...existing, notify_when_verified: true },
        duplicate: false,
        message: INTEREST_SAVED_MESSAGE,
      })
    }
    return NextResponse.json({
      interest: existing,
      duplicate: true,
      message: INTEREST_DUPLICATE_MESSAGE,
    })
  }

  // Do not let a withdraw-and-ask-again loop pester the cook (each new request tells the
  // cook that someone is interested).
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: withdrawn, error: withdrawnError } = await admin
    .from('booking_interests')
    .select('id')
    .eq('customer_id', user.id)
    .eq('cook_id', cookId)
    .eq('status', 'withdrawn')
    .gt('updated_at', dayAgo)
    .limit(1)
  if (withdrawnError && isMissingSchema(withdrawnError)) return unavailable()
  if (withdrawn && withdrawn.length > 0) {
    return NextResponse.json(
      {
        error:
          'You withdrew a request for this cook a moment ago. You can ask again tomorrow.',
        code: 'recently_withdrawn',
      },
      { status: 429 },
    )
  }

  // A brake that holds across server instances (the in-memory limiter above does not):
  // count this customer's requests in the database.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await admin
    .from('booking_interests')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', user.id)
    .gt('created_at', hourAgo)
  if ((recentCount ?? 0) >= 20) {
    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
        code: 'rate_limited',
      },
      { status: 429 },
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
      // Two presses at the same instant: the database kept one row (the unique index), and
      // the loser of the race is simply a repeat.
      return NextResponse.json({
        interest: null,
        duplicate: true,
        message: INTEREST_DUPLICATE_MESSAGE,
      })
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
    console.error(
      `booking_interests insert failed (${error?.code ?? 'no code'})`,
    )
    return failed()
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

  return NextResponse.json(
    { interest: created, duplicate: false, message: INTEREST_SAVED_MESSAGE },
    { status: 201 },
  )
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
