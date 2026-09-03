'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Calendar,
  MapPin,
  MessageSquare,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { createClient } from '@/lib/supabase/client'
import { createBooking } from '@/services/bookings'
import { MenuSelector } from './MenuSelector'
import { PriceBreakdown } from './PriceBreakdown'
import toast from 'react-hot-toast'

interface BookingFormProps {
  cookId: string
  matchId: string
}

export function BookingForm({ cookId, matchId }: BookingFormProps) {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedItems, setSelectedItems] = useState<
    { item: { id: string; name: string; price: number }; qty: number }[]
  >([])
  const [scheduledAt, setScheduledAt] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [specials, setSpecials] = useState<
    {
      id: string
      title: string
      price: number
      image_url?: string | null
      description?: string
    }[]
  >([])
  const [isLoadingSpecials, setIsLoadingSpecials] = useState(true)

  // Fetch cook's daily specials
  useState(() => {
    const fetchSpecials = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('daily_specials')
        .select('id, title, price, image_url, description')
        .eq('cook_id', cookId)
        .gte('available_until', new Date().toISOString())
      setSpecials(data ?? [])
      setIsLoadingSpecials(false)
    }
    fetchSpecials()
  })

  const menuItems = specials.map((s) => ({
    id: s.id,
    name: s.title,
    price: s.price,
    image: s.image_url,
    description: s.description,
  }))

  const subtotal = selectedItems.reduce(
    (sum, s) => sum + s.item.price * s.qty,
    0,
  )
  const deliveryFee = 500
  const serviceFee = Math.round(subtotal * 0.05)
  const total = subtotal + deliveryFee + serviceFee

  const handleSubmit = async () => {
    if (!profile?.id) {
      toast.error('Please log in to book')
      return
    }
    if (selectedItems.length === 0) {
      toast.error('Select at least one dish')
      return
    }
    if (!scheduledAt) {
      toast.error('Pick a delivery time')
      return
    }
    if (!address.trim()) {
      toast.error('Enter a delivery address')
      return
    }

    setIsSubmitting(true)
    try {
      await createBooking({
        buyer_id: profile.id,
        cook_id: cookId,
        match_id: matchId,
        items: selectedItems.map((s) => ({
          item_name: s.item.name,
          quantity: s.qty,
          unit_price: s.item.price,
        })),
        scheduled_at: new Date(scheduledAt).toISOString(),
        delivery_address: address,
        notes: notes || undefined,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
      })

      toast.success('Booking sent! Waiting for chef to confirm.')
      router.push('/bookings')
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong. Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-32 pt-4">
      <div className="mx-auto max-w-lg px-4">
        {/* Header */}
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <h1 className="mb-6 text-2xl font-bold text-[var(--text)]">
          Book a Meal
        </h1>

        <div className="space-y-6">
          {/* Menu */}
          {isLoadingSpecials ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
            </div>
          ) : (
            <MenuSelector
              items={menuItems}
              selected={selectedItems}
              onChange={setSelectedItems}
            />
          )}

          {/* Date & Time */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <Calendar className="h-4 w-4" />
              Delivery Time
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <MapPin className="h-4 w-4" />
              Delivery Address
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter your full delivery address..."
              rows={3}
              className="placeholder:text-[var(--text-muted)]/40 w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <MessageSquare className="h-4 w-4" />
              Special Requests
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Allergies, spice level, packaging preferences..."
              rows={2}
              className="placeholder:text-[var(--text-muted)]/40 w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>

          {/* Price Breakdown */}
          {selectedItems.length > 0 && (
            <PriceBreakdown
              subtotal={subtotal}
              deliveryFee={deliveryFee}
              serviceFee={serviceFee}
              total={total}
            />
          )}

          {/* Submit */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={isSubmitting || selectedItems.length === 0}
            className="shadow-[var(--primary)]/20 fixed bottom-6 left-4 right-4 z-40 mx-auto max-w-lg rounded-2xl bg-[var(--primary)] py-4 text-center font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Sending...
              </span>
            ) : (
              `Place Order • ₦${total.toLocaleString()}`
            )}
          </motion.button>
        </div>
      </div>
    </div>
  )
}
