'use client'
import { useEffect, useState } from 'react'
import { getAdminStats } from '@/services/admin'
import {
  Users,
  ChefHat,
  Heart,
  ShoppingBag,
  AlertTriangle,
  Shield,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'
import { AdminThemeToggle } from '@/components/admin/AdminThemeProvider'

interface Stats {
  totalUsers: number
  totalChefs: number
  totalMatches: number
  totalBookings: number
  openDisputes: number
  pendingKyc: number
  suspendedUsers?: number
  dataCheckFailures?: string[]
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not load operations overview',
        )
      })
  }, [])

  const statCards = stats
    ? [
        {
          label: 'Total Users',
          value: stats.totalUsers,
          icon: Users,
          href: '/admin/users',
          color: '#3B82F6',
          bg: 'rgba(59,130,246,0.1)',
        },
        {
          label: 'Home Chefs',
          value: stats.totalChefs,
          icon: ChefHat,
          href: '/admin/users',
          color: '#F59E0B',
          bg: 'rgba(245,158,11,0.1)',
        },
        {
          label: 'Total Matches',
          value: stats.totalMatches,
          icon: Heart,
          href: '/admin/matches',
          color: '#E8390E',
          bg: 'rgba(232,57,14,0.1)',
        },
        {
          label: 'Bookings',
          value: stats.totalBookings,
          icon: ShoppingBag,
          href: '/admin/bookings',
          color: '#22C55E',
          bg: 'rgba(34,197,94,0.1)',
        },
        {
          label: 'Open Disputes',
          value: stats.openDisputes,
          icon: AlertTriangle,
          href: '/admin/disputes',
          color: '#EF4444',
          bg: 'rgba(239,68,68,0.1)',
          urgent: stats.openDisputes > 0,
        },
        {
          label: 'Pending KYC',
          value: stats.pendingKyc,
          icon: Shield,
          href: '/admin/kyc',
          color: '#F59E0B',
          bg: 'rgba(245,158,11,0.1)',
          urgent: stats.pendingKyc > 0,
        },
        {
          label: 'Suspended Users',
          value: stats.suspendedUsers ?? 0,
          icon: Users,
          href: '/admin/users',
          color: '#EF4444',
          bg: 'rgba(239,68,68,0.1)',
        },
      ]
    : []

  return (
    <div className="min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text)]">
      <div className="mx-auto max-w-5xl px-5 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Admin
            </h1>
            <p
              className="mt-1 text-sm"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Food4Love Operations Centre
            </p>
          </div>
          <div className="flex gap-2">
            <AdminThemeToggle />
            <Button
              variant="surface"
              size="sm"
              onClick={() =>
                getAdminStats()
                  .then(setStats)
                  .catch((error) =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : 'Could not refresh overview',
                    ),
                  )
              }
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        {!!stats?.dataCheckFailures?.length && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            Some operational counts could not be loaded:{' '}
            {stats.dataCheckFailures.join(', ')}
          </div>
        )}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {statCards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Link
                href={c.href}
                className="block rounded-2xl border p-4 transition-all hover:scale-[1.01]"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderColor: c.urgent
                    ? `${c.color}40`
                    : 'rgba(255,255,255,0.06)',
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: c.bg }}
                  >
                    <c.icon className="h-5 w-5" style={{ color: c.color }} />
                  </div>
                  {c.urgent && (
                    <span
                      className="h-2 w-2 animate-pulse rounded-full"
                      style={{ background: c.color }}
                    />
                  )}
                </div>
                <div className="mb-1 text-3xl font-extrabold text-white">
                  {stats ? (
                    c.value.toLocaleString()
                  ) : (
                    <span className="opacity-20">—</span>
                  )}
                </div>
                <div
                  className="text-xs"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  {c.label}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            {
              title: 'Swipe Activity',
              desc: 'View and manage user swipes',
              href: '/admin/swipes',
              icon: Heart,
              color: 'text-pink-500',
              urgent: false,
            },
            {
              href: '/admin/kyc',
              title: 'KYC Review Queue',
              desc: 'Review chef video verifications',
              icon: '🎥',
              urgent: (stats?.pendingKyc ?? 0) > 0,
            },
            {
              href: '/admin/disputes',
              title: 'Dispute Resolution',
              desc: 'AI-analyzed buyer-chef conflicts',
              icon: '⚖️',
              urgent: (stats?.openDisputes ?? 0) > 0,
            },
            {
              href: '/admin/users',
              title: 'User Management',
              desc: 'Search, view, suspend users',
              icon: '👥',
              urgent: false,
            },
            {
              href: '/admin/bookings',
              title: 'Booking Oversight',
              desc: 'Monitor all active bookings',
              icon: '📋',
              urgent: false,
            },
            {
              href: '/admin/audit',
              title: 'Admin Audit Log',
              desc: 'Review sensitive access and staff actions',
              icon: '🧾',
              urgent: false,
            },
            {
              href: '/admin/listings',
              title: 'Meal Listing Moderation',
              desc: 'Remove or restore unsafe meal listings',
              icon: '🛡️',
              urgent: false,
            },
            {
              href: '/admin/messages',
              title: 'Support Conversations',
              desc: 'Message buyers and cooks as Food4Love Support',
              icon: '💬',
              urgent: false,
            },
            {
              href: '/admin/reports',
              title: 'Reports Queue',
              desc: 'Review reports from buyers and cooks',
              icon: '🚩',
              urgent: false,
            },
            {
              href: '/admin/access',
              title: 'Staff Access',
              desc: 'Assign admin roles and scoped permissions',
              icon: '🔐',
              urgent: false,
            },
          ].map((l: any) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-4 rounded-2xl border p-4 transition-all hover:bg-white/5"
              style={{
                borderColor: l.urgent
                  ? 'rgba(232,57,14,0.25)'
                  : 'rgba(255,255,255,0.06)',
                background: l.urgent
                  ? 'rgba(232,57,14,0.05)'
                  : 'rgba(255,255,255,0.02)',
              }}
            >
              <span className="shrink-0 text-2xl">
                {typeof l.icon === 'string' ? (
                  l.icon
                ) : (
                  <l.icon className={`h-6 w-6 ${l.color || ''}`} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {l.title}
                  </span>
                  {l.urgent && (
                    <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-pepper" />
                  )}
                </div>
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  {l.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
