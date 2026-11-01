'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import {
  CalendarClock,
  ChevronRight,
  Clock,
  Inbox,
  ShieldAlert,
  UserCircle,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { getCookDashboard } from '@/services/cookDashboard'
import { getProfileChecklist, summarizeOrders } from '@/lib/dashboard'
import { formatNaira } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

function CountUp({
  value,
  format = (n) => String(n),
}: {
  value: number
  format?: (n: number) => string
}) {
  const motionValue = useMotionValue(0)
  const text = useTransform(motionValue, (v) => format(Math.round(v)))

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.9,
      ease: 'easeOut',
    })
    return controls.stop
  }, [value, motionValue])

  return <motion.span>{text}</motion.span>
}

// A slim summary at the top of Discover for chefs: what is waiting, what is
// cooking and what came in this month, plus the few things that need action.
export function CookTodayStrip() {
  const profile = useAuthStore((s) => s.profile)

  const { data, isLoading } = useQuery({
    queryKey: ['cook-dashboard', profile?.id],
    queryFn: () => getCookDashboard(profile!.id),
    enabled: !!profile?.id,
  })

  if (isLoading || !data || !profile) {
    return (
      <div className="relative z-10 px-4 pb-1">
        <Skeleton className="h-[76px] w-full rounded-2xl" />
      </div>
    )
  }

  const stats = summarizeOrders(data.bookings, 'month')
  const missing = getProfileChecklist(profile).filter((item) => !item.done)
  const kyc = profile.kyc_status ?? 'unverified'

  const figures = [
    {
      href: '/requests',
      icon: Inbox,
      value: data.newRequests,
      format: undefined,
      label: 'New requests',
    },
    {
      href: '/bookings',
      icon: Clock,
      value: stats.inProgress,
      format: undefined,
      label: 'In progress',
    },
    {
      href: '/cook/payments',
      icon: Wallet,
      value: stats.earned,
      format: formatNaira,
      label: 'This month',
    },
  ]

  const chips = [
    stats.newOrders > 0 && {
      icon: CalendarClock,
      label: `${stats.newOrders} booking${stats.newOrders === 1 ? '' : 's'} waiting`,
      href: '/bookings',
    },
    (kyc === 'unverified' || kyc === 'rejected') && {
      icon: ShieldAlert,
      label:
        kyc === 'rejected' ? 'Verification needs a look' : 'Verify your ID',
      href: '/cook/verification',
    },
    missing.length > 0 && {
      icon: UserCircle,
      label: 'Finish your profile',
      href: missing[0].href,
    },
    data.specials.length === 0 && {
      icon: UtensilsCrossed,
      label: 'Post a dish',
      href: '/cook/specials',
    },
  ].filter(Boolean) as {
    icon: typeof CalendarClock
    label: string
    href: string
  }[]

  return (
    <div className="relative z-10 px-4 pb-1">
      <div className="grid grid-cols-3 gap-2">
        {figures.map((figure, i) => (
          <motion.div
            key={figure.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <Link
              href={figure.href}
              className="block rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 shadow-sm backdrop-blur-xl transition-transform active:scale-95"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: 'var(--accent-soft)' }}
                >
                  <figure.icon
                    className="h-3 w-3"
                    style={{ color: 'var(--accent)' }}
                  />
                </span>
                <span
                  className="truncate text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--text-3)' }}
                >
                  {figure.label}
                </span>
              </div>
              <p
                className="mt-1 font-heading text-xl font-bold leading-none"
                style={{ color: 'var(--text-1)' }}
              >
                <CountUp value={figure.value} format={figure.format} />
              </p>
            </Link>
          </motion.div>
        ))}
      </div>

      {chips.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {chips.map(({ icon: Icon, label, href }) => (
            <Link
              key={label}
              href={href}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              <ChevronRight className="h-3 w-3 opacity-60" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
