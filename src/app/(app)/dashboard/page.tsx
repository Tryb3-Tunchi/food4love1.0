'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  Inbox,
  ShieldAlert,
  UserCircle,
  UtensilsCrossed,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { getCookDashboard } from '@/services/cookDashboard'
import { getProfileChecklist, splitBookings } from '@/lib/dashboard'
import { formatNaira } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
}

function ActionRow({
  icon: Icon,
  title,
  detail,
  href,
}: {
  icon: typeof Inbox
  title: string
  detail: string
  href?: string
}) {
  const content = (
    <div className="flex items-center gap-3 p-4">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'var(--accent-soft)' }}
      >
        <Icon className="h-4 w-4" style={{ color: 'var(--accent)' }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          {detail}
        </p>
      </div>
      {href && (
        <ChevronRight
          className="h-4 w-4 shrink-0"
          style={{ color: 'var(--text-3)' }}
        />
      )}
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
}

export default function CookDashboardPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)

  useEffect(() => {
    if (profile && profile.role !== 'cook') router.replace('/swipe')
  }, [profile, router])

  const isCook = profile?.role === 'cook'

  const { data, isLoading } = useQuery({
    queryKey: ['cook-dashboard', profile?.id],
    queryFn: () => getCookDashboard(profile!.id),
    enabled: !!profile?.id && isCook,
  })

  if (!profile || !isCook || isLoading || !data) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  const { pending, upcoming, completed, earned } = splitBookings(data.bookings)
  const checklist = getProfileChecklist(profile)
  const missing = checklist.filter((item) => !item.done)
  const percent = Math.round(
    ((checklist.length - missing.length) / checklist.length) * 100,
  )
  const kyc = profile.kyc_status ?? 'unverified'
  const firstName = profile.full_name?.split(' ')[0]

  const actions = [
    pending.length > 0 && {
      icon: CalendarClock,
      title: `${pending.length} booking${pending.length === 1 ? '' : 's'} waiting for your reply`,
      detail: 'Accept or decline so buyers aren’t left waiting.',
      href: pending.length === 1 ? `/bookings/${pending[0].id}` : '/bookings',
    },
    data.newRequests > 0 && {
      icon: Inbox,
      title: `${data.newRequests} new match request${data.newRequests === 1 ? '' : 's'}`,
      detail: 'Food lovers who liked your profile.',
      href: '/requests',
    },
    (kyc === 'unverified' || kyc === 'rejected') && {
      icon: ShieldAlert,
      title:
        kyc === 'rejected'
          ? 'Your verification needs another look'
          : 'Verify your identity',
      detail: 'You can’t take bookings until you’re verified.',
      href: '/onboarding/kyc',
    },
    missing.length > 0 && {
      icon: UserCircle,
      title: 'Finish your profile',
      detail: missing.map((item) => item.label).join(' · '),
      href: missing[0].href,
    },
    data.specials.length === 0 && {
      icon: UtensilsCrossed,
      title: 'Post a special',
      detail: 'Give buyers something to order.',
      href: '/cook/specials',
    },
  ].filter(Boolean) as {
    icon: typeof Inbox
    title: string
    detail: string
    href: string
  }[]

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      <div className="bg-[var(--bg)]/80 sticky top-0 z-10 border-b border-[var(--border)] px-4 py-4 backdrop-blur-xl">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
          Dashboard
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>
          {firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'}
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5 p-4"
      >
        <section>
          <p className="f4l-section-label mb-3">Needs your attention</p>
          {actions.length === 0 ? (
            <div className="f4l-card p-4">
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                You’re all caught up.
              </p>
            </div>
          ) : (
            <div className="f4l-card divide-y divide-[var(--divider)]">
              {actions.map((action) => (
                <ActionRow key={action.title} {...action} />
              ))}
            </div>
          )}
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

        <section className="grid grid-cols-2 gap-3">
          <div className="f4l-card p-4">
            <p className="f4l-section-label mb-2">Profile</p>
            <p
              className="font-heading text-2xl font-bold"
              style={{ color: 'var(--text-1)' }}
            >
              {percent}%
            </p>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full"
              style={{ background: 'var(--border)' }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${percent}%`, background: 'var(--accent)' }}
              />
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-3)' }}>
              {missing.length === 0
                ? 'Complete'
                : `${missing.length} thing${missing.length === 1 ? '' : 's'} left`}
            </p>
          </div>

          <div className="f4l-card p-4">
            <p className="f4l-section-label mb-2">Verification</p>
            {kyc === 'verified' ? (
              <span className="f4l-badge f4l-badge-success">
                <BadgeCheck className="h-3 w-3" />
                Verified
              </span>
            ) : kyc === 'pending' ? (
              <span className="f4l-badge f4l-badge-warning">Under review</span>
            ) : (
              <span className="f4l-badge f4l-badge-muted">Not verified</span>
            )}
            <p className="mt-2 text-xs" style={{ color: 'var(--text-3)' }}>
              {kyc === 'verified'
                ? 'You can take bookings.'
                : kyc === 'pending'
                  ? 'Usually 24–48 hours.'
                  : 'Needed to take bookings.'}
            </p>
          </div>
        </section>

        <section>
          <p className="f4l-section-label mb-3">Completed orders</p>
          <div className="f4l-card p-4">
            {completed.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                Your completed orders will show up here.
              </p>
            ) : (
              <>
                <p
                  className="font-heading text-2xl font-bold"
                  style={{ color: 'var(--text-1)' }}
                >
                  {completed.length}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                  {completed.length === 1 ? 'order' : 'orders'} completed
                  {earned > 0 ? ` · ${formatNaira(earned)} in bookings` : ''}
                </p>
              </>
            )}
          </div>
        </section>
      </motion.div>
    </div>
  )
}
