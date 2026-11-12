'use client'

import {
  ErrorPanel,
  Page,
  Panel,
  RefreshButton,
  Skeleton,
  StatusChip,
  fmtAgo,
  useAdminData,
} from '@/components/admin/intelligence/kit'
import { RealtimeCheck } from '@/components/admin/intelligence/RealtimeCheck'

interface Health {
  checks: {
    key: string
    label: string
    state: 'ok' | 'warn' | 'down' | 'unknown'
    detail: string
  }[]
  config: { name: string; set: boolean }[]
  deployment: {
    environment: string
    commit: string | null
    branch: string | null
    region: string | null
  }
  migrations: { table: string; label: string; applied: boolean }[]
  events: {
    id: number
    created_at: string
    severity: string
    service: string
    code: string | null
    summary: string
  }[]
  severityCounts: Record<string, number> | null
  notMeasured: { label: string; reason: string }[]
}

const tone = {
  ok: 'ok',
  warn: 'warn',
  down: 'bad',
  unknown: 'neutral',
} as const
const word = {
  ok: 'Healthy',
  warn: 'Slow',
  down: 'Down',
  unknown: 'Not checked here',
} as const

export default function HealthPage() {
  const { data, error, loading, reload } = useAdminData<Health>(
    'intelligence/health',
    {},
    60_000,
  )

  return (
    <Page
      title="System health"
      description="Is Food4Love working right now, and is anything configured or missing? Checks run when you open this page and refresh every minute."
      actions={<RefreshButton onClick={reload} loading={loading} />}
    >
      {error && <ErrorPanel message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-64" />}
      {data && (
        <>
          <Panel title="Services">
            <ul className="divide-[var(--admin-border)]/60 divide-y">
              {data.checks.map((c) => (
                <li
                  key={c.key}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{c.label}</p>
                    <p className="text-xs text-[var(--admin-muted)]">
                      {c.detail}
                    </p>
                  </div>
                  {c.key === 'realtime' ? (
                    <RealtimeCheck />
                  ) : (
                    <StatusChip tone={tone[c.state]}>
                      {word[c.state]}
                    </StatusChip>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Deployment">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Item label="Environment" value={data.deployment.environment} />
                <Item
                  label="Version (commit)"
                  value={data.deployment.commit ?? 'unknown'}
                />
                <Item
                  label="Branch"
                  value={data.deployment.branch ?? 'unknown'}
                />
                <Item
                  label="Region"
                  value={data.deployment.region ?? 'unknown'}
                />
              </dl>
            </Panel>
            <Panel
              title="Configuration"
              hint="Whether each setting exists. Values are never shown."
            >
              <ul className="space-y-1.5 text-sm">
                {data.config.map((c) => (
                  <li
                    key={c.name}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="truncate font-mono text-xs">{c.name}</span>
                    <StatusChip tone={c.set ? 'ok' : 'warn'}>
                      {c.set ? 'Set' : 'Not set'}
                    </StatusChip>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel
            title="Database features waiting to be switched on"
            hint="Tables from the prepared migration. “Not applied” is normal until the owner runs it."
          >
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.migrations.map((m) => (
                <li
                  key={m.table}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] px-3 py-2 text-sm"
                >
                  <span>
                    {m.label}
                    <span className="block font-mono text-[11px] text-[var(--admin-muted)]">
                      {m.table}
                    </span>
                  </span>
                  <StatusChip tone={m.applied ? 'ok' : 'warn'}>
                    {m.applied ? 'Ready' : 'Not applied'}
                  </StatusChip>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Recent operational events"
            hint={
              data.severityCounts
                ? `Last 24 hours: ${data.severityCounts.critical ?? 0} critical, ${data.severityCounts.error ?? 0} errors, ${data.severityCounts.warning ?? 0} warnings`
                : 'Not recorded until the analytics migration is applied.'
            }
          >
            {data.events.length ? (
              <ul className="divide-[var(--admin-border)]/60 divide-y text-sm">
                {data.events.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-start justify-between gap-2 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{e.summary}</p>
                      <p className="text-xs text-[var(--admin-muted)]">
                        {e.service}
                        {e.code ? ` · ${e.code}` : ''} · {fmtAgo(e.created_at)}
                      </p>
                    </div>
                    <StatusChip
                      tone={
                        e.severity === 'info'
                          ? 'neutral'
                          : e.severity === 'warning'
                            ? 'warn'
                            : 'bad'
                      }
                    >
                      {e.severity}
                    </StatusChip>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--admin-muted)]">
                Nothing recorded.
              </p>
            )}
          </Panel>

          <Panel
            title="Not measured by the app"
            hint="These live in other tools, so they are not guessed here."
          >
            <ul className="space-y-2 text-sm">
              {data.notMeasured.map((n) => (
                <li key={n.label}>
                  <span className="font-semibold">{n.label}.</span>{' '}
                  <span className="text-[var(--admin-muted)]">{n.reason}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </Page>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-[var(--admin-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 break-all font-medium">{value}</dd>
    </div>
  )
}
