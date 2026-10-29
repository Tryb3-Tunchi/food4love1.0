'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Clock,
  MapPin,
  CreditCard,
  Loader2,
  CheckCircle,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  getBookingById,
  acceptBooking,
  type Booking,
} from '@/services/bookings'
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

  useEffect(() => {
    getBookingById(params.id)
      .then(setBooking)
      .finally(() => setIsLoading(false))
  }, [params.id])

  const handleAccept = async () => {
    try {
      await acceptBooking(params.id)
      toast.success('Booking accepted!')
      setBooking((prev) => (prev ? { ...prev, status: 'confirmed' } : prev))
    } catch {
      toast.error('Failed to update')
    }
  }

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

      const paystack = (window as any).PaystackPop
      if (!paystack) {
        toast.error('Paystack not loaded. Please refresh.')
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
  const currentStep = statusSteps.indexOf(booking.status)
  const canPay =
    ['pending', 'confirmed'].includes(booking.status) &&
    booking.payment_status === 'unpaid' &&
    !isCook
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
            {booking.status === 'pending' &&
              isCook &&
              'You have a new booking request!'}
            {booking.status === 'pending' &&
              !isCook &&
              'Waiting for chef to confirm...'}
            {booking.status === 'confirmed' &&
              !isPaid &&
              'Your cooking session is confirmed. Complete payment to continue.'}
            {booking.status === 'confirmed' &&
              isPaid &&
              'Payment confirmed! Chef will start preparing.'}
            {booking.status === 'completed' && 'Cooking session completed.'}
            {booking.status === 'cancelled' &&
              'This cooking session was cancelled.'}
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
                At-home service address
              </p>
              <p className="font-medium text-[var(--text)]">{serviceAddress}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {booking.status === 'pending' && isCook && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleAccept}
              className="shadow-[var(--primary)]/20 w-full rounded-2xl bg-[var(--primary)] py-4 font-bold text-white shadow-lg"
            >
              Accept Booking
            </motion.button>
          )}

          {canPay && (
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
