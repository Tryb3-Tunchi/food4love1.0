'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion'
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
  const reduceMotion = useReducedMotion()

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
      tone: '#E59A2E',
      value: data.newRequests + stats.newOrders,
      format: undefined,
      label: 'New requests',
      needsYou: data.newRequests + stats.newOrders > 0,
    },
    {
      href: '/bookings',
      icon: Clock,
      tone: '#E8562A',
      value: stats.inProgress,
      format: undefined,
      label: 'In progress',
      needsYou: stats.inProgress > 0,
    },
    {
      href: '/cook/payments',
      icon: Wallet,
      tone: '#2F9E6B',
      value: stats.earned,
      format: formatNaira,
      label: 'This month',
      needsYou: false,
    },
  ]

  const chips = [
    stats.newOrders > 0 && {
      icon: CalendarClock,
      label: `${stats.newOrders} booking${stats.newOrders === 1 ? '' : 's'} waiting`,
      href: '/requests',
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
            initial={{ opacity: 0, y: 14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 320,
              damping: 20,
              delay: i * 0.08,
            }}
          >
            <Link
              href={figure.href}
              className="relative block overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 shadow-sm backdrop-blur-xl transition-transform active:scale-95"
              style={{
                backgroundImage: `linear-gradient(160deg, ${figure.tone}1c, transparent 70%)`,
              }}
            >
              {!reduceMotion && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                  animate={{ x: ['0%', '420%'] }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    repeatDelay: 4 + i * 1.5,
                    ease: 'easeInOut',
                  }}
                />
              )}
              {figure.needsYou && (
                <span className="absolute right-2 top-2 flex h-2 w-2">
                  <span
                    className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden"
                    style={{ background: figure.tone }}
                  />
                  <span
                    className="relative h-2 w-2 rounded-full"
                    style={{ background: figure.tone }}
                  />
                </span>
              )}
              <div className="relative flex items-center gap-1.5">
                <motion.span
                  className="flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: `${figure.tone}26` }}
                  animate={reduceMotion ? {} : { scale: [1, 1.14, 1] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    repeatDelay: 2.5 + i,
                  }}
                >
                  <figure.icon
                    className="h-3 w-3"
                    style={{ color: figure.tone }}
                  />
                </motion.span>
                <span
                  className="truncate text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--text-3)' }}
                >
                  {figure.label}
                </span>
              </div>
              <p
                className="relative mt-1 font-heading text-xl font-bold leading-none"
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
          {chips.map(({ icon: Icon, label, href }, i) => (
            <motion.div
              key={label}
              className="shrink-0"
              initial={{ opacity: 0, scale: 0.7, x: -12 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{
                type: 'spring',
                stiffness: 420,
                damping: 18,
                delay: 0.3 + i * 0.1,
              }}
            >
              <Link
                href={href}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              >
                <motion.span
                  className="flex"
                  animate={reduceMotion ? {} : { rotate: [0, -14, 14, -8, 0] }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    repeatDelay: 3 + i,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </motion.span>
                {label}
                <ChevronRight className="h-3 w-3 opacity-60" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
