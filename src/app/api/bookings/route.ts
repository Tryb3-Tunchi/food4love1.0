import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const bookingRequestSchema = z
  .object({
    cook_id: z.string().uuid(),
    match_id: z.string().uuid(),
    items: z
      .array(
        z.object({
          special_id: z.string().uuid(),
          quantity: z.number().int().min(1).max(20),
        }),
      )
      .min(1)
      .max(20),
    scheduled_at: z.string().datetime(),
    service_address: z.string().trim().min(8).max(1000),
    special_requests: z.string().trim().max(2000).optional(),
    guest_count: z.number().int().min(1).max(20),
  })
  .superRefine((data, context) => {
    if (new Date(data.scheduled_at).getTime() <= Date.now()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduled_at'],
        message: 'Choose a future cooking-session time',
      })
    }
    if (
      new Set(data.items.map((item) => item.special_id)).size !==
      data.items.length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'Remove duplicate menu items',
      })
    }
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

    const admin = createAdminClient()
    const [{ data: buyer }, { data: cook }, { data: match }] =
      await Promise.all([
        admin
          .from('profiles')
          .select('role, suspended, onboarding_complete')
          .eq('id', user.id)
          .maybeSingle(),
        admin
          .from('profiles')
          .select('role, suspended, onboarding_complete, kyc_status, price_min')
          .eq('id', request.cook_id)
          .maybeSingle(),
        admin
          .from('matches')
          .select('id, user1_id, user2_id, status')
          .eq('id', request.match_id)
          .eq('status', 'matched')
          .maybeSingle(),
      ])

    if (
      !buyer ||
      buyer.role !== 'buyer' ||
      buyer.suspended ||
      !buyer.onboarding_complete
    ) {
      return NextResponse.json(
        { error: 'Buyer account is not eligible' },
        { status: 403 },
      )
    }
    if (
      !cook ||
      cook.role !== 'cook' ||
      cook.suspended ||
      !cook.onboarding_complete ||
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
    const { data: specials, error: specialsError } = await admin
      .from('daily_specials')
      .select('id, title, price')
      .eq('cook_id', request.cook_id)
      .eq('moderation_status', 'active')
      .gte('available_until', new Date().toISOString())
      .in(
        'id',
        request.items.map((item) => item.special_id),
      )
    if (specialsError) {
      return NextResponse.json(
        { error: 'Could not verify the selected menu items' },
        { status: 500 },
      )
    }
    if (!specials || specials.length !== request.items.length) {
      return NextResponse.json(
        { error: 'One or more selected specials are no longer available' },
        { status: 409 },
      )
    }

    const specialById = new Map(
      specials.map((special) => [special.id, special]),
    )
    const subtotal = request.items.reduce((sum, item) => {
      const special = specialById.get(item.special_id)
      return sum + Number(special?.price ?? 0) * item.quantity
    }, 0)
    if (!Number.isSafeInteger(subtotal) || subtotal < (cook.price_min ?? 0)) {
      return NextResponse.json(
        { error: 'Selected dishes do not meet the cook minimum' },
        { status: 400 },
      )
    }

    const deliveryFee = 500
    const serviceFee = Math.round(subtotal * 0.05)
    const amount = subtotal + deliveryFee + serviceFee
    const mealDescription = request.items
      .map(
        (item) =>
          `${item.quantity} × ${specialById.get(item.special_id)?.title}`,
      )
      .join(', ')
    const { data: booking, error } = await admin
      .from('bookings')
      .insert({
        buyer_id: user.id,
        cook_id: request.cook_id,
        match_id: request.match_id,
        dish_title: mealDescription.slice(0, 250),
        price: subtotal,
        meal_description: mealDescription,
        scheduled_for: request.scheduled_at,
        service_address: request.service_address,
        special_requests: request.special_requests || null,
        guest_count: request.guest_count,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        amount,
        status: 'pending',
        payment_status: 'unpaid',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Could not create the cooking-service request' },
        { status: 500 },
      )
    }

    return NextResponse.json({ booking }, { status: 201 })
  } catch {
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
