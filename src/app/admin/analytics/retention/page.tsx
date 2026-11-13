'use client'

import {
  ErrorPanel,
  Page,
  Panel,
  RefreshButton,
  Skeleton,
  Unavailable,
  fmt,
  fmtDate,
  useAdminData,
} from '@/components/admin/intelligence/kit'

interface Row {
  cohortStart: string
  size: number
  retained: (number | null)[]
}
type Retention =
  | { available: false; reason: string }
  | { available: true; rows: Row[]; truncated: boolean; note: string }

// Darker = more of the group came back. The number is always printed, so the
// shade is never the only way to read the table.
function shade(value: number) {
  const alpha = Math.min(0.85, 0.08 + (value / 100) * 0.8)
  return `rgba(232, 90, 42, ${alpha})`
}

export default function RetentionPage() {
  const { data, error, loading, reload } = useAdminData<Retention>(
    'intelligence/retention',
  )
  const ok = data && data.available ? data : null

  return (
    <Page
      title="Retention"
      description="Of the people who joined in a given week, how many were still doing something in the weeks after? The last eight weeks, from real activity."
      actions={<RefreshButton onClick={reload} loading={loading} />}
    >
      {error && <ErrorPanel message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-64" />}
      {data && !data.available && <Unavailable>{data.reason}</Unavailable>}
      {ok && (
        <Panel
          title="Weekly cohorts"
          hint="Week 0 is the week they joined; week 1 is the following week, and so on."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-1 text-sm">
              <thead className="text-xs text-[var(--admin-muted)]">
                <tr>
                  <th className="pr-2 text-left font-semibold">
                    Joined (week of)
                  </th>
                  <th className="px-2 text-right font-semibold">Members</th>
                  {ok.rows.map((_, i) => (
                    <th key={i} className="px-2 text-center font-semibold">
                      Week {i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ok.rows.map((row) => (
                  <tr key={row.cohortStart}>
                    <td className="whitespace-nowrap pr-2">
                      {fmtDate(row.cohortStart)}
                    </td>
                    <td className="px-2 text-right tabular-nums">
                      {fmt(row.size)}
                    </td>
                    {ok.rows.map((_, k) => {
                      const v = row.retained[k]
                      return (
                        <td
                          key={k}
                          className="rounded-md px-2 py-1.5 text-center tabular-nums"
                          style={
                            v === null || v === undefined
                              ? undefined
                              : {
                                  background: shade(v),
                                  color: v > 55 ? '#fff' : undefined,
                                }
                          }
                        >
                          {v === null || v === undefined ? '' : `${v}%`}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-[var(--admin-muted)]">{ok.note}</p>
          {ok.truncated && (
            <p className="mt-1 text-xs text-[var(--admin-muted)]">
              Very busy period: figures use the most recent 20,000 records.
            </p>
          )}
        </Panel>
      )}
    </Page>
  )
}
