'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  BookOpenCheck,
  ClipboardList,
  FileClock,
  Flag,
  Handshake,
  LayoutDashboard,
  MessageCircle,
  ShieldCheck,
  UserRoundCog,
  Users,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

type AdminPermission =
  | 'users:manage'
  | 'matches:manage'
  | 'bookings:manage'
  | 'disputes:manage'
  | 'kyc:review'
  | 'listings:manage'
  | 'reports:manage'
  | 'messages:manage'
  | 'audit:view'
  | 'admin:manage'

type AdminNavigationItem = {
  href: string
  label: string
  icon: LucideIcon
  permission?: AdminPermission
}

const groups: { label: string; items: AdminNavigationItem[] }[] = [
  {
    label: 'Overview',
    items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Operations',
    items: [
      {
        href: '/admin/bookings',
        label: 'Bookings',
        icon: BookOpenCheck,
        permission: 'bookings:manage',
      },
      {
        href: '/admin/matches',
        label: 'Matches',
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
        href: '/admin/disputes',
        label: 'Disputes',
        icon: ClipboardList,
        permission: 'disputes:manage',
      },
    ],
  },
  {
    label: 'People & trust',
    items: [
      {
        href: '/admin/users',
        label: 'Users and cooks',
        icon: Users,
        permission: 'users:manage',
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
        href: '/admin/reports',
        label: 'Reports',
        icon: Flag,
        permission: 'reports:manage',
      },
      {
        href: '/admin/messages',
        label: 'Support messages',
        icon: MessageCircle,
        permission: 'messages:manage',
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        href: '/admin/audit',
        label: 'Audit log',
        icon: FileClock,
        permission: 'audit:view',
      },
      {
        href: '/admin/access',
        label: 'Staff access',
        icon: UserRoundCog,
        permission: 'admin:manage',
      },
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
        (item) => !item.permission || permissions.includes(item.permission),
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
