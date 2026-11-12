import 'server-only'
import { resolveRange, type ResolvedRange } from '../dateRange'
import { bucketDistinct, okMetric, unavailable, type Metric } from '../series'
import {
  countSeries,
  distinctCount,
  fetchRows,
  firstMessageTimes,
  flowMetric,
  headCount,
  metric,
  realUsers,
  topCounts,
  type Admin,
  type AnyQuery,
} from './core'

const DAY = 24 * 3600 * 1000

// ---------------------------------------------------------- Cooks & chefs
export async function getCooks(admin: Admin, range: ResolvedRange) {
  const metrics: Record<string, Metric> = {}
  const tasks: Promise<void>[] = []
  const set = (key: string, build: () => Promise<Metric>) =>
    tasks.push(metric(build).then((m) => void (metrics[key] = m)))
  const cooks = (q: AnyQuery) => realUsers(q.eq('role', 'cook'))

  set('totalCooks', async () =>
    flowMetric(await countSeries(admin, 'profiles', range, cooks)),
  )
  set('verifiedCooks', async () =>
    okMetric(
      await headCount(admin, 'profiles', {
        apply: (q) => cooks(q.eq('is_verified', true)),
      }),
      null,
      [],
      'Cook accounts whose verification has been approved.',
    ),
  )
  set('pendingVerification', async () =>
    okMetric(
      await headCount(admin, 'kyc_submissions', {
        apply: (q) => q.eq('status', 'pending'),
      }),
      null,
      [],
      'Waiting for review on the Chef verification page.',
    ),
  )
  set('suspendedCooks', async () =>
    okMetric(
      await headCount(admin, 'profiles', {
        apply: (q) => cooks(q.eq('suspended', true)),
      }),
      null,
      [],
    ),
  )
  set('professionalChefs', async () =>
    unavailable(
      'Food4Love does not store a separate “professional chef” type yet, so professional chefs cannot be counted apart from cooks.',
    ),
  )
  set('bookingRequests', async () =>
    flowMetric(await countSeries(admin, 'bookings', range)),
  )

  // Bookings by their real status values, whatever the app uses.
  let bookingStatuses: { key: string; count: number }[] = []
  let activeCooks: Metric = unavailable(
    'This figure could not be read right now.',
  )
  try {
    const [bookings, specials] = await Promise.all([
      fetchRows<{
        status: string | null
        cook_id: string | null
        created_at: string
      }>(admin, 'bookings', 'status, cook_id, created_at', {
        from: range.from,
        to: range.to,
      }),
      fetchRows<{ cook_id: string | null; created_at: string }>(
        admin,
        'daily_specials',
        'cook_id, created_at',
        { from: range.from, to: range.to },
      ),
    ])
    bookingStatuses = topCounts(
      bookings.rows.map((b) => b.status),
      12,
      'unknown',
    )
    activeCooks = okMetric(
      distinctCount([
        ...bookings.rows.map((b) => b.cook_id),
        ...specials.rows.map((s) => s.cook_id),
      ]),
      null,
      bucketDistinct(
        [
          ...bookings.rows.flatMap((b) =>
            b.cook_id ? [{ t: b.created_at, id: b.cook_id }] : [],
          ),
          ...specials.rows.flatMap((s) =>
            s.cook_id ? [{ t: s.created_at, id: s.cook_id }] : [],
          ),
        ],
        range,
      ),
      'Cooks who received a booking or published a meal special in this period.',
    )
  } catch {
    // leave the honest "unavailable" card in place
  }
  metrics.activeCooks = activeCooks

  // Reports against cook profiles (counts only; details live in Reports).
  set('reportedCooks', async () => {
    const [cookIds, reports] = await Promise.all([
      fetchRows<{ id: string }>(admin, 'profiles', 'id, created_at', {
        apply: cooks,
        cap: 5000,
      }),
      fetchRows<{ target_id: string; status: string }>(
        admin,
        'reports',
        'target_id, status, created_at',
        {
          apply: (q) => q.eq('target_type', 'profile'),
          cap: 5000,
        },
      ),
    ])
    const set = new Set(cookIds.rows.map((c) => c.id))
    const mine = reports.rows.filter((r) => set.has(r.target_id))
    return okMetric(
      distinctCount(mine.map((r) => r.target_id)),
      null,
      [],
      `${mine.filter((r) => r.status === 'open' || r.status === 'reviewing').length} reports still open.`,
    )
  })

  await Promise.all(tasks)

  // Where cooks say they are: only shown when at least 3 cooks share a value.
  const where = await fetchRows<{ location: string | null }>(
    admin,
    'profiles',
    'location, created_at',
    { apply: cooks, cap: 5000 },
  ).catch(() => null)
  const locations = where
    ? topCounts(
        where.rows.map((r) => r.location?.trim().toLowerCase() || null),
        50,
        '',
      )
        .filter((x) => x.key && x.count >= 3)
        .slice(0, 12)
    : []

  return {
    range,
    metrics,
    bookingStatuses,
    locations,
    actions: [
      { label: 'Review cook accounts', href: '/admin/users?role=cook' },
      { label: 'Verification submissions', href: '/admin/kyc' },
      { label: 'Reports and moderation', href: '/admin/reports' },
      { label: 'Booking activity', href: '/admin/bookings' },
    ],
    generatedAt: new Date().toISOString(),
  }
}

// ------------------------------------------------ Matches and conversations
export async function getConversations(admin: Admin, range: ResolvedRange) {
  const metrics: Record<string, Metric> = {}
  const tasks: Promise<void>[] = []
  const set = (key: string, build: () => Promise<Metric>) =>
    tasks.push(metric(build).then((m) => void (metrics[key] = m)))

  const today = resolveRange({ range: 'today' })
  const week = resolveRange({ range: '7d' })

  set('totalMatches', async () =>
    flowMetric(await countSeries(admin, 'matches', range)),
  )
  set('activeMatches', async () =>
    okMetric(
      await headCount(admin, 'matches', {
        apply: (q) => q.eq('status', 'matched'),
      }),
      null,
      [],
      'Matches that are currently open for chat.',
    ),
  )
  set('matchesToday', async () =>
    flowMetric(await countSeries(admin, 'matches', today)),
  )
  set('matchesWeek', async () =>
    flowMetric(await countSeries(admin, 'matches', week)),
  )
  set('messagesToday', async () =>
    flowMetric(await countSeries(admin, 'messages', today)),
  )
  set('newConversations', async () => {
    const { first, truncated } = await firstMessageTimes(admin)
    const rows = Array.from(first).filter(
      ([, t]) => t >= range.from && t < range.to,
    )
    const before = Array.from(first).filter(
      ([, t]) => t >= range.prevFrom && t < range.prevTo,
    )
    return okMetric(
      rows.length,
      before.length,
      bucketDistinct(
        rows.map(([id, t]) => ({ id, t })),
        range,
      ),
      truncated
        ? 'Very large history: older conversations may be missing.'
        : undefined,
      first.size,
    )
  })
  set('activeConversations', async () => {
    const since = new Date(Date.now() - 7 * DAY).toISOString()
    const rows = await fetchRows<{ match_id: string }>(
      admin,
      'messages',
      'match_id, created_at',
      {
        from: since,
      },
    )
    return okMetric(
      distinctCount(rows.rows.map((r) => r.match_id)),
      null,
      [],
      'Conversations with a message in the last 7 days.',
    )
  })
  set('unreadNotifications', async () =>
    okMetric(
      await headCount(admin, 'notifications', {
        apply: (q) => q.eq('read', false),
      }),
      null,
      [],
      'Notifications members have not opened yet.',
      await headCount(admin, 'notifications'),
    ),
  )
  set('failedMessageOperations', async () =>
    unavailable(
      'Failed sends are not recorded on the server yet: a failed message never reaches the database. The chat shows the member a Retry button instead.',
    ),
  )

  await Promise.all(tasks)

  // "Is data still being written?" — the last time each pipeline stored something.
  const latest = async (table: string) => {
    try {
      const { data, error } = await admin
        .from(table)
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) return null
      return data?.[0]?.created_at ?? null
    } catch {
      return null
    }
  }
  const [lastMessage, lastMatch, lastNotification] = await Promise.all([
    latest('messages'),
    latest('matches'),
    latest('notifications'),
  ])
  const dbErrors = await headCount(admin, 'ops_events', {
    from: new Date(Date.now() - DAY).toISOString(),
    apply: (q) => q.in('severity', ['error', 'critical']),
  }).catch(() => null)

  return {
    range,
    metrics,
    diagnostics: {
      lastMessageAt: lastMessage,
      lastMatchAt: lastMatch,
      lastNotificationAt: lastNotification,
      errorsLast24h: dbErrors,
    },
    privacyNote:
      'This page only counts activity. Message text is never read or shown here.',
    generatedAt: new Date().toISOString(),
  }
}
