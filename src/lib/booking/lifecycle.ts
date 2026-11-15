// No imports on purpose: unit-tested with `node --test`.
//
// The booking lifecycle. The database already allowed four statuses
// (pending, confirmed, completed, cancelled). Exactly ONE is added:
// 'alternative_proposed' (the cook suggested another time and the customer must
// answer). Declined/cancelled share 'cancelled' and are told apart by who cancelled and
// why; "in progress" and "disputed" are not statuses (disputes have their own table).
//
//   pending ──accept──────────────▶ confirmed ──complete──▶ completed
//      │  ──propose_alternative──▶ alternative_proposed ──accept_alternative──▶ confirmed
//      │                                   └──decline_alternative──▶ cancelled
//      └──decline / cancel───────▶ cancelled   (confirmed can also be cancelled)
//
// "Confirmed" means the cook accepted; payment is a separate field (payment_status) and
// only the payment provider, verified on the server, can make a booking "paid".

export const BOOKING_STATUSES = [
  'pending',
  'alternative_proposed',
  'confirmed',
  'completed',
  'cancelled',
] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const BOOKING_ACTIONS = [
  'accept',
  'decline',
  'propose_alternative',
  'accept_alternative',
  'decline_alternative',
  'cancel',
  'complete',
] as const
export type BookingAction = (typeof BOOKING_ACTIONS)[number]

export type Actor = 'buyer' | 'cook'

export interface BookingState {
  status: BookingStatus
  payment_status: string | null
}

export type Transition =
  | { ok: true; to: BookingStatus; cancelledBy?: Actor }
  | { ok: false; reason: string }

const ACTIVE: BookingStatus[] = ['pending', 'alternative_proposed', 'confirmed']

export function isActiveStatus(status: string): boolean {
  return (ACTIVE as string[]).includes(status)
}

const WHO: Record<BookingAction, Actor[]> = {
  accept: ['cook'],
  decline: ['cook'],
  propose_alternative: ['cook'],
  accept_alternative: ['buyer'],
  decline_alternative: ['buyer'],
  cancel: ['buyer', 'cook'],
  complete: ['buyer', 'cook'],
}

// Pure decision: may this person do this to a booking in this state, and where does it go?
export function applyAction(
  booking: BookingState,
  actor: Actor,
  action: BookingAction,
): Transition {
  if (!WHO[action]?.includes(actor)) {
    return { ok: false, reason: 'You cannot do that on this booking.' }
  }
  const paid = booking.payment_status === 'paid'
  const { status } = booking

  switch (action) {
    case 'accept':
    case 'decline':
    case 'propose_alternative':
      if (status !== 'pending')
        return {
          ok: false,
          reason: 'This booking is no longer awaiting a response.',
        }
      if (action === 'accept') return { ok: true, to: 'confirmed' }
      if (action === 'propose_alternative')
        return { ok: true, to: 'alternative_proposed' }
      if (paid)
        return {
          ok: false,
          reason: 'This booking is already paid. Contact support to cancel it.',
        }
      return { ok: true, to: 'cancelled', cancelledBy: 'cook' }

    case 'accept_alternative':
    case 'decline_alternative':
      if (status !== 'alternative_proposed')
        return {
          ok: false,
          reason: 'There is no alternative time waiting for your answer.',
        }
      return action === 'accept_alternative'
        ? { ok: true, to: 'confirmed' }
        : { ok: true, to: 'cancelled', cancelledBy: 'buyer' }

    case 'cancel':
      if (!isActiveStatus(status))
        return { ok: false, reason: 'This booking can no longer be cancelled.' }
      // Money has moved: undoing it needs a refund, which goes through support.
      if (paid)
        return {
          ok: false,
          reason: 'This booking is already paid. Contact support to cancel it.',
        }
      return { ok: true, to: 'cancelled', cancelledBy: actor }

    case 'complete':
      if (status !== 'confirmed')
        return {
          ok: false,
          reason: 'Only a confirmed booking can be completed.',
        }
      // Never complete a booking the payment provider has not confirmed.
      if (!paid)
        return {
          ok: false,
          reason: 'A booking can be completed once payment is confirmed.',
        }
      return { ok: true, to: 'completed' }
  }
}

// Every transition the database must accept (used to build and test the trigger).
export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'alternative_proposed', 'cancelled'],
  alternative_proposed: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Waiting for the cook',
  alternative_proposed: 'New time suggested',
  confirmed: 'Accepted',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

// What the viewer should understand and do next, depending on who they are.
export function statusHint(booking: BookingState, viewer: Actor): string {
  const unpaid = ['unpaid', 'pending'].includes(booking.payment_status ?? '')
  switch (booking.status) {
    case 'pending':
      return viewer === 'cook'
        ? 'Review this request and accept, decline or suggest another time.'
        : 'The cook has your request and will respond soon.'
    case 'alternative_proposed':
      return viewer === 'buyer'
        ? 'The cook suggested another time. Accept it or decline.'
        : 'Waiting for the customer to answer your suggested time.'
    case 'confirmed':
      if (booking.payment_status === 'paid')
        return 'Paid and confirmed. Mark it completed once the service is done.'
      return viewer === 'buyer' && unpaid
        ? 'The cook accepted. Pay to secure your booking.'
        : 'Accepted. Waiting for the customer to pay.'
    case 'completed':
      return 'This booking is completed.'
    case 'cancelled':
      return 'This booking was cancelled.'
  }
}

// Notification copy for each action: who is told, and what. Kept here so the wording is
// consistent and testable. No notification promises anything the system does not do.
export interface Notice {
  to: Actor
  title: string
  body: string
}

export function noticeFor(action: BookingAction, actor: Actor): Notice | null {
  switch (action) {
    case 'accept':
      return {
        to: 'buyer',
        title: 'Booking accepted',
        body: 'The cook accepted your request. Open it to pay and secure your booking.',
      }
    case 'decline':
      return {
        to: 'buyer',
        title: 'Booking declined',
        body: 'The cook could not take this request. You can explore other cooks.',
      }
    case 'propose_alternative':
      return {
        to: 'buyer',
        title: 'New time suggested',
        body: 'The cook suggested a different time for your booking. Open it to answer.',
      }
    case 'accept_alternative':
      return {
        to: 'cook',
        title: 'New time accepted',
        body: 'The customer accepted your suggested time. The booking is accepted.',
      }
    case 'decline_alternative':
      return {
        to: 'cook',
        title: 'New time declined',
        body: 'The customer declined your suggested time. The booking was cancelled.',
      }
    case 'cancel':
      return {
        to: actor === 'buyer' ? 'cook' : 'buyer',
        title: 'Booking cancelled',
        body: 'A booking was cancelled. Open it for details.',
      }
    case 'complete':
      return {
        to: actor === 'buyer' ? 'cook' : 'buyer',
        title: 'Booking completed',
        body: 'This booking was marked completed.',
      }
  }
}

// New request (not an action on an existing booking).
export const NEW_REQUEST_NOTICE: Notice = {
  to: 'cook',
  title: 'New booking request',
  body: 'You have a new booking request. Open it to accept, decline or suggest another time.',
}

export const PAYMENT_RECEIVED_NOTICE: Notice = {
  to: 'cook',
  title: 'Payment Received!',
  body: 'A customer has paid for their confirmed cooking service.',
}
