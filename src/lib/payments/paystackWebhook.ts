import { createHmac, timingSafeEqual } from 'node:crypto'

// Paystack signs every webhook with HMAC-SHA512 of the raw body, using the account's
// secret key, in the x-paystack-signature header. Anything unsigned or wrongly signed
// must be ignored: anyone on the internet can POST to a public URL.
export function verifyPaystackSignature(input: {
  body: string
  signature: string | null | undefined
  secret: string | null | undefined
}): boolean {
  if (!input.secret || !input.signature) return false
  const expected = createHmac('sha512', input.secret)
    .update(input.body)
    .digest('hex')
  const given = input.signature.trim().toLowerCase()
  if (given.length !== expected.length) return false
  try {
    return timingSafeEqual(
      Buffer.from(given, 'utf8'),
      Buffer.from(expected, 'utf8'),
    )
  } catch {
    return false
  }
}

export interface ChargeSuccessEvent {
  event?: string
  data?: {
    status?: string
    reference?: string
    amount?: number
    currency?: string
  }
}

export interface PayableBooking {
  payment_reference: string | null
  payment_status: string | null
  amount: number | null
  price?: number | null
  status: string | null
}

// The signed message says "paid"; the booking decides whether that is acceptable.
// Same checks as the browser-driven verify route: right reference, Naira, exactly the
// agreed amount, a confirmed booking that is still waiting for payment.
export function webhookMatchesBooking(
  event: ChargeSuccessEvent,
  booking: PayableBooking,
): { ok: true } | { ok: false; reason: string } {
  if (event.event !== 'charge.success')
    return { ok: false, reason: 'not_a_charge' }
  const data = event.data ?? {}
  if (data.status !== 'success') return { ok: false, reason: 'not_successful' }
  if (!data.reference || data.reference !== booking.payment_reference)
    return { ok: false, reason: 'reference_mismatch' }
  if (data.currency !== 'NGN') return { ok: false, reason: 'currency_mismatch' }
  const agreed = Number(booking.amount ?? booking.price)
  if (!Number.isSafeInteger(agreed) || agreed <= 0)
    return { ok: false, reason: 'no_agreed_amount' }
  if (data.amount !== agreed * 100)
    return { ok: false, reason: 'amount_mismatch' }
  if (booking.status !== 'confirmed')
    return { ok: false, reason: 'booking_not_confirmed' }
  if (booking.payment_status === 'paid')
    return { ok: false, reason: 'already_paid' }
  if (!['unpaid', 'pending'].includes(booking.payment_status ?? ''))
    return { ok: false, reason: 'not_awaiting_payment' }
  return { ok: true }
}
