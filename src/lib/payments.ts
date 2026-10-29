import type { Booking } from '@/services/bookings'
import { bookingAmount } from '@/lib/dashboard'

export type PaymentTone = 'success' | 'warning' | 'muted'

export interface PaymentState {
  label: string
  tone: PaymentTone
}

// Exact naira amounts. Money screens avoid the short "₦12k" form so the
// numbers can be checked against Paystack.
export function formatAmount(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`
}

export function paymentState(booking: Booking): PaymentState {
  if (booking.status === 'cancelled') {
    return { label: 'Cancelled', tone: 'muted' }
  }
  switch (booking.payment_status) {
    case 'paid':
      return { label: 'Paid by buyer', tone: 'success' }
    case 'refunded':
      return { label: 'Refunded', tone: 'muted' }
    case 'failed':
      return { label: 'Payment failed', tone: 'warning' }
    default:
      return { label: 'Awaiting payment', tone: 'warning' }
  }
}

function sumAmounts(bookings: Booking[]) {
  return bookings.reduce((sum, b) => sum + bookingAmount(b), 0)
}

// Everything is kept apart on purpose: an order being completed, being paid
// and being paid out are three different things, and a paid order can still
// be refunded until it settles.
export function summarizePayments(bookings: Booking[]) {
  const live = bookings.filter((b) => b.status !== 'cancelled')
  const completed = live.filter(
    (b) => b.status === 'completed' && b.payment_status !== 'refunded',
  )
  const paid = live.filter((b) => b.payment_status === 'paid')
  const awaiting = live.filter(
    (b) => b.status === 'confirmed' && b.payment_status === 'unpaid',
  )
  const refunded = bookings.filter((b) => b.payment_status === 'refunded')

  return {
    completedValue: sumAmounts(completed),
    completedCount: completed.length,
    paidValue: sumAmounts(paid),
    paidCount: paid.length,
    awaitingValue: sumAmounts(awaiting),
    awaitingCount: awaiting.length,
    refundedValue: sumAmounts(refunded),
    refundedCount: refunded.length,
  }
}
