'use client'

import {
  Bell,
  Heart,
  MessageCircle,
  MessagesSquare,
  ShieldAlert,
  Zap,
} from 'lucide-react'
import type { Metric } from '@/lib/admin/intelligence/series'
import {
  CardGridSkeleton,
  ErrorPanel,
  MetricCard,
  Page,
  Panel,
  RangeBar,
  RefreshButton,
  StatusChip,
  fmtAgo,
  useAdminData,
  useRangeState,
} from '@/components/admin/intelligence/kit'
import { RealtimeCheck } from '@/components/admin/intelligence/RealtimeCheck'

interface Conversations {
  metrics: Record<string, Metric>
  diagnostics: {
    lastMessageAt: string | null
    lastMatchAt: string | null
    lastNotificationAt: string | null
    errorsLast24h: number | null
  }
  privacyNote: string
}

export default function ConversationsPage() {
  const { value, setValue, params } = useRangeState('30d')
  const { data, error, loading, reload } = useAdminData<Conversations>(
    'intelligence/conversations',
    params,
  )
  const m = data?.metrics

  return (
    <Page
      title="Matches & conversations"
      description="How the social side is working: matches, conversations, messages, notifications and whether data is still being saved. Message text is never shown here."
      actions={
        <>
          <RangeBar value={value} onChange={setValue} />
          <RefreshButton onClick={reload} loading={loading} />
        </>
      }
    >
      {error && <ErrorPanel message={error} onRetry={reload} />}
      {loading && !data && <CardGridSkeleton count={8} />}
      {m && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Matches created"
              metric={m.totalMatches}
              icon={Heart}
              mode="total"
            />
            <MetricCard
              label="Open matches"
              metric={m.activeMatches}
              icon={Heart}
            />
            <MetricCard
              label="Matches today"
              metric={m.matchesToday}
              icon={Zap}
            />
            <MetricCard
              label="Matches last 7 days"
              metric={m.matchesWeek}
              icon={Zap}
            />
            <MetricCard
              label="Conversations started"
              metric={m.newConversations}
              icon={MessageCircle}
              mode="total"
            />
            <MetricCard
              label="Active conversations"
              metric={m.activeConversations}
              icon={MessageCircle}
            />
            <MetricCard
              label="Messages today"
              metric={m.messagesToday}
              icon={MessagesSquare}
              mode="total"
            />
            <MetricCard
              label="Unread notifications"
              metric={m.unreadNotifications}
              icon={Bell}
              mode="total"
            />
            <MetricCard
              label="Failed message sends"
              metric={m.failedMessageOperations}
              icon={ShieldAlert}
            />
          </div>

          <Panel
            title="Is everything still being saved?"
            hint="The last time each part stored something. A long silence on a busy platform is worth a look."
          >
            <dl className="grid gap-3 sm:grid-cols-3">
              <Pulse
                label="Last message stored"
                at={data.diagnostics.lastMessageAt}
              />
              <Pulse
                label="Last match created"
                at={data.diagnostics.lastMatchAt}
              />
              <Pulse
                label="Last notification created"
                at={data.diagnostics.lastNotificationAt}
              />
            </dl>
            <p className="mt-3 text-sm">
              Server errors recorded in the last 24 hours:{' '}
              {data.diagnostics.errorsLast24h === null ? (
                <span className="text-[var(--admin-muted)]">
                  not recorded (operational events are not switched on)
                </span>
              ) : (
                <StatusChip
                  tone={data.diagnostics.errorsLast24h ? 'bad' : 'ok'}
                >
                  {data.diagnostics.errorsLast24h}
                </StatusChip>
              )}
            </p>
          </Panel>

          <Panel
            title="Realtime connection"
            hint="Checked live from your browser right now."
          >
            <RealtimeCheck />
          </Panel>
          <p className="text-xs text-[var(--admin-muted)]">
            {data.privacyNote}
          </p>
        </>
      )}
    </Page>
  )
}

function Pulse({ label, at }: { label: string; at: string | null }) {
  return (
    <div className="rounded-xl border border-[var(--admin-border)] p-3">
      <dt className="text-xs font-semibold text-[var(--admin-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold">
        {at ? fmtAgo(at) : 'Nothing yet'}
      </dd>
    </div>
  )
}
