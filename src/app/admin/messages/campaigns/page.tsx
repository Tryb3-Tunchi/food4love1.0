'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Mail, Megaphone, RefreshCw, Send, Users } from 'lucide-react'

type AudienceSummary = {
  active_members: number
  email_opted_in_members: number
  email_configured: boolean
  email_sender: string | null
}

type WaitlistSummary = {
  eligible_count: number
  email_configured: boolean
  email_sender: string | null
}

type BatchResult = {
  attempted: number
  email_sent?: number
  email_skipped?: number
  email_failed?: number
  in_app_sent?: number
  in_app_failed?: number
  sent?: number
  failed?: number
  skipped?: number
  hasMore: boolean
  nextAfterUserId?: string | null
  nextAfterId?: string | null
}

type CampaignRun = {
  campaignKey: string
  after?: string
  subject: string
  message: string
  sendEmail?: boolean
  sendInApp?: boolean
  kind?: 'launch' | 'newsletter' | 'offer'
}

const ACCOUNT_SUBJECT = 'A Food4Love update is on the way'
const ACCOUNT_MESSAGE = `Hello Food4Love community,\n\nWe have a new update to share with you.\n\n[Add your update here]\n\nThank you for being part of Food4Love.`
const WAITLIST_SUBJECT = 'Food4Love is getting ready to welcome you 🍲'
const WAITLIST_MESSAGE = `Hi there,\n\nWe’re building Food4Love to bring people together around good food—helping food lovers discover local home cooks and making it easier for cooks to share what they do.\n\nWe’ll send you updates as we get ready to open. If you reply, tell us your city and whether you’re joining as a food lover or a cook. That will help us plan where to start.\n\nThank you for being here,\nThe Food4Love team`

function CountCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-xl font-bold">
          {value.toLocaleString()}
        </span>
        <span className="block text-xs text-[var(--text-3)]">{label}</span>
      </span>
    </div>
  )
}

export default function AdminEmailCampaignsPage() {
  const [mode, setMode] = useState<'members' | 'waitlist'>('members')
  const [summary, setSummary] = useState<AudienceSummary | null>(null)
  const [waitlistSummary, setWaitlistSummary] =
    useState<WaitlistSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [subject, setSubject] = useState(ACCOUNT_SUBJECT)
  const [message, setMessage] = useState(ACCOUNT_MESSAGE)
  const [sendEmail, setSendEmail] = useState(true)
  const [sendInApp, setSendInApp] = useState(true)
  const [acknowledged, setAcknowledged] = useState(false)
  const [waitlistSubject, setWaitlistSubject] = useState(WAITLIST_SUBJECT)
  const [waitlistMessage, setWaitlistMessage] = useState(WAITLIST_MESSAGE)
  const [waitlistKind, setWaitlistKind] = useState<
    'launch' | 'newsletter' | 'offer'
  >('launch')
  const [waitlistAcknowledged, setWaitlistAcknowledged] = useState(false)
  const [memberRun, setMemberRun] = useState<CampaignRun | null>(null)
  const [waitlistRun, setWaitlistRun] = useState<CampaignRun | null>(null)
  const [sending, setSending] = useState(false)
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null)
  const [resultLabel, setResultLabel] = useState('')

  const loadSummary = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [membersResponse, waitlistResponse] = await Promise.all([
        fetch('/api/admin/announcements', { cache: 'no-store' }),
        fetch('/api/waitlist/campaigns', { cache: 'no-store' }),
      ])
      const [membersData, waitlistData] = await Promise.all([
        membersResponse.json(),
        waitlistResponse.json(),
      ])
      if (!membersResponse.ok || !waitlistResponse.ok) {
        throw new Error(
          membersData.error || waitlistData.error || 'Could not load audiences',
        )
      }
      setSummary(membersData)
      setWaitlistSummary(waitlistData)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load audiences',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  async function sendBatch(
    event: FormEvent<HTMLFormElement>,
    audience: 'members' | 'waitlist',
  ) {
    event.preventDefault()
    if (sending) return
    setSending(true)
    setError('')
    setBatchResult(null)

    const activeRun = audience === 'members' ? memberRun : waitlistRun
    const run: CampaignRun = activeRun ?? {
      campaignKey: crypto.randomUUID(),
      subject: audience === 'members' ? subject.trim() : waitlistSubject.trim(),
      message: audience === 'members' ? message.trim() : waitlistMessage.trim(),
      sendEmail: audience === 'members' ? sendEmail : true,
      sendInApp: audience === 'members' ? sendInApp : false,
      kind: audience === 'members' ? undefined : waitlistKind,
    }
    if (!activeRun) {
      if (audience === 'members') setMemberRun(run)
      else setWaitlistRun(run)
    }

    try {
      const endpoint =
        audience === 'members'
          ? '/api/admin/announcements'
          : '/api/waitlist/campaigns'
      const body =
        audience === 'members'
          ? {
              campaignKey: run.campaignKey,
              subject: run.subject,
              message: run.message,
              sendEmail: run.sendEmail,
              sendInApp: run.sendInApp,
              ...(run.after ? { afterUserId: run.after } : {}),
            }
          : {
              campaignKey: run.campaignKey,
              kind: run.kind,
              subject: run.subject,
              message: run.message,
              ...(run.after ? { afterId: run.after } : {}),
            }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not send update')

      setBatchResult(result)
      setResultLabel(audience === 'members' ? 'Registered members' : 'Waitlist')
      const nextRun = result.hasMore
        ? {
            ...run,
            after:
              audience === 'members'
                ? result.nextAfterUserId
                : result.nextAfterId,
          }
        : null
      if (audience === 'members') setMemberRun(nextRun)
      else setWaitlistRun(nextRun)
      setAcknowledged(false)
      setWaitlistAcknowledged(false)
      await loadSummary(true)
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : 'Could not send update',
      )
    } finally {
      setSending(false)
    }
  }

  const memberLocked = Boolean(memberRun)
  const waitlistLocked = Boolean(waitlistRun)

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 text-[var(--text-1)] sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
            Communications
          </p>
          <h1 className="mt-1 text-2xl font-bold">Announcements & email</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-3)]">
            Send product updates from the admin dashboard. Email addresses stay
            on the server; email delivery follows each member’s opt-in.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSummary(true)}
          disabled={refreshing || loading}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold hover:bg-[var(--bg-2)] disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
          />
          Refresh audience
        </button>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-200"
        >
          {error}
        </p>
      )}

      {batchResult && (
        <section
          aria-live="polite"
          className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm"
        >
          <h2 className="font-semibold">{resultLabel} batch processed</h2>
          <p className="mt-1 text-[var(--text-2)]">
            {batchResult.in_app_sent !== undefined
              ? `${batchResult.in_app_sent} in-app notifications · ${batchResult.email_sent ?? 0} emails sent · ${batchResult.email_skipped ?? 0} emails skipped · ${batchResult.email_failed ?? 0} email failures · ${batchResult.in_app_failed ?? 0} notification failures.`
              : `${batchResult.sent ?? 0} emails sent · ${batchResult.skipped ?? 0} skipped · ${batchResult.failed ?? 0} failed.`}
          </p>
          {(memberRun || waitlistRun) && (
            <p className="mt-2 font-medium">
              More recipients remain. Continue the same campaign to send the
              next batch.
            </p>
          )}
        </section>
      )}

      <div
        className="flex gap-2 border-b border-[var(--border)]"
        role="tablist"
        aria-label="Announcement audience"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'members'}
          onClick={() => setMode('members')}
          className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${mode === 'members' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-3)]'}`}
        >
          <Users className="h-4 w-4" /> App members
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'waitlist'}
          onClick={() => setMode('waitlist')}
          className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${mode === 'waitlist' ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-3)]'}`}
        >
          <Mail className="h-4 w-4" /> Waitlist
        </button>
      </div>

      {mode === 'members' ? (
        <form
          onSubmit={(event) => void sendBatch(event, 'members')}
          className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <CountCard
              icon={Users}
              label="Active buyers and cooks · in-app audience"
              value={summary?.active_members ?? 0}
            />
            <CountCard
              icon={Mail}
              label="Members opted in to email · unconfirmed addresses are skipped"
              value={summary?.email_opted_in_members ?? 0}
            />
          </div>
          <div className="rounded-lg bg-[var(--bg-2)] p-3 text-xs leading-5 text-[var(--text-2)]">
            In-app announcements go to all active buyer and cook accounts. Email
            is limited to members who opted in and have a confirmed address.
            Their email addresses are never sent to the browser.
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Subject</span>
            <input
              required
              maxLength={120}
              value={memberRun?.subject ?? subject}
              disabled={memberLocked || sending}
              onChange={(event) => setSubject(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Update</span>
            <textarea
              required
              maxLength={5000}
              rows={7}
              value={memberRun?.message ?? message}
              disabled={memberLocked || sending}
              onChange={(event) => setMessage(event.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-sm leading-6 outline-none focus:border-[var(--accent)] disabled:opacity-60"
            />
          </label>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={memberRun?.sendInApp ?? sendInApp}
                disabled={memberLocked || sending}
                onChange={(event) => setSendInApp(event.target.checked)}
              />
              Add to all active members’ notification feed
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={memberRun?.sendEmail ?? sendEmail}
                disabled={memberLocked || sending || !summary?.email_configured}
                onChange={(event) => setSendEmail(event.target.checked)}
              />
              Also email opted-in members
            </label>
          </div>
          {!summary?.email_configured && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Member email delivery needs RESEND_API_KEY and
              ACCOUNT_UPDATES_FROM_EMAIL on the server.
            </p>
          )}
          {!memberRun && (
            <label className="flex items-start gap-2 text-xs leading-5 text-[var(--text-2)]">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                className="mt-1"
              />
              I reviewed this update and understand it will be delivered to the
              selected member channels.
            </label>
          )}
          <button
            type="submit"
            disabled={
              loading ||
              sending ||
              (!memberRun && !acknowledged) ||
              (!sendEmail && !sendInApp)
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />{' '}
            {sending
              ? 'Sending batch…'
              : memberRun
                ? 'Continue next batch'
                : 'Send member update'}
          </button>
          {!summary?.email_configured && !sendInApp && (
            <p className="text-xs text-red-700 dark:text-red-300">
              Email is not configured, so no delivery channel is available.
            </p>
          )}
        </form>
      ) : (
        <form
          onSubmit={(event) => void sendBatch(event, 'waitlist')}
          className="space-y-5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <CountCard
              icon={Mail}
              label="Waitlist subscribers opted in to updates"
              value={waitlistSummary?.eligible_count ?? 0}
            />
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-2)] p-4 text-xs leading-5 text-[var(--text-2)]">
              <Megaphone className="h-5 w-5 shrink-0 text-[var(--accent)]" />{' '}
              Only opted-in waitlist subscribers who have not unsubscribed
              receive this campaign.
            </div>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Campaign type</span>
            <select
              value={waitlistKind}
              disabled={waitlistLocked || sending}
              onChange={(event) =>
                setWaitlistKind(
                  event.target.value as 'launch' | 'newsletter' | 'offer',
                )
              }
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
            >
              <option value="launch">Launch update</option>
              <option value="newsletter">Newsletter</option>
              <option value="offer">Offer</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Subject</span>
            <input
              required
              maxLength={120}
              value={waitlistRun?.subject ?? waitlistSubject}
              disabled={waitlistLocked || sending}
              onChange={(event) => setWaitlistSubject(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-60"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Message</span>
            <textarea
              required
              maxLength={5000}
              rows={8}
              value={waitlistRun?.message ?? waitlistMessage}
              disabled={waitlistLocked || sending}
              onChange={(event) => setWaitlistMessage(event.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 text-sm leading-6 outline-none focus:border-[var(--accent)] disabled:opacity-60"
            />
          </label>
          {!waitlistSummary?.email_configured && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Waitlist email delivery needs RESEND_API_KEY and
              WAITLIST_FROM_EMAIL on the server.
            </p>
          )}
          {!waitlistRun && (
            <label className="flex items-start gap-2 text-xs leading-5 text-[var(--text-2)]">
              <input
                type="checkbox"
                checked={waitlistAcknowledged}
                onChange={(event) =>
                  setWaitlistAcknowledged(event.target.checked)
                }
                className="mt-1"
              />
              I reviewed this campaign and understand it will be sent to all
              eligible waitlist subscribers.
            </label>
          )}
          <button
            type="submit"
            disabled={
              loading ||
              sending ||
              !waitlistSummary?.email_configured ||
              (!waitlistRun && !waitlistAcknowledged)
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />{' '}
            {sending
              ? 'Sending batch…'
              : waitlistRun
                ? 'Continue next batch'
                : 'Send waitlist update'}
          </button>
        </form>
      )}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-2)] p-4 text-xs leading-5 text-[var(--text-3)]">
        <h2 className="font-semibold text-[var(--text-1)]">
          Automatic signup emails
        </h2>
        <p className="mt-1">
          New accounts receive Supabase’s signup confirmation template. New
          waitlist entries receive a separate transactional confirmation. These
          are separate from marketing updates.
        </p>
      </section>
    </main>
  )
}
