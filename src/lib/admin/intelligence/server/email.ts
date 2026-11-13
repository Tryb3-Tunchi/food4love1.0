import 'server-only'
import { maskEmail } from '../privacy'
import { fetchRows, headCount, type Admin } from './core'

export const MAX_EMAIL_ATTEMPTS = 5
const DAY = 24 * 3600 * 1000

interface DeliveryRow {
  id: string
  kind: string
  status: string
  attempts: number
  recipient_key: string
  last_error_code: string | null
  updated_at: string
  created_at: string
}

const has = (name: string) => Boolean(process.env[name]?.trim())

export async function getEmailOps(admin: Admin) {
  // Names and yes/no only. Values (API keys, addresses) are never returned.
  const config = [
    {
      name: 'RESEND_API_KEY',
      set: has('RESEND_API_KEY'),
      purpose: 'Sends all email',
    },
    {
      name: 'RESEND_FROM_EMAIL',
      set: has('RESEND_FROM_EMAIL'),
      purpose: 'Default sender',
    },
    {
      name: 'WAITLIST_CONFIRMATION_FROM_EMAIL',
      set: has('WAITLIST_CONFIRMATION_FROM_EMAIL'),
      purpose: 'Waitlist confirmation sender',
    },
    {
      name: 'WELCOME_FROM_EMAIL',
      set: has('WELCOME_FROM_EMAIL'),
      purpose: 'Welcome email sender',
    },
    {
      name: 'RESEND_WEBHOOK_SECRET',
      set: has('RESEND_WEBHOOK_SECRET'),
      purpose: 'Lets Resend report bounces and complaints',
    },
  ]
  const welcomeEnabled = process.env.WELCOME_EMAIL_ENABLED !== 'false'

  let tracking = true
  let deliveries: DeliveryRow[] = []
  try {
    deliveries = (
      await fetchRows<DeliveryRow>(
        admin,
        'email_deliveries',
        'id, kind, status, attempts, recipient_key, last_error_code, updated_at, created_at',
        { column: 'updated_at', cap: 5000 },
      )
    ).rows
  } catch {
    tracking = false
  }

  const kinds = ['waitlist_confirmation', 'welcome'] as const
  const statuses = [
    'queued',
    'accepted',
    'delivered',
    'bounced',
    'failed',
  ] as const
  const byKind = kinds.map((kind) => {
    const mine = deliveries.filter((d) => d.kind === kind)
    return {
      kind,
      total: mine.length,
      ...Object.fromEntries(
        statuses.map((s) => [s, mine.filter((d) => d.status === s).length]),
      ),
    }
  })

  const retryable = deliveries.filter(
    (d) =>
      (d.status === 'failed' || d.status === 'queued') &&
      d.attempts < MAX_EMAIL_ATTEMPTS,
  ).length

  const failures = deliveries
    .filter((d) => d.status === 'failed' || d.status === 'bounced')
    .slice(0, 25)
  // Recipients appear only as a masked address, resolved from the waitlist.
  const waitlistIds = failures
    .filter((f) => f.kind === 'waitlist_confirmation')
    .map((f) => f.recipient_key)
  const emailById = new Map<string, string>()
  if (waitlistIds.length) {
    const { data } = await admin
      .from('waitlist_subscribers')
      .select('id, email')
      .in('id', waitlistIds)
    ;(data ?? []).forEach((r) => emailById.set(r.id, r.email))
  }

  const [waitlistTotal, waitlistConfirmed] = await Promise.all([
    headCount(admin, 'waitlist_subscribers').catch(() => null),
    headCount(admin, 'waitlist_subscribers', {
      apply: (q) => q.not('confirmation_sent_at', 'is', null),
    }).catch(() => null),
  ])

  // Bounces and complaints arrive from Resend by webhook.
  let events:
    | { available: true; counts: { type: string; count: number }[] }
    | { available: false } = { available: false }
  try {
    const rows = await fetchRows<{ event_type: string }>(
      admin,
      'email_events',
      'event_type, created_at',
      { from: new Date(Date.now() - 30 * DAY).toISOString(), cap: 20000 },
    )
    const map = new Map<string, number>()
    rows.rows.forEach((r) =>
      map.set(r.event_type, (map.get(r.event_type) ?? 0) + 1),
    )
    events = {
      available: true,
      counts: Array.from(map, ([type, count]) => ({ type, count })).sort(
        (a, b) => b.count - a.count,
      ),
    }
  } catch {
    events = { available: false }
  }

  // Campaign emails keep their own delivery tables.
  const tally = async (table: string, column: string) => {
    try {
      const rows = await fetchRows<Record<string, string>>(
        admin,
        table,
        `${column}, created_at`,
        {
          cap: 20000,
        },
      )
      const map = new Map<string, number>()
      rows.rows.forEach((r) =>
        map.set(
          r[column] ?? 'unknown',
          (map.get(r[column] ?? 'unknown') ?? 0) + 1,
        ),
      )
      return Array.from(map, ([key, count]) => ({ key, count }))
    } catch {
      return null
    }
  }
  const [waitlistCampaigns, announcements] = await Promise.all([
    tally('waitlist_email_deliveries', 'status'),
    tally('admin_announcement_deliveries', 'email_status'),
  ])

  return {
    config,
    welcomeEnabled,
    tracking,
    byKind,
    retryable,
    failures: failures.map((f) => ({
      id: f.id,
      kind: f.kind,
      status: f.status,
      attempts: f.attempts,
      errorCode: f.last_error_code,
      updatedAt: f.updated_at,
      recipient: emailById.has(f.recipient_key)
        ? maskEmail(emailById.get(f.recipient_key))
        : `member ${f.recipient_key.slice(0, 8)}…`,
    })),
    waitlistCoverage: {
      total: waitlistTotal,
      confirmationRecorded: waitlistConfirmed,
    },
    events,
    campaigns: { waitlist: waitlistCampaigns, announcements },
    maxAttempts: MAX_EMAIL_ATTEMPTS,
    note: 'A message accepted by Resend is not the same as delivered to an inbox. Delivered, bounced and complaint states appear only after the Resend webhook is connected.',
    generatedAt: new Date().toISOString(),
  }
}
