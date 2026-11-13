'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  ChefHat,
  ClipboardList,
  Filter,
  Globe2,
  FileClock,
  Flag,
  Handshake,
  HeartPulse,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  MessagesSquare,
  Radio,
  Settings,
  ShieldCheck,
  Gauge,
  Megaphone,
  Mail,
  TrendingUp,
  UserRoundCog,
  Users,
  Utensils,
  type LucideIcon,
} from 'lucide-react'
import {
  holdsPermission,
  type AdminPermission,
} from '@/lib/admin/intelligence/permissions'

type AdminNavigationItem = {
  href: string
  label: string
  icon: LucideIcon
  permission?: AdminPermission
}

const groups: { label: string; items: AdminNavigationItem[] }[] = [
  {
    label: 'Overview',
    items: [
      {
        href: '/admin',
        label: 'Executive dashboard',
        icon: LayoutDashboard,
        permission: 'analytics:view',
      },
      {
        href: '/admin/live',
        label: 'Live activity',
        icon: Radio,
        permission: 'analytics:view',
      },
      { href: '/admin/operations', label: 'Needs attention', icon: Gauge },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        href: '/admin/users',
        label: 'Users',
        icon: Users,
        permission: 'users:manage',
      },
      {
        href: '/admin/waitlist',
        label: 'Waitlist',
        icon: ListChecks,
        permission: 'waitlist:manage',
      },
      {
        href: '/admin/cooks',
        label: 'Cooks & chefs',
        icon: ChefHat,
        permission: 'analytics:view',
      },
      {
        href: '/admin/conversations',
        label: 'Matches & conversations',
        icon: MessagesSquare,
        permission: 'analytics:view',
      },
      {
        href: '/admin/matches',
        label: 'Match tools',
        icon: Handshake,
        permission: 'matches:manage',
      },
      {
        href: '/admin/swipes',
        label: 'Swipe activity',
        icon: Activity,
        permission: 'matches:manage',
      },
      {
        href: '/admin/bookings',
        label: 'Bookings',
        icon: BookOpenCheck,
        permission: 'bookings:manage',
      },
      {
        href: '/admin/disputes',
        label: 'Disputes',
        icon: ClipboardList,
        permission: 'disputes:manage',
      },
      {
        href: '/admin/reports',
        label: 'Reports & moderation',
        icon: Flag,
        permission: 'reports:manage',
      },
      {
        href: '/admin/kyc',
        label: 'Chef verification',
        icon: ShieldCheck,
        permission: 'kyc:review',
      },
      {
        href: '/admin/listings',
        label: 'Meal listings',
        icon: Utensils,
        permission: 'listings:manage',
      },
      {
        href: '/admin/messages',
        label: 'Support messages',
        icon: MessageCircle,
        permission: 'messages:manage',
      },
      {
        href: '/admin/messages/campaigns',
        label: 'Announcements',
        icon: Megaphone,
        permission: 'messages:manage',
      },
    ],
  },
  {
    label: 'Analytics',
    items: [
      {
        href: '/admin/analytics/visitors',
        label: 'Visitors',
        icon: BarChart3,
        permission: 'analytics:view',
      },
      {
        href: '/admin/analytics/geography',
        label: 'Geography',
        icon: Globe2,
        permission: 'analytics:view',
      },
      {
        href: '/admin/analytics/acquisition',
        label: 'Acquisition',
        icon: Filter,
        permission: 'analytics:view',
      },
      {
        href: '/admin/analytics/engagement',
        label: 'Engagement',
        icon: TrendingUp,
        permission: 'analytics:view',
      },
      {
        href: '/admin/analytics/retention',
        label: 'Retention',
        icon: HeartPulse,
        permission: 'analytics:view',
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        href: '/admin/email',
        label: 'Email operations',
        icon: Mail,
        permission: 'email:manage',
      },
      {
        href: '/admin/health',
        label: 'System health',
        icon: Activity,
        permission: 'system:view',
      },
      {
        href: '/admin/audit',
        label: 'Audit logs',
        icon: FileClock,
        permission: 'audit:view',
      },
      {
        href: '/admin/access',
        label: 'Admin roles',
        icon: UserRoundCog,
        permission: 'admin:manage',
      },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export function AdminNavigation({
  permissions,
  mobile = false,
}: {
  permissions: string[]
  mobile?: boolean
}) {
  const pathname = usePathname()
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.permission || holdsPermission(permissions, item.permission),
      ),
    }))
    .filter((group) => group.items.length > 0)

  if (mobile) {
    return (
      <nav
        aria-label="Admin sections"
        className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:thin] lg:hidden"
      >
        {visibleGroups.flatMap((group) =>
          group.items.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition ${active ? 'bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]' : 'text-[var(--admin-muted)] hover:bg-[var(--admin-hover)] hover:text-[var(--admin-text)]'}`}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {item.label}
              </Link>
            )
          }),
        )}
      </nav>
    )
  }

  return (
    <nav aria-label="Admin sections" className="space-y-6 px-3 py-5">
      {visibleGroups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h2 className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--admin-muted)]">
            {group.label}
          </h2>
          <ul className="mt-2 space-y-1">
            {group.items.map((item) => {
              const active = pathname === item.href
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${active ? 'bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]' : 'text-[var(--admin-muted)] hover:bg-[var(--admin-hover)] hover:text-[var(--admin-text)]'}`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}
