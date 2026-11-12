'use client'

import Link from 'next/link'
import {
  CalendarDays,
  ChefHat,
  Eye,
  Heart,
  ListChecks,
  MessageCircle,
  MessagesSquare,
  Radio,
  Sparkles,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react'
import type { Metric } from '@/lib/admin/intelligence/series'
import type { ResolvedRange } from '@/lib/admin/intelligence/dateRange'
import {
  AreaChart,
  CardGridSkeleton,
  ErrorPanel,
  MetricCard,
  Page,
  Panel,
  RangeBar,
  RefreshButton,
  fmtAgo,
  useAdminData,
  useRangeState,
} from '@/components/admin/intelligence/kit'

interface Overview {
  range: ResolvedRange
  metrics: Record<string, Metric>
  generatedAt: string
}

export default function ExecutiveDashboard() {
  const { value, setValue, params } = useRangeState('30d')
  const { data, error, loading, reload } = useAdminData<Overview>(
    'intelligence/overview',
    params,
  )
  const m = data?.metrics
  const visitsOff = m?.visits?.status === 'unavailable'

  return (
    <Page
      title="Executive dashboard"
      description="How many people visit, join and use Food4Love, and how that is changing. Every figure comes from the database; anything not being collected says so."
      actions={
        <>
          <RangeBar value={value} onChange={setValue} />
          <RefreshButton onClick={reload} loading={loading} />
        </>
      }
    >
      {error === 'Forbidden' ? (
        <Panel title="Your staff access does not include analytics">
          <p className="text-sm text-[var(--admin-muted)]">
            You can still use the sections your role allows from the menu. The{' '}
            <Link
              href="/admin/operations"
              className="font-semibold underline underline-offset-2"
            >
              Needs attention
            </Link>{' '}
            page shows the counts your access covers. A Super Admin can add
            analytics access in Staff access.
          </p>
        </Panel>
      ) : (
        error && <ErrorPanel message={error} onRetry={reload} />
      )}
      {loading && !data && <CardGridSkeleton count={12} />}

      {m && (
        <>
          {visitsOff && (
            <div
              role="status"
              className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm"
            >
              <p className="font-semibold text-amber-600">
                Visitor tracking is not switched on yet
              </p>
              <p className="mt-1 text-[var(--admin-muted)]">
                Account, waitlist, match and message figures below are real and
                complete. Visits, unique visitors and online-now need the
                analytics database migration to be applied, then they fill in
                from that day onward. Earlier visits cannot be recovered because
                they were never recorded.
              </p>
            </div>
          )}

          <Section
            title="Audience"
            hint="Who is on Food4Love, from visitors to members"
          >
            <MetricCard
              label="Registered members"
              metric={m.registered}
              icon={Users}
              href="/admin/users"
              mode="total"
            />
            <MetricCard
              label="Waitlist members"
              metric={m.waitlist}
              icon={ListChecks}
              href="/admin/waitlist"
              mode="total"
            />
            <MetricCard
              label="Website visits"
              metric={m.visits}
              icon={Eye}
              href="/admin/analytics/visitors"
              mode="total"
            />
            <MetricCard
              label="Unique visitors"
              metric={m.uniqueVisitors}
              icon={UsersRound}
              href="/admin/analytics/visitors"
              mode="total"
            />
            <MetricCard
              label="Online now"
              metric={m.activeNow}
              icon={Radio}
              href="/admin/live"
            />
          </Section>

          <Section
            title="New registrations"
            hint="Compared with the previous equivalent period"
          >
            <MetricCard
              label="Joined today"
              metric={m.newToday}
              icon={UserPlus}
              href="/admin/users"
            />
            <MetricCard
              label="Joined in the last 7 days"
              metric={m.newWeek}
              icon={CalendarDays}
              href="/admin/users"
            />
            <MetricCard
              label="Joined in the last 30 days"
              metric={m.newMonth}
              icon={CalendarDays}
              href="/admin/users"
            />
          </Section>

          <Section title="Community" hint="Chefs, matches and conversations">
            <MetricCard
              label="Cooks registered"
              metric={m.cooks}
              icon={ChefHat}
              href="/admin/cooks"
              mode="total"
            />
            <MetricCard
              label="Professional chefs"
              metric={m.chefs}
              icon={Sparkles}
              href="/admin/cooks"
            />
            <MetricCard
              label="Matches created"
              metric={m.matches}
              icon={Heart}
              href="/admin/conversations"
              mode="total"
            />
            <MetricCard
              label="Conversations"
              metric={m.conversations}
              icon={MessageCircle}
              href="/admin/conversations"
              mode="total"
            />
            <MetricCard
              label="Messages exchanged"
              metric={m.messages}
              icon={MessagesSquare}
              href="/admin/conversations"
              mode="total"
            />
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Registrations over time" hint={data.range.label}>
              {m.registered?.status === 'ok' && (
                <AreaChart
                  points={m.registered.series}
                  label="New registrations"
                />
              )}
            </Panel>
            <Panel title="Waitlist sign-ups over time" hint={data.range.label}>
              {m.waitlist?.status === 'ok' && (
                <AreaChart
                  points={m.waitlist.series}
                  label="New waitlist members"
                />
              )}
            </Panel>
          </div>

          <p className="text-xs text-[var(--admin-muted)]">
            Updated {fmtAgo(data.generatedAt)}. Figures are cached for 30
            seconds. Need the older counts for disputes, verifications and
            suspensions? They are on the{' '}
            <Link
              href="/admin/operations"
              className="font-semibold underline underline-offset-2"
            >
              Operations overview
            </Link>
            .
          </p>
        </>
      )}
    </Page>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section aria-label={title}>
      <div className="mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--admin-muted)]">
          {title}
        </h2>
        <p className="text-xs text-[var(--admin-muted)]">{hint}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  )
}
