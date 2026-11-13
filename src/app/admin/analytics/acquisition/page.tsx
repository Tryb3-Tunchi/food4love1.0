'use client'

import type { Metric } from '@/lib/admin/intelligence/series'
import {
  CardGridSkeleton,
  ErrorPanel,
  MetricCard,
  Page,
  Panel,
  RangeBar,
  RefreshButton,
  Unavailable,
  fmt,
  fmtPercent,
  useAdminData,
  useRangeState,
} from '@/components/admin/intelligence/kit'
import { UserPlus } from 'lucide-react'

interface Channel {
  channel: string
  label: string
  visits: number
  previousVisits: number
  growth: number | null
  visitors: number
  returningVisitors: number
  waitlist: number
  registered: number
  waitlistRate: number | null
  registrationRate: number | null
}
interface Acquisition {
  available: boolean
  reason: string
  truncated: boolean
  channels: Channel[]
  campaigns: {
    name: string
    visits: number
    visitors: number
    waitlist: number
    registered: number
  }[]
  referrals: Metric
}

export default function AcquisitionPage() {
  const { value, setValue, params } = useRangeState('30d')
  const { data, error, loading, reload } = useAdminData<Acquisition>(
    'intelligence/acquisition',
    params,
  )

  return (
    <Page
      title="Acquisition"
      description="How people find Food4Love and which sources bring real sign-ups, not just clicks. Tag your links (for example ?utm_source=instagram&utm_campaign=launch) to see them here."
      actions={
        <>
          <RangeBar value={value} onChange={setValue} />
          <RefreshButton onClick={reload} loading={loading} />
        </>
      }
    >
      {error && <ErrorPanel message={error} onRetry={reload} />}
      {loading && !data && <CardGridSkeleton count={4} />}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Sign-ups through referral links"
              metric={data.referrals}
              icon={UserPlus}
              mode="total"
            />
          </div>
          <p className="-mt-3 text-xs text-[var(--admin-muted)]">
            Referral sign-ups come from the referrals table, so this figure is
            complete history, not just consenting visitors.
          </p>

          {!data.available ? (
            <Unavailable>{data.reason}</Unavailable>
          ) : (
            <>
              <Panel
                title="Traffic by source"
                hint="Compared with the previous period. Sign-ups count visitors who accepted analytics."
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-[var(--admin-border)] text-xs uppercase text-[var(--admin-muted)]">
                      <tr>
                        <th className="py-2 pr-3">Source</th>
                        <th className="py-2 pr-3">Visits</th>
                        <th className="py-2 pr-3">Change</th>
                        <th className="py-2 pr-3">Visitors</th>
                        <th className="py-2 pr-3">Returning</th>
                        <th className="py-2 pr-3">Waitlist</th>
                        <th className="py-2 pr-3">Accounts</th>
                        <th className="py-2">Conversion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.channels.map((c) => (
                        <tr
                          key={c.channel}
                          className="border-[var(--admin-border)]/60 border-b"
                        >
                          <td className="py-2.5 pr-3 font-medium">{c.label}</td>
                          <td className="py-2.5 pr-3">{fmt(c.visits)}</td>
                          <td className="py-2.5 pr-3">
                            {c.growth === null
                              ? '—'
                              : `${c.growth > 0 ? '+' : ''}${c.growth}%`}
                          </td>
                          <td className="py-2.5 pr-3">{fmt(c.visitors)}</td>
                          <td className="py-2.5 pr-3">
                            {fmt(c.returningVisitors)}
                          </td>
                          <td className="py-2.5 pr-3">
                            {fmt(c.waitlist)}{' '}
                            <span className="text-xs text-[var(--admin-muted)]">
                              ({fmtPercent(c.waitlistRate)})
                            </span>
                          </td>
                          <td className="py-2.5 pr-3">
                            {fmt(c.registered)}{' '}
                            <span className="text-xs text-[var(--admin-muted)]">
                              ({fmtPercent(c.registrationRate)})
                            </span>
                          </td>
                          <td className="py-2.5 text-xs text-[var(--admin-muted)]">
                            of visitors
                          </td>
                        </tr>
                      ))}
                      {data.channels.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="py-8 text-center text-[var(--admin-muted)]"
                          >
                            No visits in this period yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel
                title="Campaign performance"
                hint="Links that carry a utm_campaign tag. Measures sign-ups, not clicks."
              >
                {data.campaigns.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="border-b border-[var(--admin-border)] text-xs uppercase text-[var(--admin-muted)]">
                        <tr>
                          <th className="py-2 pr-3">Campaign · source</th>
                          <th className="py-2 pr-3">Visits</th>
                          <th className="py-2 pr-3">Visitors</th>
                          <th className="py-2 pr-3">Waitlist</th>
                          <th className="py-2">Accounts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.campaigns.map((c) => (
                          <tr
                            key={c.name}
                            className="border-[var(--admin-border)]/60 border-b"
                          >
                            <td className="py-2.5 pr-3 font-medium">
                              {c.name}
                            </td>
                            <td className="py-2.5 pr-3">{fmt(c.visits)}</td>
                            <td className="py-2.5 pr-3">{fmt(c.visitors)}</td>
                            <td className="py-2.5 pr-3">{fmt(c.waitlist)}</td>
                            <td className="py-2.5">{fmt(c.registered)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--admin-muted)]">
                    No tagged campaign visits yet. Add{' '}
                    <code>
                      ?utm_source=instagram&amp;utm_campaign=your-campaign-name
                    </code>{' '}
                    to a link you share.
                  </p>
                )}
              </Panel>
            </>
          )}
        </>
      )}
    </Page>
  )
}
