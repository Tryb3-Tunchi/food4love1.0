'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarClock,
  ChevronRight,
  ShieldAlert,
  UserCircle,
  UtensilsCrossed,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { getCookDashboard } from '@/services/cookDashboard'
import { getProfileChecklist, summarizeOrders } from '@/lib/dashboard'
import { formatNaira } from '@/lib/utils'
import { Skeleton } from '@/components/ui/Skeleton'

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
        <Skeleton className="h-[70px] w-full rounded-2xl" />
      </div>
    )
  }

  const stats = summarizeOrders(data.bookings, 'month')
  const missing = getProfileChecklist(profile).filter((item) => !item.done)
  const kyc = profile.kyc_status ?? 'unverified'

  const figures = [
    {
      href: '/requests',
      value: data.newRequests,
      label: 'New requests',
    },
    {
      href: '/bookings',
      value: stats.inProgress,
      label: 'In progress',
    },
    {
      href: '/cook/payments',
      value: formatNaira(stats.earned),
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
      <div
        className="f4l-card grid grid-cols-3 divide-x"
        style={{ borderColor: 'var(--divider)' }}
      >
        {figures.map((figure) => (
          <Link
            key={figure.label}
            href={figure.href}
            className="px-2 py-2.5 text-center transition-colors active:bg-[var(--accent-soft)]"
            style={{ borderColor: 'var(--divider)' }}
          >
            <p
              className="font-heading text-lg font-bold leading-tight"
              style={{ color: 'var(--text-1)' }}
            >
              {figure.value}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              {figure.label}
            </p>
          </Link>
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
