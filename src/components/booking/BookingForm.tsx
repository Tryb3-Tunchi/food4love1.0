'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Loader2, Minus, Plus } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { BookingRequestError, createBooking } from '@/services/bookings'
import { getDailySpecialsByCook } from '@/services/dailySpecials'
import { MenuSelector } from './MenuSelector'
import { PriceBreakdown } from './PriceBreakdown'
import { CookBookingPanel } from './CookBookingPanel'
import {
  DIETARY_OPTIONS,
  NO_ALLERGIES,
  SERVICE_HELP,
  SERVICE_LABELS,
  SERVICE_TYPES,
  addressFor,
  allergyIsDeclared,
  deliveryFeeFor,
  needsAddress,
  serviceFeeFor,
  totalFor,
  validateSchedule,
  type ServiceType,
} from '@/lib/booking/details'
import toast from 'react-hot-toast'

interface BookingFormProps {
  cookId: string
  matchId: string
}

type Field = 'items' | 'date' | 'time' | 'address' | 'allergies' | 'guests'

const inputClass =
  'w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]'
const labelClass =
  'text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]'

export function BookingForm({ cookId, matchId }: BookingFormProps) {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sentId, setSentId] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<
    { item: { id: string; name: string; price: number }; qty: number }[]
  >([])
  const [serviceType, setServiceType] = useState<ServiceType>('delivery')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [guestCount, setGuestCount] = useState(2)
  const [address, setAddress] = useState('')
  const [noAllergies, setNoAllergies] = useState(false)
  const [allergies, setAllergies] = useState('')
  const [dietary, setDietary] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
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
  const refs = {
    items: useRef<HTMLDivElement>(null),
    date: useRef<HTMLInputElement>(null),
    time: useRef<HTMLInputElement>(null),
    address: useRef<HTMLTextAreaElement>(null),
    allergies: useRef<HTMLTextAreaElement>(null),
    guests: useRef<HTMLInputElement>(null),
  }

  // The server decides who can be booked; this just asks so the form can show the
  // right thing. An unverified cook never gets a form.
  const status = useQuery({
    queryKey: ['booking-status', cookId],
    queryFn: async () => {
      const response = await fetch(`/api/booking-status?cook_id=${cookId}`, {
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok)
        throw new Error(body.error || 'Could not check this cook')
      return body as { bookable: boolean; label: string }
    },
    staleTime: 15_000,
  })

  const payments = useQuery({
    queryKey: ['payments-status'],
    queryFn: async () => {
      const response = await fetch('/api/payments/status', {
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      return { available: response.ok && body.available === true }
    },
    staleTime: 60_000,
  })

  useEffect(() => {
    let cancelled = false
    getDailySpecialsByCook(cookId)
      .then((data) => {
        if (!cancelled)
          setSpecials(data.filter((special) => !special.is_paused))
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load this cook’s current menu')
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSpecials(false)
      })
    return () => {
      cancelled = true
    }
  }, [cookId])

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
  const deliveryFee = deliveryFeeFor(serviceType)
  const serviceFee = serviceFeeFor(subtotal)
  const total = totalFor(subtotal, serviceType)

  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), [])

  function validate(): Partial<Record<Field, string>> {
    const next: Partial<Record<Field, string>> = {}
    if (selectedItems.length === 0) next.items = 'Choose at least one dish.'
    if (!date) next.date = 'Choose a date.'
    if (!time) next.time = 'Choose a time.'
    if (date && time) {
      const result = validateSchedule(new Date(`${date}T${time}`))
      if (!result.ok) next.time = result.reason
    }
    if (needsAddress(serviceType) && !addressFor(serviceType, address)) {
      next.address =
        serviceType === 'private_cooking'
          ? 'Enter the full address where the cook should come.'
          : 'Enter the full delivery address.'
    }
    if (!noAllergies && !allergyIsDeclared(allergies)) {
      next.allergies =
        'Tell us about any allergies, or tick “No allergies or food restrictions”.'
    }
    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 20) {
      next.guests = 'Guests must be between 1 and 20.'
    }
    return next
  }

  const handleSubmit = async () => {
    if (!profile?.id) {
      toast.error('Please log in to book')
      return
    }
    const found = validate()
    setErrors(found)
    const first = (Object.keys(found) as Field[])[0]
    if (first) {
      refs[first].current?.focus()
      refs[first].current?.scrollIntoView?.({
        block: 'center',
        behavior: 'smooth',
      })
      return
    }
    setIsSubmitting(true)
    try {
      const booking = await createBooking({
        cook_id: cookId,
        match_id: matchId,
        items: selectedItems.map((s) => ({
          special_id: s.item.id,
          quantity: s.qty,
        })),
        scheduled_at: new Date(`${date}T${time}`).toISOString(),
        service_type: serviceType,
        service_address: needsAddress(serviceType) ? address.trim() : undefined,
        allergies: noAllergies ? NO_ALLERGIES : allergies.trim(),
        dietary_preferences: dietary,
        special_requests: notes.trim() || undefined,
        guest_count: guestCount,
      })
      setSentId(booking.id)
    } catch (err) {
      if (
        err instanceof BookingRequestError &&
        err.code === 'cook_not_verified'
      ) {
        void status.refetch() // the cook changed since the page opened
      }
      if (
        err instanceof BookingRequestError &&
        err.code === 'duplicate_booking' &&
        err.bookingId
      ) {
        setSentId(err.bookingId)
        toast('You already sent this request.')
      } else {
        toast.error(
          err instanceof Error ? err.message : 'Could not send your request.',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleDietary = (option: string) =>
    setDietary((current) =>
      current.includes(option)
        ? current.filter((x) => x !== option)
        : [...current, option],
    )

  const errorText = (field: Field) =>
    errors[field] ? (
      <p id={`${field}-error`} role="alert" className="text-sm text-red-600">
        {errors[field]}
      </p>
    ) : null

  // ------------------------------------------------------- after sending
  if (sentId) {
    return (
      <div className="min-h-screen bg-[var(--bg)] pb-24 pt-8">
        <div className="mx-auto max-w-lg px-4 text-center">
          <CheckCircle2
            className="mx-auto h-12 w-12 text-[var(--primary)]"
            aria-hidden="true"
          />
          <h1 className="mt-4 text-2xl font-bold text-[var(--text)]">
            Request sent
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            The cook has your request. When they respond you will be notified.
            If they accept, you will be asked to pay to secure the booking.
            Nothing has been charged yet.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={`/bookings/${sentId}`}
              className="flex min-h-12 items-center justify-center rounded-2xl bg-[var(--primary)] font-bold text-white"
            >
              View your booking
            </Link>
            <Link
              href={`/chat/${matchId}`}
              className="flex min-h-12 items-center justify-center rounded-2xl border border-[var(--border)] font-semibold text-[var(--text)]"
            >
              Back to the conversation
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------- verification gate
  if (status.isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--bg)]"
        role="status"
        aria-label="Loading"
      >
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    )
  }
  if (!status.data?.bookable) {
    return (
      <div className="min-h-screen bg-[var(--bg)] pb-24 pt-4">
        <div className="mx-auto max-w-lg px-4">
          <button
            onClick={() => router.back()}
            className="mb-4 flex min-h-11 items-center gap-2 text-sm text-[var(--text-muted)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </button>
          <h1 className="mb-4 text-2xl font-bold text-[var(--text)]">
            Book a Meal
          </h1>
          <CookBookingPanel
            cookId={cookId}
            cookName="this cook"
            matchId={matchId}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-32 pt-4">
      <div className="mx-auto max-w-lg px-4">
        <button
          onClick={() => router.back()}
          className="mb-4 flex min-h-11 items-center gap-2 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>

        <h1 className="mb-1 text-2xl font-bold text-[var(--text)]">
          Book a Meal
        </h1>
        <p className="mb-6 text-sm text-[var(--text-muted)]">
          This sends a request to the cook. Nothing is charged until they accept
          it.
        </p>

        <div className="space-y-6">
          {/* Menu */}
          <div
            ref={refs.items}
            tabIndex={-1}
            aria-describedby={errors.items ? 'items-error' : undefined}
          >
            {isLoadingSpecials ? (
              <div
                className="flex justify-center py-8"
                role="status"
                aria-label="Loading menu"
              >
                <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
              </div>
            ) : (
              <MenuSelector
                items={menuItems}
                selected={selectedItems}
                onChange={setSelectedItems}
              />
            )}
            {errorText('items')}
          </div>

          {/* Service type */}
          <fieldset className="space-y-2">
            <legend className={labelClass}>How would you like it?</legend>
            <div className="grid gap-2">
              {SERVICE_TYPES.map((type) => (
                <label
                  key={type}
                  className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border p-3 ${
                    serviceType === type
                      ? 'border-[var(--primary)] bg-[var(--surface)]'
                      : 'border-[var(--border)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="service-type"
                    value={type}
                    checked={serviceType === type}
                    onChange={() => setServiceType(type)}
                    className="mt-1 h-5 w-5 shrink-0 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="block font-semibold text-[var(--text)]">
                      {SERVICE_LABELS[type]}
                    </span>
                    <span className="block text-sm text-[var(--text-muted)]">
                      {SERVICE_HELP[type]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Date and time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="booking-date" className={labelClass}>
                Date
              </label>
              <input
                id="booking-date"
                ref={refs.date}
                type="date"
                min={minDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-invalid={!!errors.date}
                aria-describedby={errors.date ? 'date-error' : undefined}
                className={inputClass}
              />
              {errorText('date')}
            </div>
            <div className="space-y-2">
              <label htmlFor="booking-time" className={labelClass}>
                Time
              </label>
              <input
                id="booking-time"
                ref={refs.time}
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                aria-invalid={!!errors.time}
                aria-describedby={errors.time ? 'time-error' : undefined}
                className={inputClass}
              />
              {errorText('time')}
            </div>
          </div>

          {/* Guests */}
          <div className="space-y-2">
            <label htmlFor="guest-count" className={labelClass}>
              Number of people
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Fewer people"
                onClick={() => setGuestCount((n) => Math.max(1, n - 1))}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)]"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <input
                id="guest-count"
                ref={refs.guests}
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                value={guestCount}
                onChange={(event) =>
                  setGuestCount(Number(event.target.value) || 1)
                }
                aria-invalid={!!errors.guests}
                className={`${inputClass} text-center`}
              />
              <button
                type="button"
                aria-label="More people"
                onClick={() => setGuestCount((n) => Math.min(20, n + 1))}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {errorText('guests')}
          </div>

          {/* Address: only when the service needs one */}
          {needsAddress(serviceType) && (
            <div className="space-y-2">
              <label htmlFor="service-address" className={labelClass}>
                {serviceType === 'private_cooking'
                  ? 'Where should the cook come?'
                  : 'Delivery address'}
              </label>
              <textarea
                id="service-address"
                ref={refs.address}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, area and landmark…"
                rows={3}
                autoComplete="street-address"
                aria-invalid={!!errors.address}
                aria-describedby={
                  errors.address ? 'address-error' : 'address-help'
                }
                className={`${inputClass} resize-none`}
              />
              <p id="address-help" className="text-xs text-[var(--text-muted)]">
                Only the cook you book can see this.
              </p>
              {errorText('address')}
            </div>
          )}

          {/* Allergies and dietary needs: safety-critical, so stated either way */}
          <fieldset className="space-y-3 rounded-2xl border border-[var(--border)] p-4">
            <legend className={`${labelClass} px-1`}>Allergies and diet</legend>
            <p className="text-xs text-[var(--text-muted)]">
              Shared only with the cook, for this booking. The cook can’t
              promise an allergen-free meal, so check with them directly.
            </p>
            <label className="flex min-h-11 items-center gap-3 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={noAllergies}
                onChange={(e) => setNoAllergies(e.target.checked)}
                className="h-5 w-5 accent-[var(--primary)]"
              />
              No allergies or food restrictions
            </label>
            {!noAllergies && (
              <div className="space-y-2">
                <label
                  htmlFor="allergies"
                  className="text-sm font-medium text-[var(--text)]"
                >
                  Allergies
                </label>
                <textarea
                  id="allergies"
                  ref={refs.allergies}
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="For example: peanuts, shellfish"
                  rows={2}
                  aria-invalid={!!errors.allergies}
                  aria-describedby={
                    errors.allergies ? 'allergies-error' : undefined
                  }
                  className={`${inputClass} resize-none`}
                />
                {errorText('allergies')}
              </div>
            )}
            <div
              role="group"
              aria-label="Dietary preferences"
              className="flex flex-wrap gap-2"
            >
              {DIETARY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={dietary.includes(option)}
                  onClick={() => toggleDietary(option)}
                  className={`min-h-11 rounded-full border px-4 text-sm ${
                    dietary.includes(option)
                      ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                      : 'border-[var(--border)] text-[var(--text)]'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Extra instructions */}
          <div className="space-y-2">
            <label htmlFor="notes" className={labelClass}>
              Anything else? (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Spice level, packaging, timing…"
              rows={2}
              maxLength={2000}
              className={`${inputClass} resize-none`}
            />
          </div>

          {selectedItems.length > 0 && (
            <PriceBreakdown
              subtotal={subtotal}
              deliveryFee={deliveryFee}
              serviceFee={serviceFee}
              total={total}
            />
          )}

          {payments.data && !payments.data.available && (
            <p
              role="status"
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--text-muted)]"
            >
              Online payment is not available yet. You can still send your
              request. The cook may accept it, but you will only be able to pay
              once payment opens, and nothing is charged now.
            </p>
          )}

          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="shadow-[var(--primary)]/20 fixed bottom-6 left-4 right-4 z-40 mx-auto min-h-12 max-w-lg rounded-2xl bg-[var(--primary)] py-4 text-center font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                Sending…
              </span>
            ) : (
              `Send request${subtotal > 0 ? ` • ₦${total.toLocaleString()}` : ''}`
            )}
          </motion.button>
        </div>
      </div>
    </div>
  )
}
