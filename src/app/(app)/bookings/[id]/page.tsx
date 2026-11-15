'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { loadPaystack } from '@/lib/paystackLoader'
import {
  ArrowLeft,
  Clock,
  MapPin,
  CreditCard,
  Loader2,
  CheckCircle,
  Wallet,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { getBookingById, type Booking } from '@/services/bookings'
import { useQuery } from '@tanstack/react-query'
import { BookingActions } from '@/components/booking/BookingActions'
import { BookingHistory } from '@/components/booking/BookingHistory'
import { statusHint } from '@/lib/booking/lifecycle'
import { SERVICE_LABELS, formatLagos } from '@/lib/booking/details'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const statusSteps = ['pending', 'confirmed', 'completed']

export default function BookingDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [payLoading, setPayLoading] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)
  const [walletPayLoading, setWalletPayLoading] = useState(false)

  // The query key starts with 'bookings', so a booking notification (live, over the
  // existing notifications channel) refreshes this page without a reload.
  const bookingQuery = useQuery({
    queryKey: ['bookings', 'detail', params.id],
    queryFn: () => getBookingById(params.id),
    staleTime: 5_000,
  })
  useEffect(() => {
    if (bookingQuery.isFetched) {
      setBooking(bookingQuery.data ?? null)
      setIsLoading(false)
    }
  }, [bookingQuery.isFetched, bookingQuery.data])

  const paymentsQuery = useQuery({
    queryKey: ['payments-status'],
    queryFn: async () => {
      const response = await fetch('/api/payments/status', {
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      return response.ok && body.available === true
    },
    staleTime: 60_000,
  })
  // Until we know, assume it is available so a working Pay button is never hidden.
  const paymentsAvailable = paymentsQuery.data !== false

  useEffect(() => {
    if (profile?.role !== 'buyer') return
    const controller = new AbortController()
    fetch('/api/wallet', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return
        const result = await response.json()
        setWalletBalance(Number(result.balance_naira) || 0)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [profile?.role])

  const handlePayNow = async () => {
    if (!booking) return
    setPayLoading(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const email = user?.email

      if (!email) {
        toast.error('Please log in to pay')
        setPayLoading(false)
        return
      }

      const initRes = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          booking_id: booking.id,
        }),
      })

      const initData = await initRes.json()
      if (!initRes.ok) {
        toast.error(initData.error || 'Failed to initialize payment')
        setPayLoading(false)
        return
      }

      const paystack = await loadPaystack()
      if (!paystack) {
        toast.error(
          'Payment window could not load. Check your connection and try again.',
        )
        setPayLoading(false)
        return
      }

      const handler = paystack.setup({
        key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
        email,
        amount: initData.amount_kobo,
        ref: initData.reference,
        callback: async (response: any) => {
          const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reference: response.reference,
              booking_id: booking.id,
            }),
          })
          const verifyData = await verifyRes.json()
          if (verifyData.success) {
            toast.success('Payment successful!')
            setBooking((prev) =>
              prev
                ? { ...prev, payment_status: 'paid', status: 'confirmed' }
                : prev,
            )
          } else {
            toast.error('Payment verification failed')
          }
          setPayLoading(false)
        },
        onClose: () => {
          setPayLoading(false)
          toast('Payment window closed', { icon: '⚠️' })
        },
      })

      handler.openIframe()
    } catch (err: any) {
      toast.error(err.message || 'Payment failed')
      setPayLoading(false)
    }
  }

  const handleWalletPayment = async () => {
    if (!booking || walletPayLoading) return
    setWalletPayLoading(true)
    try {
      const response = await fetch('/api/payments/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: booking.id }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not pay with wallet')
      setBooking((current) =>
        current
          ? { ...current, payment_status: 'paid', status: 'confirmed' }
          : current,
      )
      setWalletBalance((current) =>
        Math.max(0, current - Number(result.amount_naira || 0)),
      )
      toast.success('Booking paid with your Food4Love wallet')
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : 'Could not pay with wallet',
      )
    } finally {
      setWalletPayLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
        Booking not found
      </div>
    )
  }

  const isCook = profile?.id === booking.cook_id
  const currentStep =
    booking.status === 'cancelled'
      ? -1
      : booking.status === 'completed'
        ? 2
        : booking.status === 'confirmed'
          ? 1
          : 0
  const viewer = isCook ? 'cook' : 'buyer'
  const canPay =
    booking.status === 'confirmed' &&
    ['unpaid', 'pending'].includes(booking.payment_status) &&
    !isCook
  const canPayWithWallet =
    canPay &&
    profile?.role === 'buyer' &&
    !booking.payment_reference &&
    walletBalance >= Number(booking.amount ?? booking.price)
  const isPaid = booking.payment_status === 'paid'
  const bookingAmount = Number(booking.amount ?? booking.price)
  const scheduledAt = booking.scheduled_for
    ? new Date(booking.scheduled_for)
    : null
  const serviceAddress = booking.service_address ?? 'Address not provided'

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24 pt-4">
      <div className="mx-auto max-w-lg px-4">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <h1 className="mb-2 text-2xl font-bold text-[var(--text)]">
          Booking Details
        </h1>
        <p className="mb-6 text-sm text-[var(--text-muted)]">
          ID: {booking.id.slice(0, 8)}
        </p>

        {/* Status Timeline */}
        <div className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between">
            {statusSteps.map((step, i) => (
              <div key={step} className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold uppercase ${
                    i <= currentStep
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--border)] text-[var(--text-muted)]'
                  }`}
                >
                  {i < currentStep ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span className="text-[9px] uppercase tracking-wide text-[var(--text-muted)]">
                  {step}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-center text-sm font-medium text-[var(--text)]">
            {statusHint(
              {
                status: booking.status,
                payment_status: booking.payment_status,
              },
              viewer,
            )}
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Cooking session
          </h3>
          <p className="text-sm leading-relaxed text-[var(--text)]">
            {booking.meal_description ??
              'Cooking service details not provided.'}
          </p>
          {booking.special_requests ? (
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
              {booking.special_requests}
            </p>
          ) : null}
          <div className="mt-3 flex justify-between border-t border-[var(--border)] pt-3 text-base font-bold text-[var(--text)]">
            <span>Service amount</span>
            <span className="text-[var(--primary)]">
              ₦{bookingAmount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="mb-6 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 text-[var(--primary)]" />
            <div>
              <p className="text-[var(--text-muted)]">Scheduled</p>
              <p className="font-medium text-[var(--text)]">
                {scheduledAt?.toLocaleString() ?? 'Schedule not provided'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 text-[var(--primary)]" />
            <div>
              <p className="text-[var(--text-muted)]">
                {booking.service_type === 'pickup'
                  ? 'Collection'
                  : booking.service_type === 'delivery'
                    ? 'Delivery address'
                    : 'Where the cook will come'}
              </p>
              <p className="font-medium text-[var(--text)]">
                {booking.service_type === 'pickup'
                  ? 'The cook will tell you where to collect it.'
                  : serviceAddress}
              </p>
            </div>
          </div>
        </div>

        {(booking.service_type ||
          booking.allergies ||
          (booking.dietary_preferences ?? []).length > 0 ||
          booking.guest_count) && (
          <div className="mb-6 space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
            {booking.service_type && (
              <p className="text-[var(--text)]">
                <span className="text-[var(--text-muted)]">Service: </span>
                {SERVICE_LABELS[booking.service_type]}
              </p>
            )}
            {booking.guest_count ? (
              <p className="text-[var(--text)]">
                <span className="text-[var(--text-muted)]">People: </span>
                {booking.guest_count}
              </p>
            ) : null}
            {booking.allergies && (
              <p className="text-[var(--text)]">
                <span className="text-[var(--text-muted)]">Allergies: </span>
                {booking.allergies}
              </p>
            )}
            {(booking.dietary_preferences ?? []).length > 0 && (
              <p className="text-[var(--text)]">
                <span className="text-[var(--text-muted)]">Diet: </span>
                {(booking.dietary_preferences ?? []).join(', ')}
              </p>
            )}
            {booking.status === 'alternative_proposed' &&
              booking.scheduled_for && (
                <p className="text-xs text-[var(--text-muted)]">
                  Original time: {formatLagos(booking.scheduled_for)}
                </p>
              )}
          </div>
        )}

        <BookingHistory bookingId={booking.id} />

        {/* Actions */}
        <div className="space-y-3">
          <BookingActions
            booking={booking}
            viewer={viewer}
            onChanged={() => void bookingQuery.refetch()}
          />

          {canPay && paymentsAvailable && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handlePayNow}
              disabled={payLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 font-bold text-white shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
            >
              {payLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5" />
                  Pay Now • ₦{bookingAmount.toLocaleString()}
                </>
              )}
            </motion.button>
          )}

          {canPayWithWallet && paymentsAvailable && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleWalletPayment}
              disabled={walletPayLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--primary)] bg-[var(--surface)] py-4 font-bold text-[var(--primary)] transition disabled:opacity-50"
            >
              {walletPayLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Wallet className="h-5 w-5" />
              )}
              Pay full amount from wallet · ₦{bookingAmount.toLocaleString()}
            </motion.button>
          )}

          {canPay &&
            profile?.role === 'buyer' &&
            walletBalance > 0 &&
            walletBalance < bookingAmount && (
              <p className="text-center text-xs text-[var(--text-muted)]">
                Wallet balance ₦{walletBalance.toLocaleString()} does not cover
                the full booking. You can still pay with Paystack or{' '}
                <Link
                  href="/profile"
                  className="font-semibold text-[var(--primary)] underline"
                >
                  add funds
                </Link>
                .
              </p>
            )}

          {canPay && !paymentsAvailable && (
            <p
              role="status"
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center text-sm text-[var(--text-muted)]"
            >
              The cook accepted your booking, but online payment is not
              available yet, so it cannot be paid for right now. Nothing has
              been charged. You will be told when payment opens.
            </p>
          )}

          {isPaid && (
            <div className="bg-[var(--success)]/10 flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold text-[var(--success)]">
              <CheckCircle className="h-5 w-5" />
              Payment Confirmed
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
