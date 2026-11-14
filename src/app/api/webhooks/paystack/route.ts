import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  verifyPaystackSignature,
  webhookMatchesBooking,
  type ChargeSuccessEvent,
} from '@/lib/payments/paystackWebhook'

export const runtime = 'nodejs'

// Paystack tells us a payment succeeded even if the buyer closed the browser before
// our own verification call ran. Every call is signature-checked, and a booking is only
// marked paid when the reference, currency and exact agreed amount all match. The
// update is conditional on the booking still awaiting payment, so a repeated delivery
// of the same event changes nothing.
//
// Scope: booking payments only. Wallet top-ups keep their existing verification path.
export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) {
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 503 },
    )
  }
  if (Number(request.headers.get('content-length') ?? '0') > 50_000) {
    return NextResponse.json({ error: 'Too large' }, { status: 413 })
  }
  const body = await request.text()
  if (body.length > 50_000) {
    return NextResponse.json({ error: 'Too large' }, { status: 413 })
  }
  if (
    !verifyPaystackSignature({
      body,
      signature: request.headers.get('x-paystack-signature'),
      secret,
    })
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: ChargeSuccessEvent
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  if (event.event !== 'charge.success' || !event.data?.reference) {
    return NextResponse.json({ ok: true }) // other events are acknowledged, not acted on
  }

  try {
    const admin = createAdminClient()
    const { data: booking } = await admin
      .from('bookings')
      .select(
        'id, cook_id, buyer_id, status, payment_status, payment_reference, amount, price',
      )
      .eq('payment_reference', event.data.reference)
      .maybeSingle()
    // Not a booking payment (for example a wallet top-up): nothing to do here.
    if (!booking) return NextResponse.json({ ok: true })

    const verdict = webhookMatchesBooking(event, booking)
    if (!verdict.ok)
      return NextResponse.json({ ok: true, ignored: verdict.reason })

    const { data: updated } = await admin
      .from('bookings')
      .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', booking.id)
      .eq('payment_reference', event.data.reference)
      .in('payment_status', ['unpaid', 'pending'])
      .select('id')
      .maybeSingle()

    if (updated && booking.cook_id) {
      await admin.from('notifications').insert({
        user_id: booking.cook_id,
        type: 'booking',
        title: 'Payment Received!',
        body: 'A customer has paid for their confirmed cooking service.',
        data: { booking_id: booking.id },
      })
    }
  } catch {
    // Answer 200 so Paystack does not retry forever on our own fault; the buyer's
    // return visit still verifies the payment the existing way.
  }
  return NextResponse.json({ ok: true })
}
