'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  BadgeCheck,
  CalendarCheck,
  ChefHat,
  ClipboardCheck,
  Flag,
  Sparkles,
  UserX,
  Utensils,
} from 'lucide-react'
import type { Metric } from '@/lib/admin/intelligence/series'
import {
  BarList,
  CardGridSkeleton,
  ErrorPanel,
  MetricCard,
  Page,
  Panel,
  RangeBar,
  RefreshButton,
  useAdminData,
  useRangeState,
} from '@/components/admin/intelligence/kit'

interface Cooks {
  metrics: Record<string, Metric>
  bookingStatuses: { key: string; count: number }[]
  locations: { key: string; count: number }[]
  actions: { label: string; href: string }[]
}

export default function CooksPage() {
  const { value, setValue, params } = useRangeState('30d')
  const { data, error, loading, reload } = useAdminData<Cooks>(
    'intelligence/cooks',
    params,
  )
  const m = data?.metrics

  return (
    <Page
      title="Cooks & chefs"
      description="How the chef side of Food4Love is growing and what needs attention. Account actions (suspend, verify) stay on their own audited pages, linked below."
      actions={
        <>
          <RangeBar value={value} onChange={setValue} />
          <RefreshButton onClick={reload} loading={loading} />
        </>
      }
    >
      {error && <ErrorPanel message={error} onRetry={reload} />}
      {loading && !data && <CardGridSkeleton count={9} />}
      {m && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Cooks registered"
              metric={m.totalCooks}
              icon={ChefHat}
              href="/admin/users?role=cook"
              mode="total"
            />
            <MetricCard
              label="Professional chefs"
              metric={m.professionalChefs}
              icon={Sparkles}
            />
            <MetricCard
              label="Active cooks"
              metric={m.activeCooks}
              icon={Utensils}
            />
            <MetricCard
              label="Verified cooks"
              metric={m.verifiedCooks}
              icon={BadgeCheck}
              href="/admin/users?role=cook"
            />
            <MetricCard
              label="Waiting for verification"
              metric={m.pendingVerification}
              icon={ClipboardCheck}
              href="/admin/kyc"
            />
            <MetricCard
              label="Booking requests"
              metric={m.bookingRequests}
              icon={CalendarCheck}
              href="/admin/bookings"
              mode="total"
            />
            <MetricCard
              label="Cooks with reports"
              metric={m.reportedCooks}
              icon={Flag}
              href="/admin/reports"
            />
            <MetricCard
              label="Suspended cooks"
              metric={m.suspendedCooks}
              icon={UserX}
              href="/admin/users?status=suspended"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Bookings by status"
              hint="Bookings created in this period. Completed and cancelled show here once they occur."
            >
              <BarList
                items={data.bookingStatuses.map((b) => ({
                  key: b.key,
                  label: b.key,
                  value: b.count,
                }))}
                empty="No bookings in this period."
              />
            </Panel>
            <Panel
              title="Where cooks say they are"
              hint="What cooks wrote on their own profile. Shown only when 3 or more share it, so no one can be singled out."
            >
              <BarList
                items={data.locations.map((l) => ({
                  key: l.key,
                  label: l.key,
                  value: l.count,
                }))}
                empty="Not enough cooks share a location yet."
              />
            </Panel>
          </div>

          <Panel
            title="Take action"
            hint="These open the existing pages, where every action needs confirmation and is audit-logged."
          >
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.actions.map((a) => (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    className="flex min-h-11 items-center justify-between rounded-lg border border-[var(--admin-border)] px-3 text-sm font-semibold hover:bg-[var(--admin-hover)]"
                  >
                    {a.label}
                    <AlertTriangle
                      aria-hidden="true"
                      className="h-4 w-4 text-[var(--admin-muted)]"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </Page>
  )
}
