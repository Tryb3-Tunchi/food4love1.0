import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const initializeSchema = z.object({ booking_id: z.string().uuid() })

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = initializeSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid booking' }, { status: 400 })
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', parsed.data.booking_id)
      .eq('buyer_id', user.id)
      .maybeSingle()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (
      booking.status !== 'confirmed' ||
      !['unpaid', 'pending'].includes(booking.payment_status)
    ) {
      return NextResponse.json(
        { error: 'This booking is not eligible for payment' },
        { status: 409 },
      )
    }

    const amount = Number(booking.amount ?? booking.total_amount)
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Booking has no valid agreed amount' },
        { status: 409 },
      )
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Paystack secret key not configured' },
        { status: 500 },
      )
    }

    const reference =
      booking.payment_reference || `f4l_${booking.id}_${randomUUID()}`

    const response = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          amount: Math.round(amount * 100), // Paystack uses kobo
          reference,
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/bookings/${booking.id}`,
          metadata: {
            booking_id: booking.id,
            custom_fields: [
              {
                display_name: 'Booking ID',
                variable_name: 'booking_id',
                value: booking.id,
              },
            ],
          },
        }),
      },
    )

    const data = await response.json()

    if (!response.ok || !data.status || data.data?.reference !== reference) {
      return NextResponse.json(
        { error: data.message || 'Paystack initialization failed' },
        { status: 400 },
      )
    }

    if (!booking.payment_reference) {
      const admin = createAdminClient()
      const { data: updatedBooking, error: referenceError } = await admin
        .from('bookings')
        .update({ payment_reference: reference })
        .eq('id', booking.id)
        .eq('buyer_id', user.id)
        .is('payment_reference', null)
        .select('id')
        .maybeSingle()

      if (referenceError || !updatedBooking) {
        return NextResponse.json(
          { error: 'Could not securely attach payment to this booking' },
          { status: 409 },
        )
      }
    }

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
      access_code: data.data.access_code,
      amount_kobo: Math.round(amount * 100),
    })
  } catch (error: any) {
    console.error('Paystack initialize error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
