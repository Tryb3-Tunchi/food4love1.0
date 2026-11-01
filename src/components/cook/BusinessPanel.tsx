'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Film,
  Inbox,
  MapPin,
  ReceiptText,
  ShieldCheck,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { getCookDashboard } from '@/services/cookDashboard'
import {
  PERIOD_LABELS,
  getProfileChecklist,
  splitBookings,
  summarizeOrders,
  type Period,
} from '@/lib/dashboard'
import { formatNaira } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
}

const MANAGE_LINKS = [
  {
    href: '/cook/specials',
    icon: UtensilsCrossed,
    title: 'My menu',
    detail: 'Post and manage your meals',
  },
  {
    href: '/bookings',
    icon: ReceiptText,
    title: 'Orders',
    detail: 'Every booking in one place',
  },
  {
    href: '/stories',
    icon: Film,
    title: 'Stories and posts',
    detail: 'Share what you’re cooking',
  },
  {
    href: '/cook/availability',
    icon: MapPin,
    title: 'Availability',
    detail: 'Hours, limits and areas',
  },
  {
    href: '/cook/payments',
    icon: Wallet,
    title: 'Payments',
    detail: 'Order value and payment status',
  },
  {
    href: '/cook/verification',
    icon: ShieldCheck,
    title: 'Verification and tips',
    detail: 'ID status and profile quality',
  },
]

function StatCard({
  icon: Icon,
  label,
  value,
  note,
}: {
  icon: typeof Inbox
  label: string
  value: string | number
  note?: string
}) {
  return (
    <div className="f4l-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: 'var(--accent)' }} />
        <p className="f4l-section-label">{label}</p>
      </div>
      <p
        className="font-heading text-2xl font-bold"
        style={{ color: 'var(--text-1)' }}
      >
        {value}
      </p>
      {note && (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
          {note}
        </p>
      )}
    </div>
  )
}

// The chef's business tools, shown as a tab on their own profile.
export function BusinessPanel() {
  const profile = useAuthStore((s) => s.profile)
  const [period, setPeriod] = useState<Period>('month')

  const { data, isLoading } = useQuery({
    queryKey: ['cook-dashboard', profile?.id],
    queryFn: () => getCookDashboard(profile!.id),
    enabled: !!profile?.id,
  })

  if (isLoading || !data || !profile) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  const { upcoming } = splitBookings(data.bookings)
  const stats = summarizeOrders(data.bookings, period)
  const checklist = getProfileChecklist(profile)
  const missing = checklist.filter((item) => !item.done)
  const percent = Math.round(
    ((checklist.length - missing.length) / checklist.length) * 100,
  )

  return (
    <div className="space-y-6">
      <Link
        href={missing.length ? missing[0].href : '/cook/verification'}
        className="f4l-card block p-4"
      >
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold" style={{ color: 'var(--text-1)' }}>
            Profile strength
          </span>
          <span className="font-bold" style={{ color: 'var(--accent)' }}>
            {percent}%
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full"
          style={{ background: 'var(--divider)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${percent}%`, background: 'var(--accent)' }}
          />
        </div>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-3)' }}>
          {missing.length
            ? `Next: ${missing[0].label.toLowerCase()}`
            : 'Your profile looks great. See more ways to stand out.'}
        </p>
      </Link>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="f4l-section-label">Business overview</p>
          <div className="flex gap-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((key) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  period === key
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-2)] text-[var(--text-2)]'
                }`}
              >
                {PERIOD_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={Inbox}
            label="New orders"
            value={stats.newOrders}
            note="Waiting for your reply"
          />
          <StatCard
            icon={Clock}
            label="In progress"
            value={stats.inProgress}
            note="Accepted, not yet done"
          />
          <StatCard
            icon={CheckCircle2}
            label="Completed"
            value={stats.completed}
            note={PERIOD_LABELS[period]}
          />
          <StatCard
            icon={Wallet}
            label="Order value"
            value={formatNaira(stats.earned)}
            note="Delivered orders, before fees"
          />
        </div>
      </section>

      <section>
        <p className="f4l-section-label mb-3">Manage your kitchen</p>
        <div className="f4l-card divide-y divide-[var(--divider)]">
          {MANAGE_LINKS.map(({ href, icon: Icon, title, detail }) => (
            <Link key={title} href={href}>
              <div className="flex items-center gap-3 p-4">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: 'var(--accent-soft)' }}
                >
                  <Icon
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
                <ChevronRight
                  className="h-4 w-4 shrink-0"
                  style={{ color: 'var(--text-3)' }}
                />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <p className="f4l-section-label mb-3">Upcoming bookings</p>
        {upcoming.length === 0 ? (
          <div className="f4l-card p-4">
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              No upcoming bookings yet.
            </p>
          </div>
        ) : (
          <div className="f4l-card divide-y divide-[var(--divider)]">
            {upcoming.slice(0, 5).map((booking) => (
              <Link key={booking.id} href={`/bookings/${booking.id}`}>
                <div className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: 'var(--text-1)' }}
                    >
                      {booking.buyer?.full_name ?? 'Food lover'}
                    </p>
                    <p
                      className="truncate text-xs"
                      style={{ color: 'var(--text-3)' }}
                    >
                      {booking.delivery_date
                        ? new Date(booking.delivery_date).toLocaleDateString(
                            'en-NG',
                            {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            },
                          )
                        : 'Date to be confirmed'}
                      {booking.delivery_time
                        ? ` · ${booking.delivery_time.slice(0, 5)}`
                        : ''}
                      {booking.meal_description
                        ? ` · ${booking.meal_description}`
                        : ''}
                    </p>
                  </div>
                  <span className="f4l-badge f4l-badge-accent">
                    {STATUS_LABELS[booking.status] ?? booking.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
