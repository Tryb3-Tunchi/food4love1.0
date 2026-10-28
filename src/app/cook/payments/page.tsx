'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Banknote,
  CheckCircle2,
  ChevronRight,
  Clock,
  Info,
  Landmark,
  Receipt,
  RotateCcw,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { getMyBookings } from '@/services/bookings'
import { bookingAmount } from '@/lib/dashboard'
import { formatAmount, paymentState, summarizePayments } from '@/lib/payments'
import { Skeleton } from '@/components/ui/Skeleton'

const NOT_SET_UP = 'Not set up yet'

function Figure({
  icon: Icon,
  label,
  value,
  note,
  muted,
}: {
  icon: typeof Banknote
  label: string
  value: string
  note: string
  muted?: boolean
}) {
  return (
    <div className="f4l-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: 'var(--accent)' }} />
        <p className="f4l-section-label">{label}</p>
      </div>
      <p
        className={`font-heading font-bold ${muted ? 'text-base' : 'text-2xl'}`}
        style={{ color: muted ? 'var(--text-3)' : 'var(--text-1)' }}
      >
        {value}
      </p>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
        {note}
      </p>
    </div>
  )
}

export default function CookPaymentsPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const authLoading = useAuthStore((s) => s.loading)

  useEffect(() => {
    if (authLoading) return
    if (!profile) router.replace('/login')
    else if (profile.role !== 'cook') router.replace('/swipe')
  }, [authLoading, profile, router])

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['cook-payments', profile?.id],
    queryFn: () => getMyBookings(profile!.id, 'cook'),
    enabled: profile?.role === 'cook',
  })

  const summary = summarizePayments(bookings ?? [])
  const orders = (bookings ?? []).filter((b) => b.status !== 'pending')

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      <div className="bg-[var(--bg)]/80 sticky top-0 z-10 border-b border-[var(--border)] px-4 py-4 backdrop-blur-xl">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
          Payments
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>
          Order value, payment and payout, shown separately.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5 p-4"
      >
        <div
          className="flex gap-3 rounded-2xl p-4"
          style={{
            background: 'var(--accent-soft)',
            border:
              '1px solid color-mix(in srgb, var(--accent) 18%, transparent)',
          }}
        >
          <Info
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: 'var(--accent)' }}
          />
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            These are order amounts, not earnings. A paid order can still be
            refunded, and the platform fee and payouts aren’t set up yet, so
            nothing here counts as money you’ve received.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <section>
            <p className="f4l-section-label mb-3">Order value</p>
            <div className="grid grid-cols-2 gap-3">
              <Figure
                icon={CheckCircle2}
                label="Delivered"
                value={formatAmount(summary.deliveredValue)}
                note={`${summary.deliveredCount} order${summary.deliveredCount === 1 ? '' : 's'}, before any fee`}
              />
              <Figure
                icon={Banknote}
                label="Paid by buyers"
                value={formatAmount(summary.paidValue)}
                note={`${summary.paidCount} order${summary.paidCount === 1 ? '' : 's'}, still refundable`}
              />
              <Figure
                icon={Clock}
                label="Awaiting payment"
                value={formatAmount(summary.awaitingValue)}
                note={`${summary.awaitingCount} accepted order${summary.awaitingCount === 1 ? '' : 's'} not paid`}
              />
              <Figure
                icon={RotateCcw}
                label="Refunded"
                value={formatAmount(summary.refundedValue)}
                note={
                  summary.disputedCount > 0
                    ? `${summary.disputedCount} order${summary.disputedCount === 1 ? '' : 's'} in dispute`
                    : `${summary.refundedCount} order${summary.refundedCount === 1 ? '' : 's'}`
                }
              />
            </div>
          </section>
        )}

        <section>
          <p className="f4l-section-label mb-3">Fees and payout</p>
          <div className="f4l-card divide-y divide-[var(--divider)]">
            {[
              ['Platform fee', 'What the platform keeps from each order'],
              ['Net amount', 'Order value minus the platform fee'],
              ['Payout', 'When settled money reaches your bank account'],
            ].map(([title, detail]) => (
              <div key={title} className="flex items-center gap-3 p-4">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: 'var(--accent-soft)' }}
                >
                  <Landmark
                    className="h-4 w-4"
                    style={{ color: 'var(--accent)' }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: 'var(--text-1)' }}
                  >
                    {title}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                    {detail}
                  </p>
                </div>
                <span className="f4l-badge f4l-badge-muted">{NOT_SET_UP}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="f4l-section-label mb-3">Orders</p>
          {isLoading ? (
            <Skeleton className="h-20 rounded-2xl" />
          ) : orders.length === 0 ? (
            <div className="f4l-card p-4">
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                Accepted orders show up here with their payment state.
              </p>
            </div>
          ) : (
            <div className="f4l-card divide-y divide-[var(--divider)]">
              {orders.map((booking) => {
                const state = paymentState(booking)
                return (
                  <Link key={booking.id} href={`/bookings/${booking.id}`}>
                    <div className="flex items-center gap-3 p-4">
                      <Receipt
                        className="h-4 w-4 shrink-0"
                        style={{ color: 'var(--text-3)' }}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-sm font-semibold"
                          style={{ color: 'var(--text-1)' }}
                        >
                          {booking.meal_description ||
                            booking.buyer?.full_name ||
                            'Order'}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: 'var(--text-3)' }}
                        >
                          {new Date(booking.created_at).toLocaleDateString(
                            'en-NG',
                            { day: 'numeric', month: 'short' },
                          )}{' '}
                          · Payout: {NOT_SET_UP.toLowerCase()}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p
                          className="text-sm font-bold"
                          style={{ color: 'var(--text-1)' }}
                        >
                          {formatAmount(bookingAmount(booking))}
                        </p>
                        <span className={`f4l-badge f4l-badge-${state.tone}`}>
                          {state.label}
                        </span>
                      </div>
                      <ChevronRight
                        className="h-4 w-4 shrink-0"
                        style={{ color: 'var(--text-3)' }}
                      />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </motion.div>
    </div>
  )
}
