import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkAvailability } from '@/lib/availability'
import { DECLINE_KEYS, declineMessage } from '@/lib/bookingDecline'
import { adultStates } from '@/lib/adultCheck'
import { AGE_REQUIRED_CODE, AGE_REQUIRED_MESSAGE } from '@/lib/ageGate'
import { clientKey, createLimiter } from '@/lib/rateLimit'
import {
  cookBookable,
  customerExplanation,
  verificationState,
} from '@/lib/booking/verification'
import {
  applyAction,
  noticeFor,
  NEW_REQUEST_NOTICE,
  type Actor,
  type BookingAction,
  type BookingStatus,
} from '@/lib/booking/lifecycle'
import {
  DIETARY_OPTIONS,
  SERVICE_TYPES,
  addressFor,
  deliveryFeeFor,
  formatLagos,
  needsAddress,
  serviceFeeFor,
  totalFor,
  validateSchedule,
} from '@/lib/booking/details'
import {
  isMissingSchema,
  notifyBookingParty,
  recordBookingEvent,
} from '@/lib/booking/server'
import { loadBookingForAction } from '@/lib/booking/load'

// ------------------------------------------------------------------ create

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
    service_type: z.enum(SERVICE_TYPES),
    service_address: z.string().trim().max(1000).optional(),
    allergies: z
      .string()
      .trim()
      .min(2, 'Tell the cook about any allergies, or say there are none')
      .max(500),
    dietary_preferences: z.array(z.enum(DIETARY_OPTIONS)).max(10).default([]),
    special_requests: z.string().trim().max(2000).optional(),
    guest_count: z.number().int().min(1).max(20),
  })
  .superRefine((data, context) => {
    const schedule = validateSchedule(new Date(data.scheduled_at))
    if (!schedule.ok) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduled_at'],
        message: schedule.reason,
      })
    }
    if (
      needsAddress(data.service_type) &&
      !addressFor(data.service_type, data.service_address)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['service_address'],
        message: 'Enter the full address for this service',
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

// A customer can send a handful of requests an hour; this stops scripted floods.
const allowCreate = createLimiter({ limit: 12, windowMs: 60 * 60 * 1000 })

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!allowCreate(`${user.id}:${clientKey(req.headers)}`)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a little and try again.' },
        { status: 429 },
      )
    }

    const parsed = bookingRequestSchema.safeParse(
      await req.json().catch(() => null),
    )
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            'Invalid cooking-service request',
        },
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
    // Same adult rule as matching: both people must have confirmed (a no-op until the
    // age migration exists).
    const adults = await adultStates(admin, [user.id, request.cook_id])
    if (adults.get(user.id) === 'required') {
      return NextResponse.json(
        { error: AGE_REQUIRED_MESSAGE, code: AGE_REQUIRED_CODE },
        { status: 403 },
      )
    }

    // The one rule for "may this cook take a real booking": approved, active, onboarded.
    // Checked here again at submission time, whatever the screen showed.
    const bookable = cookBookable(cook)
    if (!bookable.ok) {
      const state = cook ? verificationState(cook) : 'not_verified'
      return NextResponse.json(
        {
          error:
            bookable.reason === 'not_a_cook' ||
            bookable.reason === 'onboarding_incomplete'
              ? 'Cook is not eligible for booking'
              : customerExplanation(state),
          code: 'cook_not_verified',
          state,
        },
        { status: 403 },
      )
    }
    if (adults.get(request.cook_id) === 'required') {
      return NextResponse.json(
        { error: 'Cook is not eligible for booking' },
        { status: 403 },
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
      .eq('is_paused', false)
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
    if (!Number.isSafeInteger(subtotal) || subtotal < (cook?.price_min ?? 0)) {
      return NextResponse.json(
        { error: 'Selected dishes do not meet the cook minimum' },
        { status: 400 },
      )
    }

    // Fees come from the shared rules, so the screen and the server always agree.
    const deliveryFee = deliveryFeeFor(request.service_type)
    const serviceFee = serviceFeeFor(subtotal)
    const amount = totalFor(subtotal, request.service_type)
    const mealDescription = request.items
      .map(
        (item) =>
          `${item.quantity} × ${specialById.get(item.special_id)?.title}`,
      )
      .join(', ')

    const requestedAt = new Date(request.scheduled_at)
    // Cook schedules are stored and displayed in Nigeria time (UTC+1).
    const lagosAt = new Date(requestedAt.getTime() + 60 * 60 * 1000)
    const serviceDate = lagosAt.toISOString().slice(0, 10)
    const serviceTime = lagosAt.toISOString().slice(11, 16)
    const dayStart = new Date(`${serviceDate}T00:00:00+01:00`)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

    const { data: availability, error: availabilityError } = await admin
      .from('cook_availability')
      .select('*')
      .eq('cook_id', request.cook_id)
      .maybeSingle()
    if (availabilityError) {
      return NextResponse.json(
        { error: 'Could not verify this cook’s availability' },
        { status: 503 },
      )
    }

    if (availability) {
      const { count, error: countError } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('cook_id', request.cook_id)
        .gte('scheduled_for', dayStart.toISOString())
        .lt('scheduled_for', dayEnd.toISOString())
        .neq('status', 'cancelled')
      if (countError) {
        return NextResponse.json(
          { error: 'Could not check this cook’s bookings' },
          { status: 500 },
        )
      }

      const availabilityCheck = checkAvailability(availability, {
        date: serviceDate,
        time: serviceTime,
        ordersThatDay: count ?? 0,
      })
      if (!availabilityCheck.ok) {
        return NextResponse.json(
          { error: availabilityCheck.reason },
          { status: 409 },
        )
      }
    }

    // A friendly answer for the common double-click; the database also refuses it.
    const { data: existing } = await admin
      .from('bookings')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('cook_id', request.cook_id)
      .eq('scheduled_for', request.scheduled_at)
      .in('status', ['pending', 'alternative_proposed', 'confirmed'])
      .limit(1)
    if (existing && existing.length > 0) {
      return NextResponse.json(
        {
          error:
            'You already have an active request with this cook for that time.',
          code: 'duplicate_booking',
          booking_id: existing[0].id,
        },
        { status: 409 },
      )
    }

    const base = {
      buyer_id: user.id,
      cook_id: request.cook_id,
      match_id: request.match_id,
      dish_title: mealDescription.slice(0, 250),
      price: subtotal,
      meal_description: mealDescription,
      scheduled_for: request.scheduled_at,
      service_address: addressFor(
        request.service_type,
        request.service_address,
      ),
      special_requests: request.special_requests || null,
      guest_count: request.guest_count,
      delivery_fee: deliveryFee,
      service_fee: serviceFee,
      amount,
      status: 'pending',
      payment_status: 'unpaid',
    }
    const detailed = {
      ...base,
      service_type: request.service_type,
      allergies: request.allergies,
      dietary_preferences: request.dietary_preferences,
    }

    let { data: booking, error } = await admin
      .from('bookings')
      .insert(detailed)
      .select()
      .single()

    // The booking migration is not applied yet: keep the information by folding it
    // into the free-text notes the older table already has.
    if (error && isMissingSchema(error)) {
      const notes = [
        request.special_requests,
        `Service: ${request.service_type}`,
        `Allergies: ${request.allergies}`,
        request.dietary_preferences.length
          ? `Dietary: ${request.dietary_preferences.join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n')
      ;({ data: booking, error } = await admin
        .from('bookings')
        .insert({ ...base, special_requests: notes.slice(0, 2000) })
        .select()
        .single())
    }

    if (error || !booking) {
      const message = error?.message ?? ''
      if (error?.code === '23505') {
        return NextResponse.json(
          {
            error:
              'You already have an active request with this cook for that time.',
            code: 'duplicate_booking',
          },
          { status: 409 },
        )
      }
      if (/fully booked/i.test(message)) {
        return NextResponse.json(
          { error: 'This cook is fully booked on that day.' },
          { status: 409 },
        )
      }
      if (/not verified/i.test(message)) {
        return NextResponse.json(
          {
            error: customerExplanation('not_verified'),
            code: 'cook_not_verified',
          },
          { status: 403 },
        )
      }
      return NextResponse.json(
        { error: 'Could not create the cooking-service request' },
        { status: 500 },
      )
    }

    await recordBookingEvent(admin, {
      bookingId: booking.id,
      actorId: user.id,
      actorRole: 'buyer',
      action: 'request',
      to: 'pending',
    })
    await notifyBookingParty(admin, {
      userId: request.cook_id,
      notice: NEW_REQUEST_NOTICE,
      bookingId: booking.id,
      eventKey: `booking:${booking.id}:requested`,
    })

    return NextResponse.json({ booking }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Could not create the cooking-service request' },
      { status: 500 },
    )
  }
}

// ------------------------------------------------------------------ actions

const bookingActionSchema = z.discriminatedUnion('action', [
  z.object({ booking_id: z.string().uuid(), action: z.literal('accept') }),
  z.object({
    booking_id: z.string().uuid(),
    action: z.literal('decline'),
    reason: z.enum(DECLINE_KEYS),
    note: z.string().trim().max(200).optional(),
  }),
  z.object({
    booking_id: z.string().uuid(),
    action: z.literal('propose_alternative'),
    proposed_at: z.string().datetime(),
    note: z.string().trim().max(300).optional(),
  }),
  z.object({
    booking_id: z.string().uuid(),
    action: z.literal('accept_alternative'),
  }),
  z.object({
    booking_id: z.string().uuid(),
    action: z.literal('decline_alternative'),
  }),
  z.object({
    booking_id: z.string().uuid(),
    action: z.literal('cancel'),
    reason: z.string().trim().max(300).optional(),
  }),
  z.object({ booking_id: z.string().uuid(), action: z.literal('complete') }),
])

const allowAct = createLimiter({ limit: 60, windowMs: 60 * 60 * 1000 })

export async function PATCH(req: NextRequest) {
  try {
    const sessionClient = await createClient()
    const {
      data: { user },
    } = await sessionClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!allowAct(`${user.id}:${clientKey(req.headers)}`)) {
      return NextResponse.json(
        { error: 'Too many actions. Please wait a little and try again.' },
        { status: 429 },
      )
    }

    const parsed = bookingActionSchema.safeParse(
      await req.json().catch(() => null),
    )
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid booking action' },
        { status: 400 },
      )
    }
    const decision = parsed.data

    const admin = createAdminClient()
    // Works before AND after the booking migration (see loadBookingForAction).
    const booking = await loadBookingForAction(
      admin as unknown as Parameters<typeof loadBookingForAction>[0],
      decision.booking_id,
      isMissingSchema,
    )

    // Not a participant: indistinguishable from a booking that does not exist, so a
    // guessed booking id reveals nothing.
    const actor: Actor | null = !booking
      ? null
      : booking.cook_id === user.id
        ? 'cook'
        : booking.buyer_id === user.id
          ? 'buyer'
          : null
    if (!booking || !actor) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const { data: me } = await admin
      .from('profiles')
      .select('role, suspended, kyc_status, onboarding_complete')
      .eq('id', user.id)
      .maybeSingle()
    const adults = await adultStates(admin, [user.id])
    if (adults.get(user.id) === 'required') {
      return NextResponse.json(
        { error: AGE_REQUIRED_MESSAGE, code: AGE_REQUIRED_CODE },
        { status: 403 },
      )
    }
    if (!me || me.suspended) {
      return NextResponse.json(
        { error: 'Your account is not eligible for this action' },
        { status: 403 },
      )
    }
    // A cook who is no longer verified can still decline or cancel, but cannot take
    // on or promise anything new.
    if (
      actor === 'cook' &&
      ['accept', 'propose_alternative'].includes(decision.action) &&
      !cookBookable(me).ok
    ) {
      return NextResponse.json(
        {
          error: customerExplanation(verificationState(me)),
          code: 'cook_not_verified',
        },
        { status: 403 },
      )
    }

    const transition = applyAction(
      {
        status: booking.status as BookingStatus,
        payment_status: booking.payment_status,
      },
      actor,
      decision.action as BookingAction,
    )
    if (!transition.ok) {
      return NextResponse.json({ error: transition.reason }, { status: 409 })
    }

    const now = new Date().toISOString()
    const update: Record<string, unknown> = {
      status: transition.to,
      updated_at: now,
    }
    let proposedAt: string | null = null

    if (decision.action === 'propose_alternative') {
      const schedule = validateSchedule(new Date(decision.proposed_at))
      if (!schedule.ok) {
        return NextResponse.json({ error: schedule.reason }, { status: 400 })
      }
      proposedAt = decision.proposed_at
      update.proposed_scheduled_for = decision.proposed_at
      update.proposed_note = decision.note ?? null
    }
    if (decision.action === 'accept_alternative') {
      if (!booking.proposed_scheduled_for) {
        return NextResponse.json(
          { error: 'There is no alternative time to accept.' },
          { status: 409 },
        )
      }
      update.scheduled_for = booking.proposed_scheduled_for
      update.proposed_scheduled_for = null
      update.proposed_note = null
    }
    if (transition.to === 'cancelled') {
      update.cancelled_by = user.id
      update.cancel_reason =
        decision.action === 'decline'
          ? decision.reason
          : decision.action === 'cancel'
            ? (decision.reason ?? null)
            : decision.action === 'decline_alternative'
              ? 'alternative_declined'
              : null
    }
    if (transition.to === 'completed') update.completed_at = now

    let { data: updated, error } = await admin
      .from('bookings')
      .update(update)
      .eq('id', booking.id)
      .eq('status', booking.status) // only if nobody changed it in the meantime
      .select('id, status')
      .maybeSingle()

    // Older database without the new columns: keep the core status change working.
    if (error && isMissingSchema(error)) {
      const legacyStatus =
        transition.to === 'alternative_proposed' ? null : transition.to
      if (!legacyStatus) {
        return NextResponse.json(
          {
            error:
              'Suggesting another time needs the booking update to be installed.',
          },
          { status: 503 },
        )
      }
      ;({ data: updated, error } = await admin
        .from('bookings')
        .update({ status: legacyStatus, updated_at: now })
        .eq('id', booking.id)
        .eq('status', booking.status)
        .select('id, status')
        .maybeSingle())
    }

    if (error || !updated) {
      const message = error?.message ?? ''
      if (/no longer verified/i.test(message)) {
        return NextResponse.json(
          {
            error: customerExplanation('not_verified'),
            code: 'cook_not_verified',
          },
          { status: 403 },
        )
      }
      return NextResponse.json(
        { error: 'Booking changed before it could be updated' },
        { status: 409 },
      )
    }

    await recordBookingEvent(admin, {
      bookingId: booking.id,
      actorId: user.id,
      actorRole: actor,
      action: decision.action,
      from: booking.status,
      to: transition.to,
      note:
        decision.action === 'decline'
          ? decision.reason
          : decision.action === 'cancel'
            ? decision.reason
            : decision.action === 'propose_alternative'
              ? decision.note
              : null,
    })

    const notice = noticeFor(decision.action as BookingAction, actor)
    if (notice) {
      const recipient =
        notice.to === 'buyer' ? booking.buyer_id : booking.cook_id
      await notifyBookingParty(admin, {
        userId: recipient,
        notice,
        bookingId: booking.id,
        eventKey: `booking:${booking.id}:${decision.action}:${transition.to}`,
      })
    }

    // Keep the shared conversation up to date, as the decline flow already did.
    if (booking.match_id) {
      let content: string | null = null
      if (decision.action === 'decline') {
        content = declineMessage(decision.reason, decision.note)
      } else if (decision.action === 'propose_alternative' && proposedAt) {
        content = `Hi, I can't do the original time. Could we do ${formatLagos(proposedAt)} instead?${
          decision.note ? ` ${decision.note}` : ''
        } Open the booking to accept or decline.`
      }
      if (content) {
        const { error: messageError } = await admin.from('messages').insert({
          match_id: booking.match_id,
          sender_id: user.id,
          content,
        })
        if (messageError) console.error('Booking message error:', messageError)
      }
    }

    return NextResponse.json({ booking: updated })
  } catch {
    return NextResponse.json(
      { error: 'Could not update booking' },
      { status: 500 },
    )
  }
}
