import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'

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
        { error: 'Paystack secret key not configured' },
        { status: 500 },
      )
    }

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

    const supabase = await createClient()

    const { error: bookingError } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        payment_status: 'paid',
        payment_reference: reference,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking_id)

    if (bookingError) {
      console.error('Booking update error:', bookingError)
      return NextResponse.json(
        { error: 'Failed to update booking', success: false },
        { status: 500 },
      )
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('cook_id')
      .eq('id', booking_id)
      .single()

    if (booking?.cook_id) {
      await supabase.from('notifications').insert({
        user_id: booking.cook_id,
        type: 'booking',
        title: 'Payment Received!',
        body: 'A customer has paid for their booking. Time to cook!',
        data: { booking_id },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully',
      amount: data.data.amount / 100,
      reference: data.data.reference,
    })
  } catch (error: any) {
    console.error('Paystack verify error:', error)
    return NextResponse.json(
      { error: 'Internal server error', success: false },
      { status: 500 },
    )
  }
}
