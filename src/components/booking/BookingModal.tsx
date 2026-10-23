'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Calendar,
  Clock,
  MapPin,
  CheckCircle,
  Loader2,
  Minus,
  Plus,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  cookId: string
  cookName: string
  cookAvatar?: string | null
  priceMin: number
  matchId: string
  onSuccess?: () => void
}

export default function BookingModal({
  isOpen,
  onClose,
  cookId,
  cookName,
  cookAvatar,
  priceMin,
  matchId,
  onSuccess,
}: BookingModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [loading, setLoading] = useState(false)
  const [bookingId, setBookingId] = useState<string>('')

  const [mealDescription, setMealDescription] = useState('')
  const [serviceDate, setServiceDate] = useState('')
  const [serviceTime, setServiceTime] = useState('')
  const [address, setAddress] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  const [guests, setGuests] = useState(2)
  const [agreedPrice, setAgreedPrice] = useState(priceMin)

  useEffect(() => {
    if (isOpen) {
      setStep('form')
      setBookingId('')
      setMealDescription('')
      setServiceDate('')
      setServiceTime('')
      setAddress('')
      setSpecialRequests('')
      setGuests(2)
      setAgreedPrice(priceMin)
      setLoading(false)
    }
  }, [isOpen, priceMin])

  const formatNaira = (amount: number) => `₦${amount.toLocaleString()}`

  const handleCreateBooking = async () => {
    if (!mealDescription || !serviceDate || !serviceTime) {
      toast.error('Please fill in the cooking request, date, and time')
      return
    }
    if (!address.trim()) {
      toast.error('Please enter where the cook should visit')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cook_id: cookId,
          match_id: matchId,
          meal_description: mealDescription,
          service_date: serviceDate,
          service_time: serviceTime,
          address: address.trim(),
          special_requests: specialRequests || null,
          guests,
          amount: agreedPrice,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create booking')

      setBookingId(data.booking.id)
      setStep('success')
      onSuccess?.()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="bg-[var(--text-1)]/60 fixed inset-0 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl border-t border-[var(--border)] bg-[var(--bg)] p-6"
          >
            <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-[var(--border)]" />

            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-muted)]">
                  {cookAvatar ? (
                    <img
                      src={cookAvatar}
                      alt={cookName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-lg">🧑‍🍳</span>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-1)]">
                    Request at-home cooking
                  </h3>
                  <p className="text-sm text-[var(--text-3)]">
                    with {cookName}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-3)] transition hover:bg-[var(--bg-2)] hover:text-[var(--text-1)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* STEP 1: Form */}
            {step === 'form' && (
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--text-2)]">
                    What would you like the cook to prepare?
                  </label>
                  <textarea
                    value={mealDescription}
                    onChange={(e) => setMealDescription(e.target.value)}
                    placeholder="Describe the meal or cooking session you have in mind..."
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-3 text-sm text-[var(--text-1)] outline-none transition placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[var(--text-2)]">
                      <Calendar className="h-3.5 w-3.5" /> Date
                    </label>
                    <input
                      type="date"
                      value={serviceDate}
                      onChange={(e) => setServiceDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-3 text-sm text-[var(--text-1)] outline-none transition focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[var(--text-2)]">
                      <Clock className="h-3.5 w-3.5" /> Time
                    </label>
                    <input
                      type="time"
                      value={serviceTime}
                      onChange={(e) => setServiceTime(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-3 text-sm text-[var(--text-1)] outline-none transition focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--text-2)]">
                    Number of guests
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setGuests(Math.max(1, guests - 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-1)] transition hover:bg-[var(--bg-2)]"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-lg font-bold text-[var(--text-1)]">
                      {guests}
                    </span>
                    <button
                      onClick={() => setGuests(Math.min(20, guests + 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-1)] transition hover:bg-[var(--bg-2)]"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-[var(--text-2)]">
                      <MapPin className="h-3.5 w-3.5" /> Where should the cook
                      visit?
                    </label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter your home, apartment, or building address..."
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-3 text-sm text-[var(--text-1)] outline-none transition placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                      rows={2}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--text-2)]">
                    Special requests (optional)
                  </label>
                  <textarea
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="Any allergies, spice level, dietary requirements..."
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-3 text-sm text-[var(--text-1)] outline-none transition placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                    rows={2}
                  />
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-3)]">
                      Proposed service price
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-3)]">₦</span>
                      <input
                        type="number"
                        value={agreedPrice}
                        onChange={(e) => setAgreedPrice(Number(e.target.value))}
                        className="w-24 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2 text-right text-sm font-bold text-[var(--text-1)] outline-none transition focus:border-[var(--accent)]"
                        min={priceMin}
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-3)]">
                    Minimum: {formatNaira(priceMin)}. The cook can discuss the
                    request with you before confirming.
                  </p>
                </div>

                <button
                  onClick={handleCreateBooking}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-4 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating booking...
                    </>
                  ) : (
                    <>Send cooking request</>
                  )}
                </button>
              </div>
            )}

            {/* Request confirmation */}
            {step === 'success' && (
              <div className="space-y-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-[var(--success)]/10 mx-auto flex h-20 w-20 items-center justify-center rounded-full"
                >
                  <CheckCircle className="h-10 w-10 text-[var(--success)]" />
                </motion.div>
                <div>
                  <h4 className="text-xl font-bold text-[var(--text-1)]">
                    Request sent
                  </h4>
                  <p className="mt-1 text-sm text-[var(--text-3)]">
                    {cookName} can review your at-home cooking request and
                    respond from their bookings. Payment is available after they
                    confirm the session.
                  </p>
                </div>

                <div className="border-[var(--success)]/20 bg-[var(--success)]/5 rounded-xl border p-4">
                  <p className="text-sm text-[var(--success)]">
                    Booking ID:{' '}
                    <span className="font-mono font-bold">
                      {bookingId.slice(0, 8)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-3)]">
                    You can follow the request and its status from your
                    bookings.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      onClose()
                      router.push(`/bookings/${bookingId}`)
                    }}
                    className="flex-1 rounded-xl bg-[var(--accent)] py-3 text-sm font-bold text-white"
                  >
                    View Request
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] py-3 text-sm font-bold text-[var(--text-1)]"
                  >
                    Back to Chat
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
