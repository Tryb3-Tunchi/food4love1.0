import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const verifySchema = z.object({
  reference: z.string().trim().min(1).max(100),
  booking_id: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = verifySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payment verification request' },
        { status: 400 },
      )
    }
    const { reference, booking_id: bookingId } = parsed.data

    const { data: booking, error: bookingLookupError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('buyer_id', user.id)
      .maybeSingle()
    if (bookingLookupError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (booking.payment_reference !== reference) {
      return NextResponse.json(
        { error: 'Payment reference does not belong to this booking' },
        { status: 403 },
      )
    }
    if (booking.status !== 'confirmed') {
      return NextResponse.json(
        { error: 'Cook must confirm the booking before payment' },
        { status: 409 },
      )
    }

    const bookingAmount = Number(booking.amount ?? booking.price)
    if (!Number.isSafeInteger(bookingAmount) || bookingAmount <= 0) {
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

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    )

    const data = await response.json()

    if (
      !response.ok ||
      !data.status ||
      data.data?.status !== 'success' ||
      data.data?.reference !== reference ||
      data.data?.currency !== 'NGN' ||
      data.data?.amount !== bookingAmount * 100
    ) {
      return NextResponse.json(
        { error: 'Payment details did not match this booking', success: false },
        { status: 400 },
      )
    }

    const wasAlreadyPaid = booking.payment_status === 'paid'
    if (!wasAlreadyPaid) {
      if (!['unpaid', 'pending'].includes(booking.payment_status)) {
        return NextResponse.json(
          { error: 'Booking is not awaiting payment' },
          { status: 409 },
        )
      }

      const admin = createAdminClient()
      const { data: updatedBooking, error: bookingError } = await admin
        .from('bookings')
        .update({
          payment_status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .eq('buyer_id', user.id)
        .eq('payment_reference', reference)
        .in('payment_status', ['unpaid', 'pending'])
        .select('id')
        .maybeSingle()

      if (bookingError || !updatedBooking) {
        return NextResponse.json(
          { error: 'Booking payment state changed; reload and try again' },
          { status: 409 },
        )
      }
    }

    if (!wasAlreadyPaid && booking.cook_id) {
      await supabase.from('notifications').insert({
        user_id: booking.cook_id,
        type: 'booking',
        title: 'Payment Received!',
        body: 'A customer has paid for their confirmed cooking service.',
        data: { booking_id: bookingId },
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
