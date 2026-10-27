'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Bell,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Film,
  Inbox,
  MapPin,
  Plus,
  ReceiptText,
  ShieldAlert,
  Star,
  UserCircle,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useNotifications } from '@/hooks/useNotifications'
import { getCookDashboard } from '@/services/cookDashboard'
import {
  PERIOD_LABELS,
  getProfileChecklist,
  greetingFor,
  splitBookings,
  summarizeOrders,
  type Period,
} from '@/lib/dashboard'
import { formatNaira, getInitials } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'
import { CoverPhotoButton } from '@/components/cook/CoverPhotoButton'
import { DashboardGallery } from '@/components/cook/DashboardGallery'

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
}

const SECTION_LINKS = [
  {
    href: '/cook/specials',
    icon: UtensilsCrossed,
    title: 'My menu',
    detail: 'Post and manage your meals',
  },
  {
    href: '/requests',
    icon: Film,
    title: 'Stories and posts',
    detail: 'Share what you’re cooking',
  },
  {
    href: '/bookings',
    icon: ReceiptText,
    title: 'Orders',
    detail: 'Every booking in one place',
  },
  {
    href: '/cook/availability',
    icon: MapPin,
    title: 'Availability',
    detail: 'Hours, limits and areas',
  },
  {
    href: '#reviews',
    icon: Star,
    title: 'Reviews',
    detail: 'What customers say',
  },
  {
    href: '/profile',
    icon: UserCircle,
    title: 'Profile and settings',
    detail: 'Your public profile',
  },
]

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

export default function CookDashboardPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const { unreadCount } = useNotifications()
  const [period, setPeriod] = useState<Period>('month')

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

  const { pending, upcoming, completed } = splitBookings(data.bookings)
  const stats = summarizeOrders(data.bookings, period)
  const checklist = getProfileChecklist(profile)
  const missing = checklist.filter((item) => !item.done)
  const percent = Math.round(
    ((checklist.length - missing.length) / checklist.length) * 100,
  )
  const kyc = profile.kyc_status ?? 'unverified'
  const firstName = profile.full_name?.split(' ')[0]
  const coverUrl = profile.photos?.[0] ?? null

  const profileStats = [
    { label: 'Dishes', value: data.specials.length },
    { label: 'Orders done', value: completed.length },
    {
      label: 'Rating',
      value:
        data.reviewStats.count > 0 ? data.reviewStats.average.toFixed(1) : '—',
    },
  ]

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

  const recentReviews = data.reviews.slice(0, 3)

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5 p-4"
      >
        <section
          className="overflow-hidden rounded-3xl"
          style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)' }}
        >
          <div
            className="relative h-44 w-full"
            style={{
              background:
                'linear-gradient(135deg, var(--accent-l), var(--divider))',
            }}
          >
            {coverUrl && (
              <img
                src={coverUrl}
                alt="Your cover photo"
                className="h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            <div className="absolute right-3 top-3 flex items-center gap-2">
              <CoverPhotoButton />
              <Link
                href="/notifications"
                className="relative flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
                aria-label={
                  unreadCount > 0
                    ? `Notifications, ${unreadCount} unread`
                    : 'Notifications'
                }
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span
                    className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                    style={{ background: 'var(--accent)' }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="relative -mt-10 flex items-end justify-between">
              <div
                className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 text-xl font-bold"
                style={{
                  background: 'var(--card)',
                  borderColor: 'var(--card)',
                  color: 'var(--accent)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name ?? 'Your profile photo'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(profile.full_name ?? 'Chef')
                )}
              </div>
              <Link
                href={`/cook/${profile.id}`}
                className="mb-1 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: 'var(--bg-2)', color: 'var(--text-2)' }}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview public profile
              </Link>
            </div>

            <p className="mt-3 text-xs" style={{ color: 'var(--text-3)' }}>
              {greetingFor()}
            </p>
            <h1
              className="font-heading text-2xl font-bold"
              style={{ color: 'var(--text-1)' }}
            >
              {profile.full_name ?? firstName ?? 'Chef'}
            </h1>
            {profile.location && (
              <p
                className="mt-0.5 flex items-center gap-1 text-xs"
                style={{ color: 'var(--text-3)' }}
              >
                <MapPin className="h-3 w-3" />
                {profile.location}
              </p>
            )}
            {profile.cuisines && profile.cuisines.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.cuisines.slice(0, 3).map((cuisine) => (
                  <span key={cuisine} className="f4l-badge f4l-badge-muted">
                    {cuisine}
                  </span>
                ))}
              </div>
            )}

            <div
              className="mt-4 grid grid-cols-3 divide-x text-center"
              style={{ borderColor: 'var(--divider)' }}
            >
              {profileStats.map((stat) => (
                <div key={stat.label} style={{ borderColor: 'var(--divider)' }}>
                  <p
                    className="font-heading text-lg font-bold"
                    style={{ color: 'var(--text-1)' }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {missing.length > 0 && (
              <Link href={missing[0].href} className="mt-4 block">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span style={{ color: 'var(--text-2)' }}>
                    Your profile is {percent}% complete
                  </span>
                  <span
                    className="font-bold"
                    style={{ color: 'var(--accent)' }}
                  >
                    Finish
                  </span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full"
                  style={{ background: 'var(--border)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${percent}%`,
                      background: 'var(--accent)',
                    }}
                  />
                </div>
              </Link>
            )}

            <div className="mt-4 flex gap-2">
              <Link
                href="/cook/specials"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white"
                style={{
                  background: 'var(--accent)',
                  boxShadow: 'var(--shadow-warm)',
                }}
              >
                <Plus className="h-4 w-4" />
                Add a dish
              </Link>
              <Link
                href="/stories/new"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold"
                style={{ background: 'var(--bg-2)', color: 'var(--text-1)' }}
              >
                <Film className="h-4 w-4" />
                Post a story
              </Link>
            </div>
          </div>
        </section>

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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
              label="Earnings"
              value={formatNaira(stats.earned)}
              note="Value of completed orders"
            />
          </div>
        </section>

        <DashboardGallery
          specials={data.specials}
          posts={data.posts}
          cookId={profile.id}
        />

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

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SECTION_LINKS.map(({ href, icon: Icon, title, detail }) => (
            <Link key={title} href={href}>
              <div className="f4l-card flex items-center gap-3 p-4">
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

        <section id="reviews">
          <div className="mb-3 flex items-center justify-between">
            <p className="f4l-section-label">Customer reviews</p>
            {data.reviewStats.count > 0 && (
              <span
                className="flex items-center gap-1 text-xs font-bold"
                style={{ color: 'var(--text-1)' }}
              >
                <Star
                  className="h-3.5 w-3.5"
                  fill="currentColor"
                  style={{ color: 'var(--accent-alt)' }}
                />
                {data.reviewStats.average.toFixed(1)}
                <span
                  className="font-normal"
                  style={{ color: 'var(--text-3)' }}
                >
                  ({data.reviewStats.count})
                </span>
              </span>
            )}
          </div>
          {recentReviews.length === 0 ? (
            <div className="f4l-card p-4">
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                No reviews yet. They appear here after customers rate a
                completed order.
              </p>
            </div>
          ) : (
            <div className="f4l-card divide-y divide-[var(--divider)]">
              {recentReviews.map((review) => (
                <div key={review.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: 'var(--text-1)' }}
                    >
                      {review.reviewer?.full_name ?? 'Customer'}
                    </p>
                    <span
                      className="shrink-0 text-xs"
                      style={{ color: 'var(--text-3)' }}
                    >
                      {new Date(review.created_at).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div
                    className="mt-1 flex gap-0.5"
                    aria-label={`${review.rating} out of 5 stars`}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className="h-3.5 w-3.5"
                        fill={n <= review.rating ? 'currentColor' : 'none'}
                        style={{
                          color:
                            n <= review.rating
                              ? 'var(--accent-alt)'
                              : 'var(--border)',
                        }}
                      />
                    ))}
                  </div>
                  {review.comment && (
                    <p
                      className="mt-2 text-sm"
                      style={{ color: 'var(--text-2)' }}
                    >
                      {review.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="f4l-card flex items-center justify-between gap-3 p-4">
          <div>
            <p className="f4l-section-label mb-1">Verification</p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              {kyc === 'verified'
                ? 'You can take bookings.'
                : kyc === 'pending'
                  ? 'Usually 24–48 hours.'
                  : 'Needed to take bookings.'}
            </p>
          </div>
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
        </section>
      </motion.div>
    </div>
  )
}
