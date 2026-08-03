import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { reference, booking_id } = body

    if (!reference || !booking_id) {
      return NextResponse.json(
        { error: 'Missing reference or booking_id' },
        { status: 400 },
      )
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Paystack not configured' },
        { status: 500 },
      )
    }

    // Verify with Paystack
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    )

    const data = await response.json()

    if (!data.status || data.data.status !== 'success') {
      return NextResponse.json(
        { error: 'Payment verification failed', success: false },
        { status: 400 },
      )
    }

    // Update booking in Supabase
    const supabase = await createClient()
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        payment_status: 'paid',
        payment_reference: reference,
        paid_at: new Date().toISOString(),
      })
      .eq('id', booking_id)

    if (bookingError) {
      console.error('Booking update error:', bookingError)
      return NextResponse.json(
        { error: 'Failed to update booking', success: false },
        { status: 500 },
      )
    }

    // Create payment record
    const { error: paymentError } = await supabase.from('payments').insert({
      booking_id,
      reference,
      amount: data.data.amount / 100,
      status: 'success',
      channel: data.data.channel,
      paid_at: data.data.paid_at,
    })

    if (paymentError) {
      console.error('Payment record error:', paymentError)
    }

    return NextResponse.json({ success: true, message: 'Payment verified' })
  } catch (err: any) {
    console.error('Paystack verify error:', err)
    return NextResponse.json(
      { error: err.message || 'Verification failed', success: false },
      { status: 500 },
    )
  }
}
