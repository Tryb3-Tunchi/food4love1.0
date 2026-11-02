import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({ booking_id: z.string().uuid() })

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 },
    )
  }
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid booking' }, { status: 400 })

  try {
    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role, suspended')
      .eq('id', user.id)
      .maybeSingle()
    if (
      profileError ||
      !profile ||
      profile.role !== 'buyer' ||
      profile.suspended
    ) {
      return NextResponse.json(
        { error: 'Buyer account is not eligible' },
        { status: 403 },
      )
    }

    const { error } = await admin.rpc('food4love_pay_booking_with_wallet', {
      p_booking_id: parsed.data.booking_id,
      p_buyer_id: user.id,
    })
    if (error) {
      const insufficient = error.message
        .toLowerCase()
        .includes('insufficient wallet balance')
      return NextResponse.json(
        {
          error: insufficient
            ? 'Wallet balance is not enough to cover this booking'
            : 'Booking could not be paid with wallet funds',
        },
        { status: insufficient ? 409 : 400 },
      )
    }

    const { data: booking } = await admin
      .from('bookings')
      .select('id, cook_id, amount, price')
      .eq('id', parsed.data.booking_id)
      .maybeSingle()
    if (booking?.cook_id) {
      await admin.from('notifications').insert({
        user_id: booking.cook_id,
        type: 'booking',
        title: 'Payment Received!',
        body: 'A customer has paid for their confirmed cooking service.',
        data: { booking_id: booking.id },
      })
    }
    return NextResponse.json({
      success: true,
      amount_naira: Number(booking?.amount ?? booking?.price ?? 0),
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not pay booking with wallet funds' },
      { status: 500 },
    )
  }
}
