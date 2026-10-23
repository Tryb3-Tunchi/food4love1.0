import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const bookingRequestSchema = z.object({
  cook_id: z.string().uuid(),
  match_id: z.string().uuid(),
  meal_description: z.string().trim().min(1).max(2000),
  service_date: z.string().date(),
  service_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  address: z.string().trim().min(8).max(1000),
  special_requests: z.string().trim().max(2000).nullable().optional(),
  guests: z.number().int().min(1).max(20),
  amount: z.number().int().positive(),
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

    const parsed = bookingRequestSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid cooking-service request' },
        { status: 400 },
      )
    }
    const request = parsed.data

    const [{ data: buyer }, { data: cook }, { data: match }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('role, suspended')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('role, suspended, kyc_status, price_min')
          .eq('id', request.cook_id)
          .maybeSingle(),
        supabase
          .from('matches')
          .select('id, user1_id, user2_id, status')
          .eq('id', request.match_id)
          .eq('status', 'matched')
          .maybeSingle(),
      ])

    if (!buyer || buyer.role !== 'buyer' || buyer.suspended) {
      return NextResponse.json(
        { error: 'Buyer account is not eligible' },
        { status: 403 },
      )
    }
    if (
      !cook ||
      cook.role !== 'cook' ||
      cook.suspended ||
      cook.kyc_status !== 'verified'
    ) {
      return NextResponse.json(
        { error: 'Cook is not eligible for booking' },
        { status: 400 },
      )
    }
    if (
      !match ||
      ![match.user1_id, match.user2_id].includes(user.id) ||
      ![match.user1_id, match.user2_id].includes(request.cook_id) ||
      match.user1_id === match.user2_id
    ) {
      return NextResponse.json(
        { error: 'A current match with this cook is required' },
        { status: 403 },
      )
    }
    if (request.amount < (cook.price_min ?? 0)) {
      return NextResponse.json(
        { error: 'Proposed amount is below the cook minimum' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data: booking, error } = await admin
      .from('bookings')
      .insert({
        buyer_id: user.id,
        cook_id: request.cook_id,
        match_id: request.match_id,
        meal_description: request.meal_description,
        delivery_date: request.service_date,
        delivery_time: request.service_time,
        delivery_type: 'at_home_cooking',
        address: request.address,
        special_requests: request.special_requests || null,
        guests: request.guests,
        amount: request.amount,
        status: 'pending',
        payment_status: 'unpaid',
      })
      .select()
      .single()

    if (error) {
      console.error('Booking insert error:', error)
      return NextResponse.json(
        { error: 'Could not create the cooking-service request' },
        { status: 500 },
      )
    }

    return NextResponse.json({ booking }, { status: 201 })
  } catch (err: any) {
    console.error('Booking API error:', err)
    return NextResponse.json(
      { error: 'Could not create the cooking-service request' },
      { status: 500 },
    )
  }
}

const bookingActionSchema = z.object({
  booking_id: z.string().uuid(),
  action: z.literal('accept'),
})

export async function PATCH(req: NextRequest) {
  try {
    const sessionClient = await createClient()
    const {
      data: { user },
    } = await sessionClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = bookingActionSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid booking action' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const [{ data: cook }, { data: booking }] = await Promise.all([
      admin
        .from('profiles')
        .select('role, suspended')
        .eq('id', user.id)
        .maybeSingle(),
      admin
        .from('bookings')
        .select('id, cook_id, status')
        .eq('id', parsed.data.booking_id)
        .maybeSingle(),
    ])

    if (!cook || cook.role !== 'cook' || cook.suspended) {
      return NextResponse.json(
        { error: 'Cook account is not eligible' },
        { status: 403 },
      )
    }
    if (!booking || booking.cook_id !== user.id) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (booking.status !== 'pending') {
      return NextResponse.json(
        { error: 'Booking is no longer awaiting a response' },
        { status: 409 },
      )
    }

    const { data: updatedBooking, error } = await admin
      .from('bookings')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', booking.id)
      .eq('cook_id', user.id)
      .eq('status', 'pending')
      .select('id, status')
      .maybeSingle()

    if (error || !updatedBooking) {
      return NextResponse.json(
        { error: 'Booking changed before it could be accepted' },
        { status: 409 },
      )
    }

    return NextResponse.json({ booking: updatedBooking })
  } catch {
    return NextResponse.json(
      { error: 'Could not update booking' },
      { status: 500 },
    )
  }
}
