'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Calendar,
  MapPin,
  CreditCard,
  CheckCircle,
  ChefHat,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createBooking } from '@/services/bookings'
// import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea";
import toast from 'react-hot-toast'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  cook: {
    id: string
    full_name: string
    avatar_url?: string
    daily_specials?: Array<{
      id: string
      title: string
      description: string
      price: number
      image_url?: string
    }>
    price_min?: number
    price_max?: number
  }
  matchId: string
  buyerId: string
}

type BookingStep = 'meal' | 'details' | 'payment' | 'success'

export function BookingModal({
  isOpen,
  onClose,
  cook,
  matchId,
  buyerId,
}: BookingModalProps) {
  const [step, setStep] = useState<BookingStep>('meal')
  const [selectedMeal, setSelectedMeal] = useState<string | 'custom'>('custom')
  const [customMeal, setCustomMeal] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [buyerEmail, setBuyerEmail] = useState('')

  // Get email from AUTH (not profile table)
  useEffect(() => {
    if (!isOpen) return
    const getEmail = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user?.email) setBuyerEmail(user.email)
    }
    getEmail()
  }, [isOpen])

  const selectedSpecial = cook.daily_specials?.find(
    (s) => s.id === selectedMeal,
  )
  const price = selectedSpecial?.price || cook.price_min || 0

  const handlePaystackPayment = async () => {
    if (!buyerEmail) {
      toast.error('Please sign in to complete booking')
      return
    }
    if (!buyerId) {
      toast.error('User ID missing. Please refresh.')
      return
    }

    setIsProcessing(true)
    try {
      const mealTitle =
        selectedMeal === 'custom'
          ? customMeal
          : selectedSpecial?.title || 'Custom Meal'

      const booking = await createBooking({
        match_id: matchId,
        cook_id: cook.id,
        buyer_id: buyerId,
        dish_title: mealTitle,
        price,
        scheduled_for: deliveryTime
          ? new Date(deliveryTime).toISOString()
          : null,
        status: 'pending',
      })

      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: buyerEmail,
          amount: price * 100,
          metadata: {
            booking_id: booking.id,
            cook_id: cook.id,
            buyer_id: buyerId,
          },
        }),
      })

      const data = await res.json()
      if (data.authorization_url) {
        window.location.href = data.authorization_url
      } else {
        throw new Error(data.error || 'Failed to initialize payment')
      }
    } catch (err: any) {
      toast.error(err.message || 'Payment failed. Please try again.')
      setIsProcessing(false)
    }
  }

  const resetAndClose = () => {
    setStep('meal')
    setSelectedMeal('custom')
    setCustomMeal('')
    setDeliveryTime('')
    setAddress('')
    setNotes('')
    setIsProcessing(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        onClick={resetAndClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl sm:max-w-md sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-[var(--bg)]/95 sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] px-5 py-4 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-[var(--primary)]" />
              <h2 className="text-lg font-bold text-[var(--text)]">
                Book with {cook.full_name}
              </h2>
            </div>
            <button
              onClick={resetAndClose}
              className="rounded-full p-2 transition-colors hover:bg-[var(--bg-2)]"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-[var(--text-muted)]" />
            </button>
          </div>

          <div className="p-5">
            <AnimatePresence mode="wait">
              {step === 'meal' && (
                <motion.div
                  key="meal"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <p className="text-sm text-[var(--text-muted)]">
                    What would you like to order?
                  </p>
                  {cook.daily_specials && cook.daily_specials.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Today's Specials
                      </p>
                      {cook.daily_specials.map((special) => (
                        <button
                          key={special.id}
                          onClick={() => setSelectedMeal(special.id)}
                          className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${selectedMeal === special.id ? 'bg-[var(--primary)]/10 border-[var(--primary)]' : 'hover:border-[var(--primary)]/50 border-[var(--border)]'}`}
                        >
                          {special.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={special.image_url}
                              alt=""
                              className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--bg-2)]">
                              <ChefHat className="h-5 w-5 text-[var(--text-muted)]" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[var(--text)]">
                              {special.title}
                            </p>
                            <p className="line-clamp-1 text-xs text-[var(--text-muted)]">
                              {special.description}
                            </p>
                          </div>
                          <span className="flex-shrink-0 text-sm font-bold text-[var(--primary)]">
                            ₦{special.price.toLocaleString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedMeal('custom')}
                    className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${selectedMeal === 'custom' ? 'bg-[var(--primary)]/10 border-[var(--primary)]' : 'hover:border-[var(--primary)]/50 border-[var(--border)]'}`}
                  >
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--bg-2)] text-lg">
                      ✍️
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--text)]">
                        Custom Request
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Describe what you want
                      </p>
                    </div>
                  </button>

                  <AnimatePresence>
                    {selectedMeal === 'custom' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <Textarea
                          placeholder="e.g., Jollof rice with grilled chicken..."
                          value={customMeal}
                          onChange={(e) => setCustomMeal(e.target.value)}
                          className="mt-2"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button
                    onClick={() => setStep('details')}
                    disabled={selectedMeal === 'custom' && !customMeal.trim()}
                    className="hover:bg-[var(--primary)]/90 h-12 w-full rounded-xl bg-[var(--primary)] font-semibold text-white"
                  >
                    Continue
                  </Button>
                </motion.div>
              )}

              {step === 'details' && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      <Calendar className="h-3.5 w-3.5" /> Delivery Time
                    </label>
                    <input
                      type="datetime-local"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className="focus:ring-[var(--primary)]/50 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-2)] px-4 text-sm text-[var(--text)] focus:outline-none focus:ring-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      <MapPin className="h-3.5 w-3.5" /> Delivery Address
                    </label>
                    <Textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Enter your delivery address..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Special Requests
                    </label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any allergies, spice level..."
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setStep('meal')}
                      className="h-12 flex-1 rounded-xl border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-2)]"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => setStep('payment')}
                      disabled={!address.trim()}
                      className="hover:bg-[var(--primary)]/90 h-12 flex-1 rounded-xl bg-[var(--primary)] font-semibold text-white"
                    >
                      Review Order
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 'payment' && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] p-5">
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                      <span className="text-sm text-[var(--text-muted)]">
                        Meal
                      </span>
                      <span className="max-w-[60%] text-right text-sm font-medium text-[var(--text)]">
                        {selectedMeal === 'custom'
                          ? customMeal
                          : selectedSpecial?.title}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                      <span className="text-sm text-[var(--text-muted)]">
                        Chef
                      </span>
                      <span className="text-sm font-medium text-[var(--text)]">
                        {cook.full_name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                      <span className="text-sm text-[var(--text-muted)]">
                        Delivery
                      </span>
                      <span className="max-w-[60%] text-right text-sm font-medium text-[var(--text)]">
                        {address}
                      </span>
                    </div>
                    {notes && (
                      <div className="flex items-start justify-between border-b border-[var(--border)] pb-3">
                        <span className="text-sm text-[var(--text-muted)]">
                          Notes
                        </span>
                        <span className="max-w-[60%] text-right text-sm font-medium text-[var(--text)]">
                          {notes}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-bold text-[var(--text)]">
                        Total
                      </span>
                      <span className="text-2xl font-bold text-[var(--primary)]">
                        ₦{price.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setStep('details')}
                      className="h-12 flex-1 rounded-xl border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-2)]"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handlePaystackPayment}
                      disabled={isProcessing}
                      className="hover:bg-[var(--primary)]/90 h-12 flex-1 rounded-xl bg-[var(--primary)] font-semibold text-white"
                    >
                      {isProcessing ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <CreditCard className="h-4 w-4" /> Pay Now
                        </span>
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-5 py-8 text-center"
                >
                  <div className="bg-[var(--success)]/20 mx-auto flex h-20 w-20 items-center justify-center rounded-full">
                    <CheckCircle className="h-10 w-10 text-[var(--success)]" />
                  </div>
                  <div>
                    <h3 className="mb-1 text-2xl font-bold text-[var(--text)]">
                      Booking Confirmed!
                    </h3>
                    <p className="mx-auto max-w-xs text-sm text-[var(--text-muted)]">
                      {cook.full_name} has been notified. You'll receive a
                      confirmation once they accept.
                    </p>
                  </div>
                  <Button
                    onClick={resetAndClose}
                    className="hover:bg-[var(--primary)]/90 h-12 rounded-xl bg-[var(--primary)] px-8 font-semibold text-white"
                  >
                    Back to Chat
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
