'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ChefHat,
  Heart,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { getAdminStats } from '@/services/admin'

interface Stats {
  totalUsers: number | null
  totalChefs: number | null
  totalMatches: number | null
  totalBookings: number | null
  openDisputes: number | null
  pendingKyc: number | null
  suspendedUsers: number | null
  dataCheckFailures: string[]
  restrictedMetrics: string[]
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setStats(await getAdminStats())
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not load the operations overview',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const metrics: {
    key: string
    label: string
    value: number | null
    href: string
    icon: LucideIcon
  }[] = stats
    ? [
        {
          key: 'totalUsers',
          label: 'Members',
          value: stats.totalUsers,
          href: '/admin/users',
          icon: Users,
        },
        {
          key: 'totalChefs',
          label: 'Home cooks',
          value: stats.totalChefs,
          href: '/admin/users?role=cook',
          icon: ChefHat,
        },
        {
          key: 'totalMatches',
          label: 'Active matches',
          value: stats.totalMatches,
          href: '/admin/matches',
          icon: Heart,
        },
        {
          key: 'totalBookings',
          label: 'Bookings',
          value: stats.totalBookings,
          href: '/admin/bookings',
          icon: ShoppingBag,
        },
        {
          key: 'openDisputes',
          label: 'Open disputes',
          value: stats.openDisputes,
          href: '/admin/disputes',
          icon: AlertTriangle,
        },
        {
          key: 'pendingKyc',
          label: 'Chef verifications',
          value: stats.pendingKyc,
          href: '/admin/kyc',
          icon: ShieldCheck,
        },
        {
          key: 'suspendedUsers',
          label: 'Suspended accounts',
          value: stats.suspendedUsers,
          href: '/admin/users?status=suspended',
          icon: Users,
        },
      ].filter((metric) => !stats.restrictedMetrics.includes(metric.key))
    : []

  const failedMetrics = new Set(stats?.dataCheckFailures ?? [])

  return (
    <section className="mx-auto min-h-[calc(100dvh-4rem)] max-w-7xl px-4 py-7 text-[var(--admin-text)] sm:px-6 sm:py-9 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--admin-accent)]">
            Food4Love operations
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--admin-muted)]">
            A live view of the marketplace areas your staff access allows you to
            manage.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm font-semibold text-[var(--admin-text)] transition hover:bg-[var(--admin-hover)] disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw
            aria-hidden="true"
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-200"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="font-semibold underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {!!stats?.dataCheckFailures.length && (
        <div
          role="status"
          className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100"
        >
          Some counts could not be loaded. A dash marks unavailable data; it is
          not a zero count.
        </div>
      )}

      {loading && !stats ? (
        <div
          aria-label="Loading operations overview"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)]"
            />
          ))}
        </div>
      ) : error && !stats ? (
        <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
          <p className="font-semibold text-[var(--admin-text)]">
            The dashboard could not load its counts.
          </p>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">
            Retry the request or use the sections in the admin navigation.
          </p>
        </div>
      ) : metrics.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => {
            const Icon = metric.icon
            const hasError = failedMetrics.has(metric.key)
            return (
              <Link
                key={metric.key}
                href={metric.href}
                className="hover:border-[var(--admin-accent)]/50 group rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--admin-muted)]">
                      {metric.label}
                    </p>
                    <p className="mt-3 font-display text-3xl font-bold tabular-nums text-[var(--admin-text)]">
                      {metric.value === null || hasError
                        ? '—'
                        : metric.value.toLocaleString()}
                    </p>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-5 text-xs font-semibold text-[var(--admin-accent)] opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  Open {metric.label.toLowerCase()} →
                </p>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
          <p className="font-semibold text-[var(--admin-text)]">
            No overview counts are available for your current access.
          </p>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">
            Ask an administrator to grant the specific operational permissions
            you need.
          </p>
        </div>
      )}
    </section>
  )
}
