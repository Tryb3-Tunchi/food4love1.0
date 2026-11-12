'use client'

import {
  Activity,
  CalendarCheck,
  Eye,
  Heart,
  MessageCircle,
  MessagesSquare,
  Percent,
  ThumbsUp,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import type { FunnelRow, Metric } from '@/lib/admin/intelligence/series'
import {
  AreaChart,
  CardGridSkeleton,
  ErrorPanel,
  FunnelChart,
  MetricCard,
  Page,
  Panel,
  RangeBar,
  RefreshButton,
  useAdminData,
  useRangeState,
} from '@/components/admin/intelligence/kit'

interface Engagement {
  metrics: Record<string, Metric>
  funnel: FunnelRow[]
  truncated: boolean
}

export default function EngagementPage() {
  const { value, setValue, params } = useRangeState('30d')
  const { data, error, loading, reload } = useAdminData<Engagement>(
    'intelligence/engagement',
    params,
  )
  const m = data?.metrics

  return (
    <Page
      title="Engagement"
      description="What members actually do: swipes, likes, matches, messages and bookings, and where newcomers stop progressing. Counted from real records; screens that record nothing yet say so."
      actions={
        <>
          <RangeBar value={value} onChange={setValue} />
          <RefreshButton onClick={reload} loading={loading} />
        </>
      }
    >
      {error && <ErrorPanel message={error} onRetry={reload} />}
      {loading && !data && <CardGridSkeleton count={12} />}
      {m && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Active today" metric={m.dau} icon={Users} />
            <MetricCard
              label="Active, last 7 days"
              metric={m.wau}
              icon={Users}
            />
            <MetricCard
              label="Active, last 30 days"
              metric={m.mau}
              icon={Users}
            />
            <MetricCard
              label="Active members in period"
              metric={m.activeMembers}
              icon={Activity}
            />
            <MetricCard
              label="Swipes"
              metric={m.swipes}
              icon={Eye}
              mode="total"
            />
            <MetricCard
              label="Likes"
              metric={m.likes}
              icon={ThumbsUp}
              mode="total"
            />
            <MetricCard
              label="Matches"
              metric={m.matches}
              icon={Heart}
              mode="total"
            />
            <MetricCard
              label="Matches per 100 likes"
              metric={m.matchConversion}
              icon={Percent}
              suffix=""
            />
            <MetricCard
              label="Messages sent"
              metric={m.messagesSent}
              icon={MessagesSquare}
              mode="total"
            />
            <MetricCard
              label="Conversations started"
              metric={m.newConversations}
              icon={MessageCircle}
              mode="total"
            />
            <MetricCard
              label="Booking requests"
              metric={m.bookingRequests}
              icon={CalendarCheck}
              mode="total"
            />
            <MetricCard
              label="Profiles created"
              metric={m.profilesCreated}
              icon={UserPlus}
              mode="total"
            />
            <MetricCard
              label="Profiles completed"
              metric={m.profilesCompleted}
              icon={UserCheck}
            />
            <MetricCard
              label="Stories posted"
              metric={m.storiesPosted}
              icon={Activity}
              mode="total"
            />
            <MetricCard
              label="Chef profile views"
              metric={m.chefProfileViews}
              icon={Eye}
            />
            <MetricCard
              label="Story views and saves"
              metric={m.storyViews}
              icon={Eye}
            />
          </div>

          <Panel
            title="Active members over time"
            hint="Members who swiped, messaged or booked in each period"
          >
            {m.activeMembers?.status === 'ok' && (
              <AreaChart
                points={m.activeMembers.series}
                label="Active members"
              />
            )}
          </Panel>

          <Panel
            title="The journey"
            hint="Where people stop. The first two steps come from visitors who accepted analytics; every later step is counted from real records of the members who joined in this period."
          >
            <FunnelChart rows={data.funnel} />
          </Panel>
          {data.truncated && (
            <p className="text-xs text-[var(--admin-muted)]">
              Very busy period: figures use the most recent 20,000 records.
            </p>
          )}
        </>
      )}
    </Page>
  )
}
