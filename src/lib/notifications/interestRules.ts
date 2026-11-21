// No imports on purpose: unit-tested with `node --test`.
//
// "Should this customer get the 'your cook is verified' EMAIL right now?"
//
// The in-app notification is written by the database trigger the moment a cook becomes
// verified. The email is a second, consent-gated channel, so the decision is made here,
// at send time, from the CURRENT facts (not the facts at the moment the cook was
// verified): a cook can lose verification, a customer can be suspended or turn booking
// updates off, all between the trigger firing and the email going out.

export interface InterestEmailFacts {
  // the customer's own booking_interests row (null if it vanished)
  interest: { notify_when_verified: boolean } | null
  cook: {
    role?: string | null
    kyc_status?: string | null
    suspended?: boolean | null
  } | null
  customer: {
    role?: string | null
    suspended?: boolean | null
    notification_preferences?: { bookings?: boolean } | null
  } | null
  email: { address: string | null; confirmed: boolean }
}

export type SkipReason =
  | 'no_interest'
  | 'no_consent'
  | 'cook_no_longer_verified'
  | 'customer_unavailable'
  | 'email_opt_out'
  | 'no_email'
  | 'unconfirmed_email'

export type InterestEmailDecision =
  { send: true } | { send: false; reason: SkipReason }

export function decideInterestEmail(
  facts: InterestEmailFacts,
): InterestEmailDecision {
  if (!facts.interest) return { send: false, reason: 'no_interest' }
  // The request-scoped consent: the customer pressed "Notify me when verified".
  if (!facts.interest.notify_when_verified)
    return { send: false, reason: 'no_consent' }

  const cook = facts.cook
  // The email promises "now eligible for bookings". If that stopped being true before
  // we got to send it, saying so would be misleading.
  if (
    !cook ||
    cook.role !== 'cook' ||
    cook.suspended ||
    cook.kyc_status !== 'verified'
  )
    return { send: false, reason: 'cook_no_longer_verified' }

  const customer = facts.customer
  if (!customer || customer.suspended || customer.role !== 'buyer')
    return { send: false, reason: 'customer_unavailable' }
  // "Booking updates" off in notification settings also silences the email.
  if (customer.notification_preferences?.bookings === false)
    return { send: false, reason: 'email_opt_out' }

  if (!facts.email.address) return { send: false, reason: 'no_email' }
  if (!facts.email.confirmed)
    return { send: false, reason: 'unconfirmed_email' }
  return { send: true }
}
