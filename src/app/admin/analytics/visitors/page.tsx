'use client'

import {
  Eye,
  FileText,
  Percent,
  Repeat,
  Timer,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import type { Metric } from '@/lib/admin/intelligence/series'
import type { ResolvedRange } from '@/lib/admin/intelligence/dateRange'
import {
  AreaChart,
  BarList,
  CardGridSkeleton,
  ErrorPanel,
  MetricCard,
  Page,
  Panel,
  RangeBar,
  RefreshButton,
  Unavailable,
  useAdminData,
  useRangeState,
} from '@/components/admin/intelligence/kit'

type Visitors =
  | { available: false; reason: string }
  | {
      available: true
      analyticsEnabled: boolean
      range: ResolvedRange
      truncated: boolean
      metrics: Record<string, Metric>
      tables: Record<string, { key: string; count: number }[]>
      audiences: { key: string; label: string; count: number }[]
    }

export default function VisitorsPage() {
  const { value, setValue, params } = useRangeState('30d')
  const { data, error, loading, reload } = useAdminData<Visitors>(
    'intelligence/visitors',
    params,
  )
  const ok = data && data.available ? data : null
  const m = ok?.metrics

  return (
    <Page
      title="Visitors"
      description="Everyone who visits Food4Love, registered or not. Only people who accepted the privacy banner are counted, so these are real but conservative numbers."
      actions={
        <>
          <RangeBar value={value} onChange={setValue} />
          <RefreshButton onClick={reload} loading={loading} />
        </>
      }
    >
      {error && <ErrorPanel message={error} onRetry={reload} />}
      {loading && !data && <CardGridSkeleton count={8} />}
      {data && !data.available && <Unavailable>{data.reason}</Unavailable>}
      {ok && m && (
        <>
          {!ok.analyticsEnabled && (
            <div
              role="status"
              className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm"
            >
              <p className="font-semibold text-amber-600">
                Visitor collection is switched off
              </p>
              <p className="mt-1 text-[var(--admin-muted)]">
                The numbers below are not zero visitors; nothing is being
                recorded. Turn collection on (NEXT_PUBLIC_ANALYTICS_ENABLED)
                after the privacy and cookie policies are published.
              </p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Visits"
              metric={m.visits}
              icon={Eye}
              mode="total"
            />
            <MetricCard
              label="Unique visitors"
              metric={m.uniqueVisitors}
              icon={UsersRound}
            />
            <MetricCard
              label="First-time visitors"
              metric={m.firstTime}
              icon={UserPlus}
            />
            <MetricCard
              label="Returning visitors"
              metric={m.returning}
              icon={Repeat}
            />
            <MetricCard
              label="Visitors today"
              metric={m.visitorsToday}
              icon={UsersRound}
            />
            <MetricCard
              label="Visitors, last 7 days"
              metric={m.visitorsWeek}
              icon={UsersRound}
            />
            <MetricCard
              label="Visitors, last 30 days"
              metric={m.visitorsMonth}
              icon={UsersRound}
            />
            <MetricCard
              label="Page views"
              metric={m.pageViews}
              icon={FileText}
            />
            <MetricCard
              label="Average session"
              metric={m.avgSession}
              icon={Timer}
              seconds
            />
            <MetricCard
              label="Single-page sessions"
              metric={m.singlePageRate}
              icon={Percent}
              suffix="%"
            />
            <MetricCard
              label="Waitlist conversion"
              metric={m.waitlistConversion}
              icon={Percent}
              suffix="%"
            />
            <MetricCard
              label="Registration conversion"
              metric={m.registrationConversion}
              icon={Percent}
              suffix="%"
            />
          </div>

          <Panel title="Visits over time" hint={ok.range.label}>
            {m.visits.status === 'ok' && (
              <AreaChart points={m.visits.series} label="Visits" />
            )}
          </Panel>

          <Panel
            title="Who they are"
            hint="Four different groups, never mixed. A visit never turns someone into a registered user."
          >
            <BarList
              items={ok.audiences.map((a) => ({
                key: a.key,
                label: a.label,
                value: a.count,
              }))}
            />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Where visits begin" hint="Landing pages">
              <BarList
                items={ok.tables.landing.map((r) => ({
                  key: r.key,
                  label: r.key,
                  value: r.count,
                }))}
              />
            </Panel>
            <Panel
              title="Most viewed pages"
              hint="Page views, by page address (no query strings)"
            >
              <BarList
                items={ok.tables.pages.map((r) => ({
                  key: r.key,
                  label: r.key,
                  value: r.count,
                }))}
              />
            </Panel>
          </div>
          {ok.truncated && (
            <p className="text-xs text-[var(--admin-muted)]">
              This period is very large, so figures use the most recent 20,000
              records.
            </p>
          )}
        </>
      )}
    </Page>
  )
}
