import 'server-only'
import { resolveRange } from '../dateRange'
import { normalizeEmailForDuplicates } from '../privacy'
import {
  DataError,
  ROW_CAP,
  fetchRows,
  headCount,
  type Admin,
  type AnyQuery,
} from './core'

export interface WaitlistFilters {
  q?: string
  consent?: 'yes' | 'no'
  confirmed?: 'yes' | 'no'
  status?: 'active' | 'unsubscribed'
  from?: string // ISO
  to?: string // ISO
}

export interface WaitlistRow {
  id: string
  email: string
  audience: string | null
  source: string | null
  updates_consent: boolean | null
  consent_at: string | null
  created_at: string
  confirmation_sent_at: string | null
  unsubscribed_at: string | null
}

const COLUMNS =
  'id, email, audience, source, updates_consent, consent_at, created_at, confirmation_sent_at, unsubscribed_at'

// The ONLY columns ever read. The unsubscribe token is deliberately absent.
export function applyWaitlistFilters(q: AnyQuery, f: WaitlistFilters) {
  if (f.q) {
    // Strip characters that have meaning inside a PostgREST filter string.
    const safe = f.q
      .replace(/[%_,()*\\]/g, ' ')
      .trim()
      .slice(0, 80)
    if (safe) q = q.ilike('email', `%${safe}%`)
  }
  if (f.consent === 'yes') q = q.eq('updates_consent', true)
  if (f.consent === 'no') q = q.eq('updates_consent', false)
  if (f.confirmed === 'yes') q = q.not('confirmation_sent_at', 'is', null)
  if (f.confirmed === 'no') q = q.is('confirmation_sent_at', null)
  if (f.status === 'unsubscribed') q = q.not('unsubscribed_at', 'is', null)
  if (f.status === 'active') q = q.is('unsubscribed_at', null)
  if (f.from) q = q.gte('created_at', f.from)
  if (f.to) q = q.lt('created_at', f.to)
  return q
}

// Reads the filters from a request, accepting only known values.
export function filtersFromParams(search: URLSearchParams): WaitlistFilters {
  const pick = <T extends string>(name: string, allowed: readonly T[]) => {
    const value = search.get(name)
    return allowed.includes(value as T) ? (value as T) : undefined
  }
  const filters: WaitlistFilters = {
    q: search.get('q')?.trim().slice(0, 80) || undefined,
    consent: pick('consent', ['yes', 'no'] as const),
    confirmed: pick('confirmed', ['yes', 'no'] as const),
    status: pick('status', ['active', 'unsubscribed'] as const),
  }
  if (search.get('range')) {
    const range = resolveRange({
      range: search.get('range'),
      from: search.get('from'),
      to: search.get('to'),
    })
    filters.from = range.from
    filters.to = range.to
  }
  return filters
}

export async function getWaitlist(
  admin: Admin,
  filters: WaitlistFilters,
  page: number,
  pageSize: number,
) {
  const offset = (page - 1) * pageSize
  const listQuery: AnyQuery = applyWaitlistFilters(
    admin.from('waitlist_subscribers').select(COLUMNS, { count: 'exact' }),
    filters,
  )
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)
  const { data, count, error } = await listQuery
  if (error) throw new DataError('query_failed')
  const rows = (data ?? []) as WaitlistRow[]

  const today = resolveRange({ range: 'today' })
  const week = resolveRange({ range: '7d' })
  const month = resolveRange({ range: '30d' })
  const [
    total,
    newToday,
    newWeek,
    newMonth,
    consented,
    confirmed,
    unsub,
    cooks,
    all,
  ] = await Promise.all([
    headCount(admin, 'waitlist_subscribers'),
    headCount(admin, 'waitlist_subscribers', {
      from: today.from,
      to: today.to,
    }),
    headCount(admin, 'waitlist_subscribers', { from: week.from, to: week.to }),
    headCount(admin, 'waitlist_subscribers', {
      from: month.from,
      to: month.to,
    }),
    headCount(admin, 'waitlist_subscribers', {
      apply: (q) => q.eq('updates_consent', true),
    }),
    headCount(admin, 'waitlist_subscribers', {
      apply: (q) => q.not('confirmation_sent_at', 'is', null),
    }),
    headCount(admin, 'waitlist_subscribers', {
      apply: (q) => q.not('unsubscribed_at', 'is', null),
    }),
    headCount(admin, 'waitlist_subscribers', {
      apply: (q) => q.eq('audience', 'cook'),
    }),
    fetchRows<{ id: string; email: string; created_at: string }>(
      admin,
      'waitlist_subscribers',
      'id, email, created_at',
      { cap: ROW_CAP },
    ),
  ])

  // Duplicates: the same real inbox written differently (dots, +tags, case).
  const groups = new Map<string, string[]>()
  all.rows.forEach((r) => {
    const key = normalizeEmailForDuplicates(r.email)
    groups.set(key, [...(groups.get(key) ?? []), r.id])
  })
  const duplicateIds = new Set<string>()
  let duplicateGroups = 0
  groups.forEach((ids) => {
    if (ids.length > 1) {
      duplicateGroups += 1
      ids.forEach((id) => duplicateIds.add(id))
    }
  })

  // Did the confirmation email actually go out? (Only if tracking exists.)
  let delivery = new Map<string, { status: string; attempts: number }>()
  let deliveryTracked = true
  if (rows.length) {
    const { data: tracked, error: trackError } = await admin
      .from('email_deliveries')
      .select('recipient_key, status, attempts')
      .eq('kind', 'waitlist_confirmation')
      .in(
        'recipient_key',
        rows.map((r) => r.id),
      )
    if (trackError) deliveryTracked = false
    else {
      delivery = new Map(
        (tracked ?? []).map((t) => [
          t.recipient_key,
          { status: t.status, attempts: t.attempts },
        ]),
      )
    }
  }
  let failedConfirmations: number | null = null
  try {
    failedConfirmations = await headCount(admin, 'email_deliveries', {
      apply: (q) =>
        q
          .eq('kind', 'waitlist_confirmation')
          .in('status', ['failed', 'bounced']),
    })
  } catch {
    failedConfirmations = null
  }

  return {
    rows: rows.map((r) => ({
      id: r.id,
      email: r.email,
      audience: r.audience,
      source: r.source,
      marketingConsent: r.updates_consent === true,
      consentAt: r.consent_at,
      joinedAt: r.created_at,
      confirmationSent: Boolean(r.confirmation_sent_at),
      unsubscribed: Boolean(r.unsubscribed_at),
      duplicate: duplicateIds.has(r.id),
      delivery: deliveryTracked
        ? (delivery.get(r.id)?.status ?? 'not tracked')
        : null,
    })),
    total: count ?? 0,
    page,
    pageSize,
    stats: {
      total,
      newToday,
      newWeek,
      newMonth,
      marketingConsent: consented,
      noConsent: total - consented,
      confirmationSent: confirmed,
      confirmationNotSent: total - confirmed,
      unsubscribed: unsub,
      cooks,
      foodLovers: total - cooks,
      duplicateGroups,
      duplicateRecords: duplicateIds.size,
      failedConfirmations,
      deliveryTracked,
    },
    notes: {
      account:
        'Joining the waitlist is not an account. These people have only shared an email address.',
      location:
        'The waitlist form does not ask where someone is, so location is not stored per person. See Geography for the country mix of visitors who joined.',
      source:
        'The “source” column is only filled when the signup form records it; it is empty for most entries.',
    },
    generatedAt: new Date().toISOString(),
  }
}

// For the CSV export: same filters, bounded rows, no tokens.
export async function exportWaitlistRows(
  admin: Admin,
  filters: WaitlistFilters,
  limit = ROW_CAP,
) {
  const q: AnyQuery = applyWaitlistFilters(
    admin.from('waitlist_subscribers').select(COLUMNS),
    filters,
  )
    .order('created_at', { ascending: false })
    .limit(limit)
  const { data, error } = await q
  if (error) throw new DataError('query_failed')
  return (data ?? []) as WaitlistRow[]
}
