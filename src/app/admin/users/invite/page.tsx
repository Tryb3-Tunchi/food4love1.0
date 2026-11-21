'use client'

import { useCallback, useEffect, useState } from 'react'
import { MailPlus, RotateCw, Ban } from 'lucide-react'
import {
  ErrorPanel,
  Page,
  Panel,
  RefreshButton,
  Skeleton,
  StatusChip,
  fmtAgo,
  fmtDate,
} from '@/components/admin/intelligence/kit'
import {
  ACCESS_TYPES,
  accessTypeLabel,
  describeEmailDelivery,
  type InvitationStatus,
} from '@/lib/invitations/rules'

interface InvitationRecord {
  id: string
  email: string
  full_name: string
  preferred_username: string | null
  access_type: string
  personal_message: string | null
  status: InvitationStatus
  failure_reason: string | null
  send_count: number
  last_sent_at: string | null
  expires_at: string
  accepted_at: string | null
  created_at: string
  invited_by_name: string | null
  email_delivery: { status: string; last_error_code: string | null } | null
}

interface FormState {
  full_name: string
  email: string
  preferred_username: string
  access_type: string
  personal_message: string
}

const EMPTY_FORM: FormState = {
  full_name: '',
  email: '',
  preferred_username: '',
  access_type: 'beta_tester',
  personal_message: '',
}

const STATUS_TONE: Record<InvitationStatus, 'ok' | 'warn' | 'bad' | 'neutral'> =
  {
    pending: 'warn',
    accepted: 'ok',
    expired: 'neutral',
    revoked: 'neutral',
    failed: 'bad',
  }

const field =
  'mt-1 min-h-10 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm outline-none focus:border-[var(--admin-accent)]'

type Notice = { tone: 'ok' | 'warn' | 'bad'; text: string; detail?: string }

export default function InviteTestersPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const [rows, setRows] = useState<InvitationRecord[] | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const PAGE_SIZE = 25

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 350)
    return () => window.clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      })
      if (status) params.set('status', status)
      if (query) params.set('search', query)
      const response = await fetch(`/api/admin/invitations?${params}`, {
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok)
        throw new Error(body.error || 'Could not load invitations')
      setRows(body.invitations)
      setTotal(body.total)
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? cause.message : 'Could not load invitations',
      )
    } finally {
      setLoading(false)
    }
  }, [page, status, query])

  useEffect(() => {
    void load()
  }, [load])

  const set =
    (key: keyof FormState) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setForm((current) => ({ ...current, [key]: event.target.value }))
      setFieldErrors((current) => ({ ...current, [key]: '' }))
    }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true)
    setNotice(null)
    setFieldErrors({})
    try {
      const response = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 400 && body.fields) {
        setFieldErrors(body.fields)
        setNotice({
          tone: 'bad',
          text: body.error || 'Check the highlighted fields.',
        })
        return
      }
      if (!response.ok) {
        setNotice({
          tone: 'bad',
          text: body.error || 'The invitation could not be created.',
          detail: body.code ? `Reference: ${body.code}` : undefined,
        })
        if (response.status !== 409) void load()
        return
      }
      setNotice({
        tone: body.delivery === 'accepted' ? 'ok' : 'warn',
        text: body.message,
        detail: body.note ?? undefined,
      })
      if (body.delivery === 'accepted') setForm(EMPTY_FORM)
      setPage(1)
      void load()
    } catch {
      setNotice({
        tone: 'bad',
        text: 'Could not reach the server. Nothing was sent.',
      })
    } finally {
      setSending(false)
    }
  }

  async function act(row: InvitationRecord, action: 'resend' | 'revoke') {
    if (
      action === 'revoke' &&
      !window.confirm(
        `Revoke the invitation for ${row.email}? The link in their email will stop working, and this cannot be undone.`,
      )
    )
      return
    if (
      action === 'resend' &&
      !window.confirm(
        `Send ${row.full_name} a new invitation? The link in their previous email will stop working.`,
      )
    )
      return
    setBusyId(row.id)
    setNotice(null)
    try {
      const response = await fetch(`/api/admin/invitations/${row.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setNotice({ tone: 'bad', text: body.error || 'That did not work.' })
      } else {
        setNotice({
          tone:
            action === 'resend' && body.delivery !== 'accepted' ? 'warn' : 'ok',
          text: body.message,
        })
      }
    } catch {
      setNotice({ tone: 'bad', text: 'Could not reach the server.' })
    } finally {
      setBusyId(null)
      void load()
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const selected = ACCESS_TYPES.find((type) => type.key === form.access_type)

  return (
    <Page
      title="Invite testers"
      description="Invite people to try Food4Love early. Each person gets one branded email with a private link, sets their own password, and joins with no admin access."
      actions={<RefreshButton onClick={() => void load()} loading={loading} />}
    >
      <Panel
        title="New invitation"
        hint="Tester type describes how someone takes part in testing. It never grants admin access, verification or bookings."
      >
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-4 sm:grid-cols-2"
        >
          <label className="block text-xs font-semibold">
            Full name
            <input
              required
              value={form.full_name}
              onChange={set('full_name')}
              maxLength={100}
              autoComplete="off"
              aria-invalid={!!fieldErrors.full_name}
              aria-describedby={
                fieldErrors.full_name ? 'err-full_name' : undefined
              }
              className={field}
              placeholder="Adaeze Okonkwo"
            />
            {fieldErrors.full_name && (
              <span
                id="err-full_name"
                className="mt-1 block text-xs font-normal text-red-500"
              >
                {fieldErrors.full_name}
              </span>
            )}
          </label>
          <label className="block text-xs font-semibold">
            Email address
            <input
              required
              type="email"
              value={form.email}
              onChange={set('email')}
              maxLength={254}
              autoComplete="off"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'err-email' : undefined}
              className={field}
              placeholder="name@example.com"
            />
            {fieldErrors.email && (
              <span
                id="err-email"
                className="mt-1 block text-xs font-normal text-red-500"
              >
                {fieldErrors.email}
              </span>
            )}
          </label>
          <label className="block text-xs font-semibold">
            Preferred username{' '}
            <span className="font-normal text-[var(--admin-muted)]">
              (optional)
            </span>
            <input
              value={form.preferred_username}
              onChange={set('preferred_username')}
              maxLength={31}
              autoComplete="off"
              aria-invalid={!!fieldErrors.preferred_username}
              aria-describedby="hint-username"
              className={field}
              placeholder="adaeze.o"
            />
            <span
              id="hint-username"
              className={`mt-1 block text-xs font-normal ${fieldErrors.preferred_username ? 'text-red-500' : 'text-[var(--admin-muted)]'}`}
            >
              {fieldErrors.preferred_username ||
                'Kept with the invitation. Food4Love profiles do not show usernames yet.'}
            </span>
          </label>
          <label className="block text-xs font-semibold">
            Account access type
            <select
              value={form.access_type}
              onChange={set('access_type')}
              aria-describedby="hint-access"
              className={field}
            >
              {ACCESS_TYPES.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.label}
                </option>
              ))}
            </select>
            <span
              id="hint-access"
              className="mt-1 block text-xs font-normal text-[var(--admin-muted)]"
            >
              {selected?.summary}
            </span>
          </label>
          <label className="block text-xs font-semibold sm:col-span-2">
            Personal note{' '}
            <span className="font-normal text-[var(--admin-muted)]">
              (optional, shown in the email)
            </span>
            <textarea
              value={form.personal_message}
              onChange={set('personal_message')}
              maxLength={500}
              rows={3}
              aria-invalid={!!fieldErrors.personal_message}
              className={`${field} py-2`}
              placeholder="Thanks for helping us test. Tell us anything that feels off."
            />
            <span className="mt-1 flex justify-between text-xs font-normal text-[var(--admin-muted)]">
              <span
                className={fieldErrors.personal_message ? 'text-red-500' : ''}
              >
                {fieldErrors.personal_message || 'Plain text only.'}
              </span>
              <span>{form.personal_message.length}/500</span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button
              type="submit"
              disabled={sending}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--admin-accent)] px-5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              <MailPlus aria-hidden="true" className="h-4 w-4" />
              {sending ? 'Sending…' : 'Send invitation'}
            </button>
            <p className="text-xs text-[var(--admin-muted)]">
              The link expires in 7 days and works once. Nothing is sent until
              you press the button.
            </p>
          </div>
        </form>

        <div aria-live="polite" role="status" className="mt-4">
          {notice && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                notice.tone === 'ok'
                  ? 'border-emerald-600/40 bg-emerald-500/5'
                  : notice.tone === 'warn'
                    ? 'border-amber-600/40 bg-amber-500/5'
                    : 'border-red-500/40 bg-red-500/5'
              }`}
            >
              <p className="font-semibold">{notice.text}</p>
              {notice.detail && (
                <p className="mt-0.5 text-xs text-[var(--admin-muted)]">
                  {notice.detail}
                </p>
              )}
            </div>
          )}
        </div>
      </Panel>

      <Panel
        title="Invitations"
        hint="Newest first. “Accepted by email provider” means the provider took the message, not that it reached the inbox."
      >
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="sr-only" htmlFor="inv-search">
            Search invitations
          </label>
          <input
            id="inv-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email"
            className="min-h-10 min-w-[14rem] flex-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm"
          />
          <label className="sr-only" htmlFor="inv-status">
            Filter by status
          </label>
          <select
            id="inv-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
            className="min-h-10 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {loadError ? (
          <ErrorPanel message={loadError} onRetry={() => void load()} />
        ) : loading && !rows ? (
          <div
            className="space-y-2"
            role="status"
            aria-label="Loading invitations"
          >
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : rows && rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--admin-border)] p-6 text-center text-sm text-[var(--admin-muted)]">
            {status || query
              ? 'No invitations match these filters.'
              : 'No invitations yet. Send the first one above.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[var(--admin-muted)]">
                <tr>
                  <th className="pb-2 pr-3 font-semibold">Tester</th>
                  <th className="pb-2 pr-3 font-semibold">Access type</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 pr-3 font-semibold">Email</th>
                  <th className="pb-2 pr-3 font-semibold">Invited</th>
                  <th className="pb-2 pr-3 font-semibold">Expires</th>
                  <th className="pb-2 pr-3 font-semibold">Activated</th>
                  <th className="pb-2 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {rows?.map((row) => {
                  const email = describeEmailDelivery(
                    row.send_count,
                    row.email_delivery,
                  )
                  const actionable =
                    row.status === 'pending' ||
                    row.status === 'failed' ||
                    row.status === 'expired'
                  return (
                    <tr key={row.id} className="align-top">
                      <td className="py-3 pr-3">
                        <p className="font-semibold">{row.full_name}</p>
                        <p className="break-all text-xs text-[var(--admin-muted)]">
                          {row.email}
                        </p>
                        {row.preferred_username && (
                          <p className="text-xs text-[var(--admin-muted)]">
                            @{row.preferred_username}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {accessTypeLabel(row.access_type)}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusChip tone={STATUS_TONE[row.status]}>
                          {row.status[0].toUpperCase() + row.status.slice(1)}
                        </StatusChip>
                        {row.failure_reason && row.status === 'failed' && (
                          <p className="mt-1 text-xs text-[var(--admin-muted)]">
                            {row.failure_reason.replace(/_/g, ' ')}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusChip tone={email.tone}>{email.label}</StatusChip>
                        {row.send_count > 0 && (
                          <p className="mt-1 text-xs text-[var(--admin-muted)]">
                            Sent {row.send_count}× · last{' '}
                            {fmtAgo(row.last_sent_at)}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {fmtDate(row.created_at)}
                        <p className="text-xs text-[var(--admin-muted)]">
                          {row.invited_by_name ?? '—'}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        {row.status === 'accepted'
                          ? '—'
                          : fmtDate(row.expires_at)}
                      </td>
                      <td className="py-3 pr-3">{fmtDate(row.accepted_at)}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenId(openId === row.id ? null : row.id)
                            }
                            aria-expanded={openId === row.id}
                            className="min-h-9 rounded-lg border border-[var(--admin-border)] px-3 text-xs font-semibold hover:bg-[var(--admin-hover)]"
                          >
                            Details
                          </button>
                          {actionable && (
                            <>
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                onClick={() => void act(row, 'resend')}
                                className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--admin-border)] px-3 text-xs font-semibold hover:bg-[var(--admin-hover)] disabled:opacity-50"
                              >
                                <RotateCw
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5"
                                />
                                Resend
                              </button>
                              <button
                                type="button"
                                disabled={busyId === row.id}
                                onClick={() => void act(row, 'revoke')}
                                className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-500/40 px-3 text-xs font-semibold text-red-500 hover:bg-red-500/5 disabled:opacity-50"
                              >
                                <Ban
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5"
                                />
                                Revoke
                              </button>
                            </>
                          )}
                        </div>
                        {openId === row.id && (
                          <dl className="mt-3 space-y-1 rounded-lg bg-[var(--admin-hover)] p-3 text-left text-xs">
                            <div>
                              <dt className="inline font-semibold">
                                Created:{' '}
                              </dt>
                              <dd className="inline">
                                {fmtDate(row.created_at, true)}
                              </dd>
                            </div>
                            <div>
                              <dt className="inline font-semibold">
                                Expires:{' '}
                              </dt>
                              <dd className="inline">
                                {fmtDate(row.expires_at, true)}
                              </dd>
                            </div>
                            {row.personal_message && (
                              <div>
                                <dt className="inline font-semibold">Note: </dt>
                                <dd className="inline">
                                  {row.personal_message}
                                </dd>
                              </div>
                            )}
                            {row.email_delivery?.last_error_code && (
                              <div>
                                <dt className="inline font-semibold">
                                  Last email error:{' '}
                                </dt>
                                <dd className="inline">
                                  {row.email_delivery.last_error_code}
                                </dd>
                              </div>
                            )}
                          </dl>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              className="min-h-9 rounded-lg border border-[var(--admin-border)] px-3 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-[var(--admin-muted)]">
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((current) => current + 1)}
              className="min-h-9 rounded-lg border border-[var(--admin-border)] px-3 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </Panel>
    </Page>
  )
}
