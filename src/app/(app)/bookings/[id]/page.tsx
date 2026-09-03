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
  updateBookingStatus,
  type Booking,
} from '@/services/bookings'
import toast from 'react-hot-toast'

const statusSteps = ['pending', 'confirmed', 'preparing', 'ready', 'delivered']

export default function BookingDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getBookingById(params.id)
      .then(setBooking)
      .finally(() => setIsLoading(false))
  }, [params.id])

  const handleAccept = async () => {
    try {
      await updateBookingStatus(params.id, 'confirmed')
      toast.success('Booking accepted!')
      setBooking((prev) => (prev ? { ...prev, status: 'confirmed' } : prev))
    } catch {
      toast.error('Failed to update')
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
    booking.status === 'confirmed' &&
    booking.payment_status === 'unpaid' &&
    !isCook

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
              'Chef confirmed! Proceed to payment.'}
            {booking.status === 'preparing' && 'Chef is preparing your meal.'}
            {booking.status === 'ready' &&
              'Your meal is ready for pickup/delivery!'}
            {booking.status === 'delivered' && 'Enjoy your meal!'}
          </div>
        </div>

        {/* Items */}
        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Order Items
          </h3>
          <div className="space-y-2">
            {booking.items?.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-[var(--text)]">
                  {item.quantity}x {item.item_name}
                </span>
                <span className="text-[var(--text-muted)]">
                  ₦{item.total_price.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-[var(--border)] pt-3">
            <div className="flex justify-between text-sm text-[var(--text-muted)]">
              <span>Delivery</span>
              <span>₦{booking.delivery_fee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-[var(--text-muted)]">
              <span>Service Fee</span>
              <span>₦{booking.service_fee.toLocaleString()}</span>
            </div>
            <div className="mt-2 flex justify-between text-base font-bold text-[var(--text)]">
              <span>Total</span>
              <span className="text-[var(--primary)]">
                ₦{booking.total_amount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="mb-6 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 text-[var(--primary)]" />
            <div>
              <p className="text-[var(--text-muted)]">Scheduled</p>
              <p className="font-medium text-[var(--text)]">
                {new Date(booking.scheduled_at).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 text-[var(--primary)]" />
            <div>
              <p className="text-[var(--text-muted)]">Delivery Address</p>
              <p className="font-medium text-[var(--text)]">
                {booking.delivery_address}
              </p>
            </div>
          </div>
          {booking.notes && (
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 h-4 w-4 text-[var(--primary)]" />
              <div>
                <p className="text-[var(--text-muted)]">Notes</p>
                <p className="font-medium text-[var(--text)]">
                  {booking.notes}
                </p>
              </div>
            </div>
          )}
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
              onClick={() => toast('Paystack integration coming next!')}
              className="w-full rounded-2xl bg-emerald-500 py-4 font-bold text-white shadow-lg shadow-emerald-500/20"
            >
              Pay Now • ₦{booking.total_amount.toLocaleString()}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )
}
