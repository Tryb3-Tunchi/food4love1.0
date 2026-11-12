'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Download } from 'lucide-react'
import {
  ErrorPanel,
  Page,
  Panel,
  RefreshButton,
  Skeleton,
  StatusChip,
  fmt,
  fmtDate,
  useAdminData,
} from '@/components/admin/intelligence/kit'

interface Row {
  id: string
  email: string
  audience: string | null
  source: string | null
  marketingConsent: boolean
  consentAt: string | null
  joinedAt: string
  confirmationSent: boolean
  unsubscribed: boolean
  duplicate: boolean
  delivery: string | null
}
interface Waitlist {
  rows: Row[]
  total: number
  page: number
  pageSize: number
  stats: {
    total: number
    newToday: number
    newWeek: number
    newMonth: number
    marketingConsent: number
    noConsent: number
    confirmationSent: number
    confirmationNotSent: number
    unsubscribed: number
    cooks: number
    foodLovers: number
    duplicateGroups: number
    duplicateRecords: number
    failedConfirmations: number | null
    deliveryTracked: boolean
  }
  notes: { account: string; location: string; source: string }
}

const select =
  'min-h-10 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm'

export default function WaitlistPage() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [consent, setConsent] = useState('')
  const [confirmed, setConfirmed] = useState('')
  const [status, setStatus] = useState('')
  const [range, setRange] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  // Search waits for a pause in typing so each keystroke is not a request.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(q.trim())
      setPage(1)
    }, 350)
    return () => window.clearTimeout(t)
  }, [q])

  const filters = { q: search, consent, confirmed, status, range }
  const { data, error, loading, reload } = useAdminData<Waitlist>('waitlist', {
    ...filters,
    page: String(page),
  })

  async function exportCsv() {
    const ok = window.confirm(
      'This downloads the email addresses of the people currently matching your filters. The export is recorded in the audit log under your name. Continue?',
    )
    if (!ok) return
    setExporting(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => v && params.set(k, v))
      const response = await fetch(`/api/admin/waitlist/export?${params}`, {
        cache: 'no-store',
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(
          body.error === 'Forbidden'
            ? 'Your staff access does not include waitlist exports'
            : body.error || 'Export failed',
        )
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `food4love-waitlist-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded and recorded in the audit log')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const s = data?.stats
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <Page
      title="Waitlist"
      description="People who asked to hear about Food4Love before launch. Joining the waitlist only shares an email address; it does not create an account."
      actions={
        <>
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting || !data}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm font-semibold hover:bg-[var(--admin-hover)] disabled:opacity-50"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            {exporting ? 'Preparing…' : 'Export CSV'}
          </button>
          <RefreshButton onClick={reload} loading={loading} />
        </>
      }
    >
      {error && <ErrorPanel message={error} onRetry={reload} />}

      {s && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total on the waitlist" value={s.total} />
          <Stat label="Joined today" value={s.newToday} />
          <Stat label="Last 7 days" value={s.newWeek} />
          <Stat label="Last 30 days" value={s.newMonth} />
          <Stat
            label="Agreed to marketing emails"
            value={s.marketingConsent}
            sub={`${fmt(s.noConsent)} did not`}
          />
          <Stat
            label="Confirmation email sent"
            value={s.confirmationSent}
            sub={`${fmt(s.confirmationNotSent)} not recorded`}
          />
          <Stat label="Unsubscribed" value={s.unsubscribed} />
          <Stat
            label="Possible duplicates"
            value={s.duplicateRecords}
            sub={`${fmt(s.duplicateGroups)} inbox${s.duplicateGroups === 1 ? '' : 'es'} used more than once`}
          />
        </div>
      )}
      {s && (
        <p className="text-xs text-[var(--admin-muted)]">
          {fmt(s.foodLovers)} food lovers · {fmt(s.cooks)} cooks.{' '}
          {s.deliveryTracked
            ? `Failed confirmation emails: ${fmt(s.failedConfirmations)}.`
            : 'Email delivery tracking is not switched on yet, so delivery failures cannot be listed.'}
        </p>
      )}

      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <label className="min-w-[200px] flex-1">
            <span className="sr-only">Search by email</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email…"
              className="min-h-10 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm"
            />
          </label>
          <Filter
            label="Joined"
            value={range}
            onChange={(v) => {
              setRange(v)
              setPage(1)
            }}
            options={[
              ['', 'All time'],
              ['today', 'Today'],
              ['7d', 'Last 7 days'],
              ['30d', 'Last 30 days'],
              ['90d', 'Last 90 days'],
            ]}
          />
          <Filter
            label="Marketing"
            value={consent}
            onChange={(v) => {
              setConsent(v)
              setPage(1)
            }}
            options={[
              ['', 'Any consent'],
              ['yes', 'Agreed'],
              ['no', 'Did not agree'],
            ]}
          />
          <Filter
            label="Confirmation"
            value={confirmed}
            onChange={(v) => {
              setConfirmed(v)
              setPage(1)
            }}
            options={[
              ['', 'Any confirmation'],
              ['yes', 'Sent'],
              ['no', 'Not recorded'],
            ]}
          />
          <Filter
            label="Status"
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(1)
            }}
            options={[
              ['', 'Any status'],
              ['active', 'Subscribed'],
              ['unsubscribed', 'Unsubscribed'],
            ]}
          />
        </div>

        {loading && !data ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-[var(--admin-border)] text-xs uppercase text-[var(--admin-muted)]">
                <tr>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Joined</th>
                  <th className="py-2 pr-3">Interested as</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2 pr-3">Marketing</th>
                  <th className="py-2 pr-3">Confirmation</th>
                  <th className="py-2">Flags</th>
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-[var(--admin-border)]/60 border-b align-top"
                  >
                    <td className="py-2.5 pr-3 font-medium">{r.email}</td>
                    <td className="whitespace-nowrap py-2.5 pr-3">
                      {fmtDate(r.joinedAt)}
                    </td>
                    <td className="py-2.5 pr-3">
                      {r.audience === 'cook' ? 'Cook' : 'Food lover'}
                    </td>
                    <td className="py-2.5 pr-3">{r.source || '—'}</td>
                    <td className="py-2.5 pr-3">
                      {r.marketingConsent ? 'Agreed' : 'No'}
                    </td>
                    <td className="py-2.5 pr-3">
                      {r.confirmationSent ? 'Sent' : 'Not recorded'}
                      {r.delivery && r.delivery !== 'not tracked' && (
                        <span className="block text-xs text-[var(--admin-muted)]">
                          {r.delivery}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {r.duplicate && (
                          <StatusChip tone="warn">
                            Possible duplicate
                          </StatusChip>
                        )}
                        {r.unsubscribed && (
                          <StatusChip tone="neutral">Unsubscribed</StatusChip>
                        )}
                        {(r.delivery === 'failed' ||
                          r.delivery === 'bounced') && (
                          <StatusChip tone="bad">Email {r.delivery}</StatusChip>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {data && data.rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 text-center text-[var(--admin-muted)]"
                    >
                      No one matches these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {data && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-[var(--admin-muted)]">
              {fmt(data.total)} match · page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="min-h-10 rounded-lg border border-[var(--admin-border)] px-4 font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
                className="min-h-10 rounded-lg border border-[var(--admin-border)] px-4 font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Panel>

      {data && (
        <ul className="space-y-1 text-xs text-[var(--admin-muted)]">
          <li>{data.notes.account}</li>
          <li>{data.notes.location}</li>
          <li>{data.notes.source}</li>
        </ul>
      )}
    </Page>
  )
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string
  value: number
  sub?: string
}) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <p className="text-xs font-semibold text-[var(--admin-muted)]">{label}</p>
      <p className="mt-2 font-display text-3xl font-bold tracking-tight">
        {fmt(value)}
      </p>
      {sub && <p className="mt-1 text-xs text-[var(--admin-muted)]">{sub}</p>}
    </div>
  )
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={select}
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
}
