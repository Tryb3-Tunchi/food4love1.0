'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronRight, Clock, Loader2, MapPin, Receipt } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/useAuthStore'
import { getMyBookings } from '@/services/bookings'
import { STATUS_LABELS } from '@/lib/booking/lifecycle'

// Labels come from the shared lifecycle so every screen says the same thing.
const statusColors: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  alternative_proposed: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  confirmed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  completed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
}

export default function BookingsPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const authLoading = useAuthStore((s) => s.loading)
  const {
    data: bookings = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['bookings', profile?.id, profile?.role],
    queryFn: () =>
      getMyBookings(profile!.id, profile!.role as 'buyer' | 'cook'),
    enabled:
      !!profile?.id && (profile.role === 'buyer' || profile.role === 'cook'),
    refetchInterval: 20_000,
  })

  useEffect(() => {
    if (!authLoading && !profile) router.replace('/login')
  }, [authLoading, profile, router])

  if (authLoading || !profile?.id || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 bg-[var(--bg)] px-6 text-center">
        <p role="alert" className="text-base font-semibold text-[var(--text)]">
          Your bookings could not be loaded.
        </p>
        <p className="text-sm text-[var(--text-muted)]">
          Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex min-h-11 items-center rounded-full bg-[var(--primary)] px-6 text-sm font-bold text-white"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24 pt-4">
      <div className="mx-auto max-w-lg px-4">
        <h1 className="mb-6 text-2xl font-bold text-[var(--text)]">
          My Bookings
        </h1>

        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Receipt className="mb-4 h-12 w-12 text-[var(--text-muted)] opacity-40" />
            <p className="text-lg font-medium text-[var(--text-muted)]">
              No bookings yet
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)] opacity-60">
              Start a chat with a chef and book your first meal
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking, i) => {
              const scheduledAt = booking.scheduled_for
                ? new Date(booking.scheduled_for)
                : null
              const serviceAddress =
                booking.service_address ?? 'Address not provided'
              const bookingAmount = Number(booking.amount ?? booking.price)

              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => router.push(`/bookings/${booking.id}`)}
                  className="hover:border-[var(--primary)]/30 cursor-pointer rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-[var(--text)]">
                        {profile?.role === 'buyer'
                          ? (booking.cook?.full_name ?? 'Chef')
                          : (booking.buyer?.full_name ?? 'Customer')}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {new Date(booking.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusColors[booking.status]}`}
                    >
                      {STATUS_LABELS[booking.status] ?? booking.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-sm text-[var(--text-muted)]">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      {scheduledAt?.toLocaleString() ?? 'Schedule not provided'}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="line-clamp-1">{serviceAddress}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
                    <span className="text-sm font-bold text-[var(--primary)]">
                      ₦{bookingAmount.toLocaleString()}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
