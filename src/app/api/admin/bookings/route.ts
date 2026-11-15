import { getAdminUser } from '@/lib/admin/auth'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const refundSchema = z.object({
  booking_id: z.string().uuid(),
  amount_ngn: z.number().int().positive(),
  reason: z.string().trim().min(10).max(1000),
})

const reconcileSchema = z.object({
  refund_id: z.string().uuid(),
  provider_refund_id: z.string().trim().min(1).max(200),
  verification_reason: z.string().trim().min(10).max(1000),
})

// The admin list never loads the service address, allergies, dietary needs or notes:
// those are for the two people in the booking. Staff see who, when, what state and money.
const LIST_COLUMNS_FULL =
  'id, buyer_id, cook_id, status, payment_status, payment_reference, amount, price, created_at, scheduled_for, service_type, guest_count, cancelled_by, cancel_reason, completed_at'
const LIST_COLUMNS_LEGACY =
  'id, buyer_id, cook_id, status, payment_status, payment_reference, amount, price, created_at, scheduled_for, guest_count'
const RELATIONS =
  ', cook:profiles!bookings_cook_id_fkey(id, full_name), buyer:profiles!bookings_buyer_id_fkey(id, full_name), payment_refunds(id, amount_kobo, reason, status, provider_refund_id, created_at)'

async function countRows(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  filter?: (query: any) => any,
) {
  let query = admin.from(table).select('id', { count: 'exact', head: true })
  if (filter) query = filter(query)
  const { count, error } = await query
  return error ? null : (count ?? 0)
}

export async function GET(request: NextRequest) {
  const actor = await getAdminUser('bookings:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const status = request.nextUrl.searchParams.get('status')
  const build = (columns: string) => {
    let query = admin
      .from('bookings')
      .select(columns + RELATIONS)
      .order('created_at', { ascending: false })
      .limit(200)
    if (status) query = query.eq('status', status)
    return query
  }

  let { data, error } = await build(LIST_COLUMNS_FULL)
  // The booking migration is not applied yet: use the columns the older table has.
  if (error) ({ data, error } = await build(LIST_COLUMNS_LEGACY))
  if (error)
    return NextResponse.json(
      { error: 'Could not load bookings' },
      { status: 500 },
    )

  // Counts for the whole table (not just the 200 shown), so the numbers are real.
  const { data: allStatuses } = await admin
    .from('bookings')
    .select('status, payment_status')
    .limit(10000)
  const counts: Record<string, number> = {}
  for (const row of allStatuses ?? [])
    counts[row.status ?? 'unknown'] = (counts[row.status ?? 'unknown'] ?? 0) + 1

  // Demand waiting on verification: per cook, never per customer.
  const { data: interestRows, error: interestError } = await admin
    .from('booking_interests')
    .select(
      'cook_id, status, notify_when_verified, cook:profiles!booking_interests_cook_id_fkey(full_name, kyc_status)',
    )
    .limit(5000)
  const demand = new Map<
    string,
    {
      cook_id: string
      name: string
      state: string
      active: number
      notify: number
    }
  >()
  const interestTotals = { active: 0, fulfilled: 0, withdrawn: 0 }
  if (!interestError) {
    for (const row of interestRows ?? []) {
      const key = row.status as keyof typeof interestTotals
      if (key in interestTotals) interestTotals[key] += 1
      if (row.status !== 'active') continue
      const cook = (Array.isArray(row.cook) ? row.cook[0] : row.cook) as {
        full_name?: string
        kyc_status?: string
      } | null
      const entry = demand.get(row.cook_id) ?? {
        cook_id: row.cook_id,
        name: cook?.full_name ?? 'Cook',
        state: cook?.kyc_status ?? 'unverified',
        active: 0,
        notify: 0,
      }
      entry.active += 1
      if (row.notify_when_verified) entry.notify += 1
      demand.set(row.cook_id, entry)
    }
  }

  const [pendingVerification, openDisputes] = await Promise.all([
    countRows(admin, 'kyc_submissions', (q) => q.eq('status', 'pending')),
    countRows(admin, 'disputes', (q) =>
      q.in('status', ['open', 'ai_reviewed', 'admin_review']),
    ),
  ])

  return NextResponse.json({
    bookings: data ?? [],
    counts,
    interests: interestError
      ? null
      : {
          totals: interestTotals,
          demand: Array.from(demand.values())
            .sort((x, y) => y.active - x.active)
            .slice(0, 20),
        },
    pending_verification: pendingVerification,
    open_disputes: openDisputes,
    payments_configured: Boolean(
      process.env.PAYSTACK_SECRET_KEY &&
      process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    ),
  })
}

export async function POST(request: NextRequest) {
  const actor = await getAdminUser('finance:refund')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = refundSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid refund request' },
      { status: 400 },
    )

  const admin = createAdminClient()
  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select('id, amount, price, payment_status, payment_reference, status')
    .eq('id', parsed.data.booking_id)
    .maybeSingle()
  if (bookingError || !booking)
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.payment_status !== 'paid' || !booking.payment_reference) {
    return NextResponse.json(
      {
        error:
          'Only paid bookings with a verified payment reference can be refunded',
      },
      { status: 409 },
    )
  }

  const bookingAmountNgn = Number(booking.amount ?? booking.price)
  const requestedKobo = parsed.data.amount_ngn * 100
  if (
    !Number.isSafeInteger(bookingAmountNgn) ||
    bookingAmountNgn <= 0 ||
    !Number.isSafeInteger(requestedKobo) ||
    requestedKobo > bookingAmountNgn * 100
  ) {
    return NextResponse.json(
      { error: 'Refund amount exceeds the booking payment' },
      { status: 400 },
    )
  }

  const { data: priorRefunds, error: refundsError } = await admin
    .from('payment_refunds')
    .select('amount_kobo, status')
    .eq('booking_id', booking.id)
    .in('status', ['requested', 'pending', 'processed'])
  if (refundsError)
    return NextResponse.json(
      { error: 'Could not verify previous refunds' },
      { status: 500 },
    )
  const priorAmount = (priorRefunds ?? []).reduce(
    (sum, refund) => sum + Number(refund.amount_kobo),
    0,
  )
  if (priorAmount + requestedKobo > bookingAmountNgn * 100) {
    return NextResponse.json(
      { error: 'Requested refund exceeds the remaining refundable amount' },
      { status: 409 },
    )
  }
  if (
    (priorRefunds ?? []).some((refund) =>
      ['requested', 'pending'].includes(refund.status),
    )
  ) {
    return NextResponse.json(
      { error: 'A refund request is already in progress for this booking' },
      { status: 409 },
    )
  }

  const audit = await beginAdminAudit({
    actorId: actor.id,
    action: 'payment.refund.request',
    targetType: 'booking',
    targetId: booking.id,
    details: {
      amount_ngn: parsed.data.amount_ngn,
      reason: parsed.data.reason,
      payment_reference: booking.payment_reference,
    },
  }).catch(() => null)
  if (!audit)
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )

  const { data: refund, error: insertError } = await admin
    .from('payment_refunds')
    .insert({
      booking_id: booking.id,
      requested_by: actor.id,
      amount_kobo: requestedKobo,
      paid_amount_kobo: bookingAmountNgn * 100,
      reason: parsed.data.reason,
      provider_reference: booking.payment_reference,
      status: 'requested',
    })
    .select('id')
    .single()
  if (insertError || !refund) {
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      'failed',
      insertError?.message ?? 'Refund request could not be recorded',
    )
    return NextResponse.json(
      { error: 'Could not safely record refund request' },
      { status: 409 },
    )
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    await admin
      .from('payment_refunds')
      .update({
        status: 'failed',
        provider_response: { error: 'Paystack is not configured' },
        updated_at: new Date().toISOString(),
      })
      .eq('id', refund.id)
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      'failed',
      'Paystack is not configured',
    )
    return NextResponse.json(
      { error: 'Paystack is not configured' },
      { status: 503 },
    )
  }

  let providerResponse: any
  try {
    const response = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: booking.payment_reference,
        amount: requestedKobo,
        merchant_note: parsed.data.reason,
      }),
    })
    providerResponse = await response.json()
    if (!response.ok || !providerResponse.status || !providerResponse.data) {
      throw new Error(
        providerResponse.message ||
          'Paystack did not accept the refund request',
      )
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Paystack refund request failed'
    await admin
      .from('payment_refunds')
      .update({
        status: 'failed',
        provider_response: { error: message },
        updated_at: new Date().toISOString(),
      })
      .eq('id', refund.id)
    await finishAdminAudit(audit.admin, audit.auditId, 'failed', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const { error: updateError } = await admin
    .from('payment_refunds')
    .update({
      status: 'pending',
      provider_refund_id: String(providerResponse.data.id ?? ''),
      provider_response: providerResponse.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', refund.id)
  await finishAdminAudit(
    audit.admin,
    audit.auditId,
    updateError ? 'failed' : 'succeeded',
    updateError?.message,
  )
  if (updateError)
    return NextResponse.json(
      {
        error:
          'Paystack accepted the request, but status recording failed. Reconcile this refund before retrying.',
      },
      { status: 500 },
    )
  return NextResponse.json(
    {
      refund_id: refund.id,
      status: 'pending',
      message:
        'Paystack accepted the refund request; reconcile provider settlement before marking the booking refunded.',
    },
    { status: 202 },
  )
}

export async function PATCH(request: NextRequest) {
  const actor = await getAdminUser('finance:refund')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = reconcileSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Provider refund ID and verification reason are required' },
      { status: 400 },
    )

  const admin = createAdminClient()
  const { data: refund, error: refundLookupError } = await admin
    .from('payment_refunds')
    .select('id, booking_id, provider_refund_id, status')
    .eq('id', parsed.data.refund_id)
    .maybeSingle()
  if (refundLookupError || !refund)
    return NextResponse.json(
      { error: 'Refund request not found' },
      { status: 404 },
    )
  if (
    !refund.provider_refund_id ||
    refund.provider_refund_id !== parsed.data.provider_refund_id
  ) {
    return NextResponse.json(
      {
        error:
          'Provider refund ID does not match the recorded Paystack response',
      },
      { status: 409 },
    )
  }

  const audit = await beginAdminAudit({
    actorId: actor.id,
    action: 'payment.refund.reconcile',
    targetType: 'payment_refund',
    targetId: refund.id,
    details: {
      booking_id: refund.booking_id,
      provider_refund_id: refund.provider_refund_id,
      verification_reason: parsed.data.verification_reason,
    },
  }).catch(() => null)
  if (!audit)
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )

  const { data, error } = await audit.admin.rpc(
    'food4love_mark_refund_processed',
    {
      p_refund_id: refund.id,
      p_provider_refund_id: parsed.data.provider_refund_id,
    },
  )
  try {
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      error || !data?.length ? 'failed' : 'succeeded',
      error?.message,
    )
  } catch {
    return NextResponse.json(
      { error: 'Refund reconciled, but its audit outcome needs review' },
      { status: 500 },
    )
  }
  if (error || !data?.length) {
    return NextResponse.json(
      { error: error?.message || 'Could not reconcile refund' },
      { status: 409 },
    )
  }
  return NextResponse.json({
    refund_id: refund.id,
    status: 'processed',
    booking_fully_refunded: data[0].booking_fully_refunded,
  })
}
