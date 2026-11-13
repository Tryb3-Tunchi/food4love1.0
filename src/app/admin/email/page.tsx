'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { RotateCw } from 'lucide-react'
import {
  BarList,
  ErrorPanel,
  Page,
  Panel,
  RefreshButton,
  Skeleton,
  StatusChip,
  fmt,
  fmtAgo,
  useAdminData,
} from '@/components/admin/intelligence/kit'

interface EmailOps {
  config: { name: string; set: boolean; purpose: string }[]
  welcomeEnabled: boolean
  tracking: boolean
  byKind: Record<string, number | string>[]
  retryable: number
  failures: {
    id: string
    kind: string
    status: string
    attempts: number
    errorCode: string | null
    updatedAt: string
    recipient: string
  }[]
  waitlistCoverage: {
    total: number | null
    confirmationRecorded: number | null
  }
  events: { available: boolean; counts?: { type: string; count: number }[] }
  campaigns: {
    waitlist: { key: string; count: number }[] | null
    announcements: { key: string; count: number }[] | null
  }
  maxAttempts: number
  note: string
}

const KIND: Record<string, string> = {
  waitlist_confirmation: 'Waitlist confirmation',
  welcome: 'Welcome email',
}

export default function EmailOperationsPage() {
  const { data, error, loading, reload } =
    useAdminData<EmailOps>('intelligence/email')
  const [retrying, setRetrying] = useState(false)

  async function retry() {
    if (
      !window.confirm(
        `Retry up to 25 failed emails now? Emails Resend already accepted are never sent twice. This is recorded in the audit log.`,
      )
    )
      return
    setRetrying(true)
    try {
      const response = await fetch('/api/email/retry', { method: 'POST' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok)
        throw new Error(
          body.error === 'Forbidden'
            ? 'Your staff access does not allow retrying email'
            : body.error || 'Retry failed',
        )
      toast.success(
        `Checked ${body.checked}: ${body.accepted_by_provider} accepted, ${body.still_failing} still failing`,
      )
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Retry failed')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <Page
      title="Email operations"
      description="Whether Food4Love’s emails are going out. “Accepted” means Resend took the message; only “delivered” means it reached an inbox, and that needs the Resend webhook."
      actions={<RefreshButton onClick={reload} loading={loading} />}
    >
      {error && <ErrorPanel message={error} onRetry={reload} />}
      {loading && !data && <Skeleton className="h-64" />}
      {data && (
        <>
          <Panel
            title="Connection"
            hint="Names only; the values are never shown."
          >
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.config.map((c) => (
                <li
                  key={c.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs">
                      {c.name}
                    </span>
                    <span className="text-xs text-[var(--admin-muted)]">
                      {c.purpose}
                    </span>
                  </span>
                  <StatusChip tone={c.set ? 'ok' : 'warn'}>
                    {c.set ? 'Set' : 'Not set'}
                  </StatusChip>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[var(--admin-muted)]">
              Welcome email after confirmation is{' '}
              {data.welcomeEnabled ? 'ON' : 'OFF'} (WELCOME_EMAIL_ENABLED).
              “Set” does not prove Resend has verified the sending domain; only
              the Resend dashboard shows that.
            </p>
          </Panel>

          {!data.tracking ? (
            <Panel title="Delivery tracking">
              <p className="text-sm text-[var(--admin-muted)]">
                Per-email tracking is not switched on yet (the email_deliveries
                table has not been applied), so counts and failures cannot be
                listed. Emails still send.
              </p>
            </Panel>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.byKind.map((k) => (
                  <Panel
                    key={String(k.kind)}
                    title={KIND[String(k.kind)] ?? String(k.kind)}
                    hint={`${fmt(Number(k.total))} tracked`}
                  >
                    <BarList
                      items={(
                        [
                          'queued',
                          'accepted',
                          'delivered',
                          'bounced',
                          'failed',
                        ] as const
                      ).map((s) => ({
                        key: s,
                        label: s[0].toUpperCase() + s.slice(1),
                        value: Number(k[s]),
                      }))}
                    />
                  </Panel>
                ))}
              </div>

              <Panel
                title="Failed or bounced"
                hint="Recipients are masked. Open the waitlist or user page to act on a person."
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-[var(--admin-muted)]">
                    {fmt(data.retryable)} email{data.retryable === 1 ? '' : 's'}{' '}
                    can be retried (fewer than {data.maxAttempts} attempts).
                  </p>
                  <button
                    type="button"
                    onClick={retry}
                    disabled={retrying || data.retryable === 0}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--admin-border)] px-3 text-sm font-semibold hover:bg-[var(--admin-hover)] disabled:opacity-50"
                  >
                    <RotateCw
                      aria-hidden="true"
                      className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`}
                    />
                    {retrying ? 'Retrying…' : 'Retry failed emails'}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="border-b border-[var(--admin-border)] text-xs uppercase text-[var(--admin-muted)]">
                      <tr>
                        <th className="py-2 pr-3">Email</th>
                        <th className="py-2 pr-3">Recipient</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Attempts</th>
                        <th className="py-2 pr-3">Error</th>
                        <th className="py-2">Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.failures.map((f) => (
                        <tr
                          key={f.id}
                          className="border-[var(--admin-border)]/60 border-b"
                        >
                          <td className="py-2.5 pr-3">
                            {KIND[f.kind] ?? f.kind}
                          </td>
                          <td className="py-2.5 pr-3 font-mono text-xs">
                            {f.recipient}
                          </td>
                          <td className="py-2.5 pr-3">
                            <StatusChip tone="bad">{f.status}</StatusChip>
                          </td>
                          <td className="py-2.5 pr-3">{f.attempts}</td>
                          <td className="py-2.5 pr-3 font-mono text-xs">
                            {f.errorCode ?? '—'}
                          </td>
                          <td className="py-2.5">{fmtAgo(f.updatedAt)}</td>
                        </tr>
                      ))}
                      {data.failures.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 text-center text-[var(--admin-muted)]"
                          >
                            No failed or bounced emails recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Waitlist confirmation coverage">
              <p className="text-sm">
                {fmt(data.waitlistCoverage.confirmationRecorded)} of{' '}
                {fmt(data.waitlistCoverage.total)} waitlist members have a
                confirmation email recorded as accepted.
              </p>
            </Panel>
            <Panel
              title="Bounces and complaints (30 days)"
              hint="From Resend webhooks"
            >
              {data.events.available && data.events.counts ? (
                <BarList
                  items={data.events.counts.map((e) => ({
                    key: e.type,
                    label: e.type.replace('email.', ''),
                    value: e.count,
                  }))}
                  empty="No events yet."
                />
              ) : (
                <p className="text-sm text-[var(--admin-muted)]">
                  Not connected. Apply the analytics migration and add the
                  Resend webhook (RESEND_WEBHOOK_SECRET) to see delivered,
                  bounced and complaint events.
                </p>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Announcement emails"
              hint="From the announcements tool"
            >
              {data.campaigns.announcements ? (
                <BarList
                  items={data.campaigns.announcements.map((c) => ({
                    key: c.key,
                    label: c.key,
                    value: c.count,
                  }))}
                  empty="None sent yet."
                />
              ) : (
                <p className="text-sm text-[var(--admin-muted)]">
                  Not available.
                </p>
              )}
            </Panel>
            <Panel title="Waitlist campaign emails">
              {data.campaigns.waitlist ? (
                <BarList
                  items={data.campaigns.waitlist.map((c) => ({
                    key: c.key,
                    label: c.key,
                    value: c.count,
                  }))}
                  empty="None sent yet."
                />
              ) : (
                <p className="text-sm text-[var(--admin-muted)]">
                  Not available.
                </p>
              )}
            </Panel>
          </div>
          <p className="text-xs text-[var(--admin-muted)]">{data.note}</p>
        </>
      )}
    </Page>
  )
}
