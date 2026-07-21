'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, Clock, Users, MessageSquare, ChefHat } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Profile } from '@/types/db'
import { createBooking } from '@/services/bookings'
import { useAuthStore } from '@/stores/useAuthStore'
import { formatNaira } from '@/lib/utils'
import toast from 'react-hot-toast'

interface BookingFormProps {
  isOpen: boolean
  chef: Profile
  matchId: string
  onClose: () => void
  onSuccess?: (bookingId: string) => void
}

const MEAL_OPTIONS = [
  { id: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { id: 'lunch', label: 'Lunch', emoji: '🍽️' },
  { id: 'dinner', label: 'Dinner', emoji: '🌙' },
  { id: 'party', label: 'Party / Event', emoji: '🎉' },
]

const GUEST_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12]

export function BookingForm({
  isOpen,
  chef,
  matchId,
  onClose,
  onSuccess,
}: BookingFormProps) {
  const profile = useAuthStore((s) => s.profile)
  const [step, setStep] = useState<'details' | 'confirm'>('details')
  const [mealType, setMealType] = useState('')
  const [dishTitle, setDishTitle] = useState('')
  const [guests, setGuests] = useState(2)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const estimatedPrice = chef.price_min ? chef.price_min * guests : null

  const canProceed = dishTitle.trim().length > 2 && date && time && mealType

  const handleConfirm = async () => {
    if (!profile?.id || !chef.id) return
    setLoading(true)
    try {
      const scheduledFor = new Date(`${date}T${time}`).toISOString()
      const booking = await createBooking({
        match_id: matchId,
        cook_id: chef.id,
        buyer_id: profile.id,
        dish_title: dishTitle.trim(),
        price: estimatedPrice ?? chef.price_min ?? 0,
        scheduled_for: scheduledFor,
      })
      toast.success('Booking request sent! 🎉')
      onSuccess?.(booking.id)
      onClose()
    } catch {
      toast.error('Could not send booking request. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setStep('details')
    setMealType('')
    setDishTitle('')
    setGuests(2)
    setDate('')
    setTime('')
    setNotes('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-40"
            style={{
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(6px)',
            }}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
            className="fixed bottom-0 left-0 right-0 z-50 overflow-hidden rounded-t-[2rem]"
            style={{
              background: 'var(--card)',
              maxHeight: '92dvh',
            }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pb-1 pt-3">
              <div
                className="h-1 w-10 rounded-full"
                style={{ background: 'var(--divider)' }}
              />
            </div>

            <div
              className="overflow-y-auto px-5 pb-8"
              style={{ maxHeight: '88dvh' }}
            >
              {/* Header */}
              <div className="mb-5 flex items-start justify-between pt-2">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={chef.avatar_url}
                    name={chef.full_name}
                    size="md"
                    verified={chef.is_verified}
                  />
                  <div>
                    <h2
                      className="font-heading text-lg font-bold"
                      style={{ color: 'var(--text-1)' }}
                    >
                      Book {chef.full_name}
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {chef.price_min
                        ? `From ${formatNaira(chef.price_min)} per meal`
                        : 'Price on request'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: 'var(--bg-2)' }}
                >
                  <X className="h-4 w-4" style={{ color: 'var(--text-3)' }} />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {step === 'details' ? (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                  >
                    {/* Meal type */}
                    <div>
                      <label
                        className="mb-2 block text-xs font-bold uppercase tracking-wider"
                        style={{ color: 'var(--text-3)' }}
                      >
                        Meal type
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {MEAL_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setMealType(opt.id)}
                            className="flex items-center gap-2 rounded-2xl p-3 text-left text-sm font-semibold transition-all"
                            style={{
                              background:
                                mealType === opt.id
                                  ? 'var(--accent-soft)'
                                  : 'var(--bg-2)',
                              border: `1px solid ${mealType === opt.id ? 'var(--accent)' : 'var(--border)'}`,
                              color:
                                mealType === opt.id
                                  ? 'var(--accent)'
                                  : 'var(--text-2)',
                            }}
                          >
                            <span className="text-xl">{opt.emoji}</span>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* What would you like */}
                    <div>
                      <label
                        className="mb-2 block text-xs font-bold uppercase tracking-wider"
                        style={{ color: 'var(--text-3)' }}
                      >
                        <ChefHat
                          className="mr-1 inline h-3.5 w-3.5"
                          style={{ color: 'var(--accent)' }}
                        />
                        What would you like?
                      </label>
                      <input
                        value={dishTitle}
                        onChange={(e) => setDishTitle(e.target.value)}
                        placeholder="e.g. Jollof rice, grilled chicken, plantain"
                        className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition-all"
                        style={{
                          background: 'var(--bg-2)',
                          border: `1px solid ${dishTitle.length > 2 ? 'var(--accent)' : 'var(--border)'}`,
                          color: 'var(--text-1)',
                        }}
                      />
                    </div>

                    {/* Date & time */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider"
                          style={{ color: 'var(--text-3)' }}
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          Date
                        </label>
                        <input
                          type="date"
                          value={date}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                          style={{
                            background: 'var(--bg-2)',
                            border: `1px solid ${date ? 'var(--accent)' : 'var(--border)'}`,
                            color: 'var(--text-1)',
                          }}
                        />
                      </div>
                      <div>
                        <label
                          className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider"
                          style={{ color: 'var(--text-3)' }}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          Time
                        </label>
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                          style={{
                            background: 'var(--bg-2)',
                            border: `1px solid ${time ? 'var(--accent)' : 'var(--border)'}`,
                            color: 'var(--text-1)',
                          }}
                        />
                      </div>
                    </div>

                    {/* Guests */}
                    <div>
                      <label
                        className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider"
                        style={{ color: 'var(--text-3)' }}
                      >
                        <Users className="h-3.5 w-3.5" />
                        Number of people
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {GUEST_OPTIONS.map((n) => (
                          <button
                            key={n}
                            onClick={() => setGuests(n)}
                            className="h-9 w-9 rounded-xl text-sm font-bold transition-all"
                            style={{
                              background:
                                guests === n ? 'var(--accent)' : 'var(--bg-2)',
                              border: `1px solid ${guests === n ? 'var(--accent)' : 'var(--border)'}`,
                              color: guests === n ? '#fff' : 'var(--text-2)',
                            }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Special requests */}
                    <div>
                      <label
                        className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider"
                        style={{ color: 'var(--text-3)' }}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Special requests{' '}
                        <span className="font-normal normal-case">
                          (optional)
                        </span>
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Allergies, dietary needs, extra spice..."
                        rows={2}
                        className="w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none"
                        style={{
                          background: 'var(--bg-2)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-1)',
                        }}
                      />
                    </div>

                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full rounded-2xl py-4 font-bold text-white"
                      disabled={!canProceed}
                      onClick={() => setStep('confirm')}
                      style={{
                        background: canProceed ? 'var(--accent)' : undefined,
                      }}
                    >
                      Review booking →
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <h3
                      className="font-heading text-base font-bold"
                      style={{ color: 'var(--text-1)' }}
                    >
                      Confirm your booking
                    </h3>

                    {/* Summary card */}
                    <div
                      className="space-y-3 rounded-2xl p-4"
                      style={{
                        background: 'var(--bg-2)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {[
                        {
                          label: 'Chef',
                          value: chef.full_name,
                        },
                        { label: 'Meal', value: dishTitle },
                        {
                          label: 'Type',
                          value:
                            MEAL_OPTIONS.find((m) => m.id === mealType)
                              ?.label ?? '',
                        },
                        {
                          label: 'When',
                          value: `${new Date(date).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`,
                        },
                        { label: 'Guests', value: `${guests} people` },
                        ...(notes ? [{ label: 'Notes', value: notes }] : []),
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between gap-3">
                          <span
                            className="shrink-0 text-sm"
                            style={{ color: 'var(--text-3)' }}
                          >
                            {label}
                          </span>
                          <span
                            className="text-right text-sm font-semibold"
                            style={{ color: 'var(--text-1)' }}
                          >
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Price estimate */}
                    {estimatedPrice && (
                      <div
                        className="flex items-center justify-between rounded-2xl p-4"
                        style={{
                          background: 'var(--accent-soft)',
                          border:
                            '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                        }}
                      >
                        <span
                          className="text-sm font-semibold"
                          style={{ color: 'var(--text-2)' }}
                        >
                          Estimated total
                        </span>
                        <span
                          className="font-heading text-xl font-bold"
                          style={{ color: 'var(--accent)' }}
                        >
                          {formatNaira(estimatedPrice)}
                        </span>
                      </div>
                    )}

                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: 'var(--text-3)' }}
                    >
                      The chef will confirm availability. Payment is handled
                      after confirmation.
                    </p>

                    <div className="flex gap-3">
                      <Button
                        variant="ghost"
                        size="md"
                        className="flex-1"
                        onClick={() => setStep('details')}
                      >
                        ← Edit
                      </Button>
                      <Button
                        variant="primary"
                        size="md"
                        className="flex-1 font-bold text-white"
                        disabled={loading}
                        onClick={handleConfirm}
                        style={{ background: 'var(--accent)' }}
                      >
                        {loading ? 'Sending…' : 'Send request 🎉'}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
