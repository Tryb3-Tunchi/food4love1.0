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
  name: string
  subject: string
  previewText: string
  heading: string
  message: string
  ctaLabel: string
  ctaUrl: string
  targetGroup: 'all' | 'buyers' | 'cooks' | 'testers' | 'selected'
  selectedUserIds: string[]
  selectedSubscriberIds: string[]
  sendEmail?: boolean
  sendInApp?: boolean
  kind?: 'launch' | 'newsletter' | 'offer'
}

type RecipientOption = { id: string; label: string; detail?: string }
type CampaignHistoryItem = {
  campaign_key: string
  campaign_name: string | null
  subject: string
  message: string
  preview_text: string | null
  email_heading: string | null
  cta_label: string | null
  cta_url: string | null
  campaign_status: string
  scheduled_at: string | null
  audience: 'members' | 'waitlist'
  target_group?: CampaignRun['targetGroup']
  selected_user_ids?: string[]
  selected_subscriber_ids?: string[]
  kind?: 'launch' | 'newsletter' | 'offer'
  stats?: {
    recipients: number
    delivered: number
    accepted: number
    bounced: number
    failed: number
    skipped: number
    queued: number
  }
}

const ACCOUNT_SUBJECT = 'A Food4Love update is on the way'
const ACCOUNT_MESSAGE = `Hello Food4Love community,\n\nWe have a new update to share with you.\n\n[Add your update here]\n\nThank you for being part of Food4Love.`
const WAITLIST_SUBJECT = 'Food4Love is getting ready to welcome you 🍲'
const WAITLIST_MESSAGE = `Hi there,\n\nWe’re building Food4Love to bring people together around good food—helping food lovers discover local home cooks and making it easier for cooks to share what they do.\n\nWe’ll send you updates as we get ready to open. If you reply, tell us your city and whether you’re joining as a food lover or a cook. That will help us plan where to start.\n\nThank you for being here,\nThe Food4Love team`

const memberTemplates = {
  product: {
    subject: 'A Food4Love update is on the way',
    preview: 'A note from the Food4Love team.',
    heading: 'A little Food4Love update',
    message:
      'Hello {{first_name}},\n\nWe have a new update to share with the Food4Love community.\n\n[Add your update here]\n\nThank you for being part of Food4Love.',
  },
  cook: {
    subject: 'A note for Food4Love cooks',
    preview: 'What’s new for the cooks sharing their craft.',
    heading: 'For the cooks in our community',
    message:
      'Hello {{first_name}},\n\nHere is a Food4Love update for our {{account_type}} community.\n\n[Add details here]\n\nThank you for sharing your cooking with Food4Love.',
  },
  custom: {
    subject: 'A message from Food4Love',
    preview: 'A personal update from the Food4Love team.',
    heading: 'Hello from Food4Love',
    message:
      'Hello {{first_name}},\n\n[Write your message here]\n\nWith care,\nThe Food4Love team',
  },
} as const

const waitlistTemplates = {
  launch: {
    subject: WAITLIST_SUBJECT,
    preview: 'Something delicious is taking shape at Food4Love.',
    heading: 'Something delicious is taking shape',
    message: WAITLIST_MESSAGE,
  },
  community: {
    subject: 'A Food4Love note for you',
    preview: 'A quick update for our waitlist community.',
    heading: 'Hello from Food4Love',
    message:
      'Hello there,\n\nWe’re building Food4Love to bring people together around good food and local cooks.\n\n[Add your update here]\n\nThanks for being on the list.',
  },
  custom: {
    subject: 'A message from Food4Love',
    preview: 'An update from the Food4Love team.',
    heading: 'A Food4Love update',
    message:
      'Hello there,\n\n[Write your message here]\n\nWith care,\nThe Food4Love team',
  },
} as const

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
  const [notice, setNotice] = useState('')
  const [campaignName, setCampaignName] = useState('Food4Love update')
  const [memberTemplate, setMemberTemplate] =
    useState<keyof typeof memberTemplates>('product')
  const [subject, setSubject] = useState(ACCOUNT_SUBJECT)
  const [previewText, setPreviewText] = useState(
    'A new update from your Food4Love team.',
  )
  const [heading, setHeading] = useState('A little Food4Love update')
  const [message, setMessage] = useState(ACCOUNT_MESSAGE)
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [sendInApp, setSendInApp] = useState(true)
  const [targetGroup, setTargetGroup] =
    useState<CampaignRun['targetGroup']>('all')
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>(
    [],
  )
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [acknowledged, setAcknowledged] = useState(false)
  const [waitlistSubject, setWaitlistSubject] = useState(WAITLIST_SUBJECT)
  const [waitlistName, setWaitlistName] = useState('Food4Love waitlist update')
  const [waitlistTemplate, setWaitlistTemplate] =
    useState<keyof typeof waitlistTemplates>('launch')
  const [waitlistPreview, setWaitlistPreview] = useState(
    'Something delicious is taking shape at Food4Love.',
  )
  const [waitlistHeading, setWaitlistHeading] = useState(
    'Something delicious is taking shape',
  )
  const [waitlistMessage, setWaitlistMessage] = useState(WAITLIST_MESSAGE)
  const [waitlistCtaLabel, setWaitlistCtaLabel] = useState('')
  const [waitlistCtaUrl, setWaitlistCtaUrl] = useState('')
  const [waitlistSearch, setWaitlistSearch] = useState('')
  const [waitlistOptions, setWaitlistOptions] = useState<RecipientOption[]>([])
  const [selectedSubscriberIds, setSelectedSubscriberIds] = useState<string[]>(
    [],
  )
  const [waitlistSelected, setWaitlistSelected] = useState(false)
  const [waitlistKind, setWaitlistKind] = useState<
    'launch' | 'newsletter' | 'offer'
  >('launch')
  const [waitlistAcknowledged, setWaitlistAcknowledged] = useState(false)
  const [memberRun, setMemberRun] = useState<CampaignRun | null>(null)
  const [waitlistRun, setWaitlistRun] = useState<CampaignRun | null>(null)
  const [sending, setSending] = useState(false)
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null)
  const [resultLabel, setResultLabel] = useState('')
  const [campaigns, setCampaigns] = useState<CampaignHistoryItem[]>([])
  const [memberCampaignKey, setMemberCampaignKey] = useState('')
  const [waitlistCampaignKey, setWaitlistCampaignKey] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [actionBusy, setActionBusy] = useState(false)

  const loadSummary = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const [membersResponse, waitlistResponse] = await Promise.all([
        fetch('/api/admin/announcements', { cache: 'no-store' }),
        fetch('/api/waitlist/campaigns', { cache: 'no-store' }),
      ])
      const campaignsResponse = await fetch('/api/admin/campaigns', {
        cache: 'no-store',
      })
      const [membersData, waitlistData] = await Promise.all([
        membersResponse.json(),
        waitlistResponse.json(),
      ])
      const campaignsData = await campaignsResponse.json()
      if (
        !membersResponse.ok ||
        !waitlistResponse.ok ||
        !campaignsResponse.ok
      ) {
        throw new Error(
          membersData.error || waitlistData.error || 'Could not load audiences',
        )
      }
      setSummary(membersData)
      setWaitlistSummary(waitlistData)
      setCampaigns(campaignsData.campaigns ?? [])
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

  useEffect(() => {
    if (targetGroup !== 'selected') {
      setRecipientOptions([])
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/admin/announcements/recipients?group=selected&search=${encodeURIComponent(recipientSearch)}`,
          { cache: 'no-store', signal: controller.signal },
        )
        const data = await response.json()
        if (response.ok)
          setRecipientOptions(
            (data.recipients ?? []).map(
              (item: {
                id: string
                full_name: string | null
                role: string
                location: string | null
                email_updates_consent: boolean
              }) => ({
                id: item.id,
                label: item.full_name || 'Food4Love member',
                detail: `${item.role}${item.location ? ` · ${item.location}` : ''}${item.email_updates_consent ? ' · email opted in' : ' · in-app only'}`,
              }),
            ),
          )
      } catch {
        if (!controller.signal.aborted) setRecipientOptions([])
      }
    }, 200)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [recipientSearch, targetGroup])

  useEffect(() => {
    if (!waitlistSelected) {
      setWaitlistOptions([])
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/waitlist/campaigns/recipients?search=${encodeURIComponent(waitlistSearch)}`,
          { cache: 'no-store', signal: controller.signal },
        )
        const data = await response.json()
        if (response.ok)
          setWaitlistOptions(
            (data.recipients ?? []).map(
              (item: {
                id: string
                email_label: string
                audience: string
              }) => ({
                id: item.id,
                label: item.email_label,
                detail: item.audience.replace('_', ' '),
              }),
            ),
          )
      } catch {
        if (!controller.signal.aborted) setWaitlistOptions([])
      }
    }, 200)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [waitlistSearch, waitlistSelected])

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
      campaignKey:
        audience === 'members'
          ? memberCampaignKey || crypto.randomUUID()
          : waitlistCampaignKey || crypto.randomUUID(),
      name: audience === 'members' ? campaignName.trim() : waitlistName.trim(),
      subject: audience === 'members' ? subject.trim() : waitlistSubject.trim(),
      previewText:
        audience === 'members' ? previewText.trim() : waitlistPreview.trim(),
      heading: audience === 'members' ? heading.trim() : waitlistHeading.trim(),
      message: audience === 'members' ? message.trim() : waitlistMessage.trim(),
      ctaLabel:
        audience === 'members' ? ctaLabel.trim() : waitlistCtaLabel.trim(),
      ctaUrl: audience === 'members' ? ctaUrl.trim() : waitlistCtaUrl.trim(),
      targetGroup,
      selectedUserIds,
      selectedSubscriberIds,
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
              campaignName: run.name,
              subject: run.subject,
              previewText: run.previewText,
              heading: run.heading,
              message: run.message,
              ctaLabel: run.ctaLabel,
              ctaUrl: run.ctaUrl,
              sendEmail: run.sendEmail,
              sendInApp: run.sendInApp,
              targetGroup: run.targetGroup,
              selectedUserIds: run.selectedUserIds,
              ...(run.after ? { afterUserId: run.after } : {}),
            }
          : {
              campaignKey: run.campaignKey,
              campaignName: run.name,
              kind: run.kind,
              subject: run.subject,
              previewText: run.previewText,
              heading: run.heading,
              message: run.message,
              ctaLabel: run.ctaLabel,
              ctaUrl: run.ctaUrl,
              selectedIds: waitlistSelected ? run.selectedSubscriberIds : [],
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
      if (audience === 'members') setMemberCampaignKey(run.campaignKey)
      else setWaitlistCampaignKey(run.campaignKey)
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

  async function saveCampaign(
    audience: 'members' | 'waitlist',
    action: 'draft' | 'schedule',
  ) {
    if (actionBusy || sending) return
    const key =
      audience === 'members'
        ? memberCampaignKey || crypto.randomUUID()
        : waitlistCampaignKey || crypto.randomUUID()
    setActionBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience,
          campaignKey: key,
          name:
            audience === 'members' ? campaignName.trim() : waitlistName.trim(),
          kind: waitlistKind,
          subject:
            audience === 'members' ? subject.trim() : waitlistSubject.trim(),
          previewText:
            audience === 'members'
              ? previewText.trim()
              : waitlistPreview.trim(),
          heading:
            audience === 'members' ? heading.trim() : waitlistHeading.trim(),
          message:
            audience === 'members' ? message.trim() : waitlistMessage.trim(),
          ctaLabel:
            audience === 'members' ? ctaLabel.trim() : waitlistCtaLabel.trim(),
          ctaUrl:
            audience === 'members' ? ctaUrl.trim() : waitlistCtaUrl.trim(),
          sendEmail: audience === 'members' ? sendEmail : true,
          sendInApp: audience === 'members' ? sendInApp : false,
          targetGroup,
          selectedUserIds,
          selectedSubscriberIds: waitlistSelected ? selectedSubscriberIds : [],
          scheduleAt:
            action === 'schedule' && scheduleAt
              ? new Date(scheduleAt).toISOString()
              : null,
          action,
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not save campaign')
      if (audience === 'members') setMemberCampaignKey(key)
      else setWaitlistCampaignKey(key)
      setNotice(
        action === 'draft'
          ? 'Campaign draft saved.'
          : 'Campaign scheduled. It will start in batches after the scheduled time.',
      )
      await loadSummary(true)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save campaign',
      )
    } finally {
      setActionBusy(false)
    }
  }

  async function sendTest(audience: 'members' | 'waitlist') {
    if (actionBusy || sending) return
    const key =
      audience === 'members'
        ? memberCampaignKey || crypto.randomUUID()
        : waitlistCampaignKey || crypto.randomUUID()
    setActionBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/campaigns/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignKey: key,
          subject:
            audience === 'members' ? subject.trim() : waitlistSubject.trim(),
          previewText:
            audience === 'members'
              ? previewText.trim()
              : waitlistPreview.trim(),
          heading:
            audience === 'members' ? heading.trim() : waitlistHeading.trim(),
          message:
            audience === 'members' ? message.trim() : waitlistMessage.trim(),
          ctaLabel:
            audience === 'members' ? ctaLabel.trim() : waitlistCtaLabel.trim(),
          ctaUrl:
            audience === 'members' ? ctaUrl.trim() : waitlistCtaUrl.trim(),
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not send test email')
      if (audience === 'members') setMemberCampaignKey(key)
      else setWaitlistCampaignKey(key)
      setNotice(
        'Test preview accepted for delivery to your confirmed admin email address.',
      )
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message
          : 'Could not send test email',
      )
    } finally {
      setActionBusy(false)
    }
  }

  function loadCampaign(campaign: CampaignHistoryItem) {
    setMode(campaign.audience)
    setCampaignName(campaign.campaign_name || 'Food4Love update')
    setWaitlistName(campaign.campaign_name || 'Food4Love waitlist update')
    setSubject(campaign.subject)
    setWaitlistSubject(campaign.subject)
    setMessage(campaign.message)
    setWaitlistMessage(campaign.message)
    setPreviewText(campaign.preview_text || '')
    setWaitlistPreview(campaign.preview_text || '')
    setHeading(campaign.email_heading || '')
    setWaitlistHeading(campaign.email_heading || '')
    setCtaLabel(campaign.cta_label || '')
    setWaitlistCtaLabel(campaign.cta_label || '')
    setCtaUrl(campaign.cta_url || '')
    setWaitlistCtaUrl(campaign.cta_url || '')
    if (campaign.audience === 'members') {
      setTargetGroup(campaign.target_group || 'all')
      setSelectedUserIds(campaign.selected_user_ids || [])
      setMemberCampaignKey(campaign.campaign_key)
      setMemberRun(null)
    } else {
      setWaitlistKind(campaign.kind || 'launch')
      setSelectedSubscriberIds(campaign.selected_subscriber_ids || [])
      setWaitlistSelected(Boolean(campaign.selected_subscriber_ids?.length))
      setWaitlistCampaignKey(campaign.campaign_key)
      setWaitlistRun(null)
    }
    setNotice(`Loaded ${campaign.campaign_status} campaign for editing.`)
    if (campaign.audience === 'members') setMemberTemplate('custom')
    else setWaitlistTemplate('custom')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function applyMemberTemplate(key: keyof typeof memberTemplates) {
    const template = memberTemplates[key]
    setMemberTemplate(key)
    setSubject(template.subject)
    setPreviewText(template.preview)
    setHeading(template.heading)
    setMessage(template.message)
  }

  function applyWaitlistTemplate(key: keyof typeof waitlistTemplates) {
    const template = waitlistTemplates[key]
    setWaitlistTemplate(key)
    setWaitlistSubject(template.subject)
    setWaitlistPreview(template.preview)
    setWaitlistHeading(template.heading)
    setWaitlistMessage(template.message)
  }

  const memberLocked = Boolean(memberRun)
  const waitlistLocked = Boolean(waitlistRun)
  const memberPreview = message
    .replace(/\{\{\s*first_name\s*\}\}/gi, 'Tola')
    .replace(/\{\{\s*account_type\s*\}\}/gi, 'cook')
    .replace(/\{\{\s*email\s*\}\}/gi, 'tola@example.com')
  const waitlistPreviewMessage = waitlistMessage
    .replace(/\{\{\s*account_type\s*\}\}/gi, 'food lover')
    .replace(/\{\{\s*email\s*\}\}/gi, 'hello@example.com')

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
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-800"
        >
          {notice}
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
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Template</span>
            <select
              value={memberTemplate}
              disabled={memberLocked || sending}
              onChange={(event) =>
                applyMemberTemplate(
                  event.target.value as keyof typeof memberTemplates,
                )
              }
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
            >
              <option value="product">Product announcement</option>
              <option value="cook">Cook community update</option>
              <option value="custom">Custom message</option>
            </select>
            <p className="text-xs text-[var(--text-3)]">
              Existing tester invitation emails stay in the secure invitation
              flow so their one-time links remain valid.
            </p>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Campaign name</span>
            <input
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              maxLength={100}
              disabled={memberLocked || sending}
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Recipients</span>
            <select
              value={targetGroup}
              disabled={memberLocked || sending}
              onChange={(event) =>
                setTargetGroup(event.target.value as CampaignRun['targetGroup'])
              }
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
            >
              <option value="all">All active customers and cooks</option>
              <option value="buyers">Customers only</option>
              <option value="cooks">Cooks only</option>
              <option value="testers">Accepted testers</option>
              <option value="selected">Select individual members</option>
            </select>
            <p className="text-xs text-[var(--text-3)]">
              Marketing email is delivered only to opted-in members with
              confirmed email. In-app delivery can include all selected active
              accounts.
            </p>
          </label>
          {targetGroup === 'selected' && (
            <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
              <input
                aria-label="Search members"
                value={recipientSearch}
                onChange={(event) => setRecipientSearch(event.target.value)}
                placeholder="Search members by name"
                className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
              />
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {recipientOptions.map((recipient) => (
                  <label
                    key={recipient.id}
                    className="flex cursor-pointer items-start gap-2 rounded-md p-2 text-xs hover:bg-[var(--bg-2)]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(recipient.id)}
                      disabled={memberLocked || sending}
                      onChange={(event) =>
                        setSelectedUserIds((ids) =>
                          event.target.checked
                            ? Array.from(new Set([...ids, recipient.id]))
                            : ids.filter((id) => id !== recipient.id),
                        )
                      }
                    />
                    <span>
                      <span className="block font-semibold">
                        {recipient.label}
                      </span>
                      <span className="text-[var(--text-3)]">
                        {recipient.detail}
                      </span>
                    </span>
                  </label>
                ))}
                {recipientOptions.length === 0 && (
                  <p className="p-2 text-xs text-[var(--text-3)]">
                    No matching members.
                  </p>
                )}
              </div>
              <p className="text-xs font-semibold">
                {selectedUserIds.length} member
                {selectedUserIds.length === 1 ? '' : 's'} selected
              </p>
            </div>
          )}
          <div className="rounded-lg bg-[var(--bg-2)] p-3 text-xs leading-5 text-[var(--text-2)]">
            In-app announcements go to all active buyer and cook accounts. Email
            is limited to members who opted in and have a confirmed address.
            Their email addresses are never sent to the browser.
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Email heading</span>
            <input
              maxLength={140}
              value={memberRun?.heading ?? heading}
              disabled={memberLocked || sending}
              onChange={(event) => setHeading(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Preview text</span>
            <input
              maxLength={180}
              value={memberRun?.previewText ?? previewText}
              disabled={memberLocked || sending}
              onChange={(event) => setPreviewText(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
            />
          </label>
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
          <p className="text-xs text-[var(--text-3)]">
            Member variables available: {'{{first_name}}'}, {'{{email}}'},{' '}
            {'{{account_type}}'}.
          </p>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-2)] p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--text-3)]">
              Email preview · sample cook
            </p>
            <p className="text-xs text-[var(--text-3)]">Subject: {subject}</p>
            <h3 className="mt-2 font-bold">{heading || subject}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">{memberPreview}</p>
            {ctaLabel && ctaUrl && (
              <span className="mt-3 inline-flex rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white">
                {ctaLabel}
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">
                Button label (optional)
              </span>
              <input
                maxLength={40}
                value={memberRun?.ctaLabel ?? ctaLabel}
                disabled={memberLocked || sending}
                onChange={(event) => setCtaLabel(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Button HTTPS link</span>
              <input
                type="url"
                maxLength={500}
                value={memberRun?.ctaUrl ?? ctaUrl}
                disabled={memberLocked || sending}
                onChange={(event) => setCtaUrl(event.target.value)}
                placeholder="https://food4love.app"
                className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
              />
            </label>
          </div>
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
              (!sendEmail && !sendInApp) ||
              (targetGroup === 'selected' && selectedUserIds.length === 0)
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
          <div className="grid gap-2 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[1fr_auto_auto]">
            <input
              aria-label="Schedule campaign date and time"
              type="datetime-local"
              value={scheduleAt}
              onChange={(event) => setScheduleAt(event.target.value)}
              min={new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)}
              className="min-h-10 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-xs"
            />
            <button
              type="button"
              disabled={actionBusy || sending || memberLocked}
              onClick={() => void saveCampaign('members', 'draft')}
              className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={actionBusy || sending || memberLocked || !scheduleAt}
              onClick={() => void saveCampaign('members', 'schedule')}
              className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold disabled:opacity-50"
            >
              Schedule
            </button>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Scheduled campaigns are picked up by the daily delivery worker after
            the selected time.
          </p>
          <button
            type="button"
            disabled={actionBusy || sending || !summary?.email_configured}
            onClick={() => void sendTest('members')}
            className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold disabled:opacity-50"
          >
            Send test to my admin email
          </button>
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
            <span className="text-sm font-semibold">Template</span>
            <select
              value={waitlistTemplate}
              disabled={waitlistLocked || sending}
              onChange={(event) =>
                applyWaitlistTemplate(
                  event.target.value as keyof typeof waitlistTemplates,
                )
              }
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
            >
              <option value="launch">Waitlist launch update</option>
              <option value="community">Waitlist community note</option>
              <option value="custom">Custom message</option>
            </select>
          </label>
          <label className="flex items-start gap-2 text-xs text-[var(--text-2)]">
            <input
              type="checkbox"
              checked={waitlistSelected}
              disabled={waitlistLocked || sending}
              onChange={(event) => setWaitlistSelected(event.target.checked)}
              className="mt-0.5"
            />
            <span>Send to selected subscribers only</span>
          </label>
          {waitlistSelected && (
            <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
              <input
                aria-label="Search waitlist subscribers"
                value={waitlistSearch}
                onChange={(event) => setWaitlistSearch(event.target.value)}
                placeholder="Search opted-in waitlist emails"
                className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
              />
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {waitlistOptions.map((recipient) => (
                  <label
                    key={recipient.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-xs hover:bg-[var(--bg-2)]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSubscriberIds.includes(recipient.id)}
                      disabled={waitlistLocked || sending}
                      onChange={(event) =>
                        setSelectedSubscriberIds((ids) =>
                          event.target.checked
                            ? Array.from(new Set([...ids, recipient.id]))
                            : ids.filter((id) => id !== recipient.id),
                        )
                      }
                    />
                    <span>{recipient.label}</span>
                    <span className="ml-auto capitalize text-[var(--text-3)]">
                      {recipient.detail}
                    </span>
                  </label>
                ))}
                {waitlistOptions.length === 0 && (
                  <p className="p-2 text-xs text-[var(--text-3)]">
                    No opted-in subscribers found.
                  </p>
                )}
              </div>
              <p className="text-xs font-semibold">
                {selectedSubscriberIds.length} subscriber
                {selectedSubscriberIds.length === 1 ? '' : 's'} selected
              </p>
            </div>
          )}
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Campaign name</span>
            <input
              value={waitlistName}
              onChange={(event) => setWaitlistName(event.target.value)}
              maxLength={100}
              disabled={waitlistLocked || sending}
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
            />
          </label>
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
            <span className="text-sm font-semibold">Email heading</span>
            <input
              maxLength={140}
              value={waitlistRun?.heading ?? waitlistHeading}
              disabled={waitlistLocked || sending}
              onChange={(event) => setWaitlistHeading(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Preview text</span>
            <input
              maxLength={180}
              value={waitlistRun?.previewText ?? waitlistPreview}
              disabled={waitlistLocked || sending}
              onChange={(event) => setWaitlistPreview(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
            />
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
          <p className="text-xs text-[var(--text-3)]">
            Waitlist variables available: {'{{email}}'}, {'{{account_type}}'}.
          </p>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-2)] p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--text-3)]">
              Email preview · sample waitlist member
            </p>
            <p className="text-xs text-[var(--text-3)]">
              Subject: {waitlistSubject}
            </p>
            <h3 className="mt-2 font-bold">
              {waitlistHeading || waitlistSubject}
            </h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {waitlistPreviewMessage}
            </p>
            {waitlistCtaLabel && waitlistCtaUrl && (
              <span className="mt-3 inline-flex rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white">
                {waitlistCtaLabel}
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">
                Button label (optional)
              </span>
              <input
                maxLength={40}
                value={waitlistRun?.ctaLabel ?? waitlistCtaLabel}
                disabled={waitlistLocked || sending}
                onChange={(event) => setWaitlistCtaLabel(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">Button HTTPS link</span>
              <input
                type="url"
                maxLength={500}
                value={waitlistRun?.ctaUrl ?? waitlistCtaUrl}
                disabled={waitlistLocked || sending}
                onChange={(event) => setWaitlistCtaUrl(event.target.value)}
                placeholder="https://food4love.app"
                className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
              />
            </label>
          </div>
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
              (!waitlistRun && !waitlistAcknowledged) ||
              (waitlistSelected && selectedSubscriberIds.length === 0)
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
          <div className="grid gap-2 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[1fr_auto_auto]">
            <input
              aria-label="Schedule waitlist campaign date and time"
              type="datetime-local"
              value={scheduleAt}
              onChange={(event) => setScheduleAt(event.target.value)}
              min={new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)}
              className="min-h-10 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-xs"
            />
            <button
              type="button"
              disabled={actionBusy || sending || waitlistLocked}
              onClick={() => void saveCampaign('waitlist', 'draft')}
              className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={actionBusy || sending || waitlistLocked || !scheduleAt}
              onClick={() => void saveCampaign('waitlist', 'schedule')}
              className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold disabled:opacity-50"
            >
              Schedule
            </button>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Scheduled campaigns are picked up by the daily delivery worker after
            the selected time.
          </p>
          <button
            type="button"
            disabled={
              actionBusy || sending || !waitlistSummary?.email_configured
            }
            onClick={() => void sendTest('waitlist')}
            className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold disabled:opacity-50"
          >
            Send test to my admin email
          </button>
        </form>
      )}

      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">Campaign history</h2>
            <p className="text-xs text-[var(--text-3)]">
              Drafts, scheduled sends and completed campaigns from the existing
              email records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSummary(true)}
            className="text-xs font-semibold text-[var(--accent)]"
          >
            Refresh
          </button>
        </div>
        {campaigns.length ? (
          <div className="divide-y divide-[var(--border)]">
            {campaigns.map((campaign) => (
              <article
                key={`${campaign.audience}:${campaign.campaign_key}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {campaign.campaign_name || campaign.subject}
                  </p>
                  <p className="truncate text-xs text-[var(--text-3)]">
                    {campaign.subject} ·{' '}
                    {campaign.audience === 'waitlist'
                      ? 'Waitlist'
                      : campaign.target_group || 'Members'}{' '}
                    · {campaign.campaign_status}
                    {campaign.scheduled_at
                      ? ` · ${new Date(campaign.scheduled_at).toLocaleString()}`
                      : ''}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-3)]">
                    {campaign.stats?.recipients ?? 0} recipients ·{' '}
                    {campaign.stats?.accepted ?? 0} accepted by provider ·{' '}
                    {campaign.stats?.delivered ?? 0} delivered ·{' '}
                    {campaign.stats?.bounced ?? 0} bounced ·{' '}
                    {campaign.stats?.failed ?? 0} failed ·{' '}
                    {campaign.stats?.queued ?? 0} queued
                    {campaign.stats?.skipped
                      ? ` · ${campaign.stats.skipped} skipped`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={
                    !['draft', 'scheduled'].includes(campaign.campaign_status)
                  }
                  onClick={() => loadCampaign(campaign)}
                  className="min-h-9 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Edit draft
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-[var(--bg-2)] p-4 text-sm text-[var(--text-3)]">
            No campaigns saved yet.
          </p>
        )}
        <p className="text-[11px] text-[var(--text-3)]">
          “Accepted” means Resend accepted the request; delivery status comes
          from its signed webhook. Open and click tracking are not enabled, so
          no engagement counts are displayed.
        </p>
      </section>

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
