'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Calendar,
  Clock,
  MapPin,
  CreditCard,
  CheckCircle,
  Loader2,
  Minus,
  Plus,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

export interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  cookId: string
  cookName: string
  cookAvatar?: string | null
  priceMin: number
  matchId: string
}

export default function BookingModal({
  isOpen,
  onClose,
  cookId,
  cookName,
  cookAvatar,
  priceMin,
  matchId,
}: BookingModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'payment' | 'success'>('form')
  const [loading, setLoading] = useState(false)
  const [bookingId, setBookingId] = useState<string>('')

  // Form state
  const [mealDescription, setMealDescription] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>(
    'delivery',
  )
  const [address, setAddress] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  const [guests, setGuests] = useState(2)
  const [agreedPrice, setAgreedPrice] = useState(priceMin)

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setStep('form')
      setBookingId('')
      setMealDescription('')
      setDeliveryDate('')
      setDeliveryTime('')
      setAddress('')
      setSpecialRequests('')
      setGuests(2)
      setAgreedPrice(priceMin)
      setLoading(false)
    }
  }, [isOpen, priceMin])

  const formatNaira = (amount: number) => `₦${amount.toLocaleString()}`

  const handleCreateBooking = async () => {
    if (!mealDescription || !deliveryDate || !deliveryTime) {
      toast.error('Please fill in meal, date, and time')
      return
    }
    if (deliveryType === 'delivery' && !address) {
      toast.error('Please enter delivery address')
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
          delivery_date: deliveryDate,
          delivery_time: deliveryTime,
          delivery_type: deliveryType,
          address: deliveryType === 'delivery' ? address : null,
          special_requests: specialRequests || null,
          guests,
          amount: agreedPrice,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create booking')

      setBookingId(data.booking.id)
      setStep('payment')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePaystackPayment = async () => {
    setLoading(true)

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const email = user?.email || ''

    const initRes = await fetch('/api/payments/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        amount: agreedPrice,
        booking_id: bookingId,
        metadata: {
          meal: mealDescription.slice(0, 50),
          chef: cookName,
          match_id: matchId,
        },
      }),
    })

    const initData = await initRes.json()
    if (!initRes.ok) {
      toast.error(initData.error || 'Failed to initialize payment')
      setLoading(false)
      return
    }

    const paystack = (window as any).PaystackPop
    if (!paystack) {
      toast.error('Paystack not loaded. Please refresh.')
      setLoading(false)
      return
    }

    const handler = paystack.setup({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email,
      amount: agreedPrice * 100,
      ref: initData.reference,
      metadata: {
        booking_id: bookingId,
        custom_fields: [
          {
            display_name: 'Meal',
            variable_name: 'meal',
            value: mealDescription.slice(0, 50),
          },
          { display_name: 'Chef', variable_name: 'chef', value: cookName },
        ],
      },
      callback: async (response: any) => {
        const verifyRes = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: response.reference,
            booking_id: bookingId,
          }),
        })
        const verifyData = await verifyRes.json()
        if (verifyData.success) {
          setStep('success')
        } else {
          toast.error('Payment verification failed. Contact support.')
        }
        setLoading(false)
      },
      onClose: () => {
        setLoading(false)
        toast('Payment cancelled. You can retry from your bookings.', {
          icon: '⚠️',
        })
      },
    })

    handler.openIframe()
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
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#1A1008] p-6"
          >
            <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-white/20" />

            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/10">
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
                  <h3 className="text-lg font-bold text-white">Book a Meal</h3>
                  <p className="text-sm text-white/50">with {cookName}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* STEP 1: Form */}
            {step === 'form' && (
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/70">
                    What would you like to order?
                  </label>
                  <textarea
                    value={mealDescription}
                    onChange={(e) => setMealDescription(e.target.value)}
                    placeholder="e.g. Ofe Akwu with pounded yam for 2 people..."
                    className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#E8390E]"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-white/70">
                      <Calendar className="h-3.5 w-3.5" /> Date
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-[#E8390E]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-white/70">
                      <Clock className="h-3.5 w-3.5" /> Time
                    </label>
                    <input
                      type="time"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-[#E8390E]"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/70">
                    Number of guests
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setGuests(Math.max(1, guests - 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-lg font-bold text-white">
                      {guests}
                    </span>
                    <button
                      onClick={() => setGuests(Math.min(20, guests + 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/70">
                    Delivery or Pickup?
                  </label>
                  <div className="flex gap-2">
                    {(['delivery', 'pickup'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setDeliveryType(type)}
                        className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium capitalize transition-all ${
                          deliveryType === type
                            ? 'border-[#E8390E] bg-[#E8390E]/10 text-[#E8390E]'
                            : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {deliveryType === 'delivery' && (
                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-white/70">
                      <MapPin className="h-3.5 w-3.5" /> Delivery Address
                    </label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter your full delivery address..."
                      className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#E8390E]"
                      rows={2}
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-white/70">
                    Special requests (optional)
                  </label>
                  <textarea
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="Any allergies, spice level, dietary requirements..."
                    className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#E8390E]"
                    rows={2}
                  />
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">Agreed price</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/40">₦</span>
                      <input
                        type="number"
                        value={agreedPrice}
                        onChange={(e) => setAgreedPrice(Number(e.target.value))}
                        className="w-24 rounded-lg border border-white/10 bg-white/5 p-2 text-right text-sm font-bold text-white outline-none focus:border-[#E8390E]"
                        min={priceMin}
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-white/40">
                    Minimum: {formatNaira(priceMin)}. Final price confirmed by
                    chef.
                  </p>
                </div>

                <button
                  onClick={handleCreateBooking}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8390E] py-4 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating booking...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Proceed to Payment — {formatNaira(agreedPrice)}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* STEP 2: Payment */}
            {step === 'payment' && (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E8390E]/10">
                  <CreditCard className="h-8 w-8 text-[#E8390E]" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">
                    Complete Payment
                  </h4>
                  <p className="mt-1 text-sm text-white/60">
                    Pay {formatNaira(agreedPrice)} to confirm your booking with{' '}
                    {cookName}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-left">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Meal</span>
                    <span className="text-white">
                      {mealDescription.slice(0, 30)}...
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-white/60">Date</span>
                    <span className="text-white">
                      {deliveryDate} at {deliveryTime}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-white/60">Guests</span>
                    <span className="text-white">{guests}</span>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-white/10 pt-3">
                    <span className="font-bold text-white">Total</span>
                    <span className="font-bold text-[#E8390E]">
                      {formatNaira(agreedPrice)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handlePaystackPayment}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8390E] py-4 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Pay with Paystack
                    </>
                  )}
                </button>

                <button
                  onClick={() => setStep('form')}
                  className="text-sm text-white/40 hover:text-white/60"
                >
                  ← Back to edit details
                </button>
              </div>
            )}

            {/* STEP 3: Success */}
            {step === 'success' && (
              <div className="space-y-6 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#84CC16]/10"
                >
                  <CheckCircle className="h-10 w-10 text-[#84CC16]" />
                </motion.div>
                <div>
                  <h4 className="text-xl font-bold text-white">
                    Booking Confirmed!
                  </h4>
                  <p className="mt-1 text-sm text-white/60">
                    Your meal with {cookName} is booked for {deliveryDate}.
                  </p>
                </div>

                <div className="rounded-xl border border-[#84CC16]/20 bg-[#84CC16]/5 p-4">
                  <p className="text-sm text-[#84CC16]">
                    Booking ID:{' '}
                    <span className="font-mono font-bold">
                      {bookingId.slice(0, 8)}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    A receipt has been sent to your email.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      onClose()
                      router.push(`/bookings/${bookingId}`)
                    }}
                    className="flex-1 rounded-xl bg-[#E8390E] py-3 text-sm font-bold text-white"
                  >
                    View Booking
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-white"
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
