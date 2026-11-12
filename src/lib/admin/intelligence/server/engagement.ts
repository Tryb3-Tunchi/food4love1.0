import 'server-only'
import { startOfAdminDay, type ResolvedRange } from '../dateRange'
import { computeRetention } from '../retention'
import {
  bucketDistinct,
  buildFunnel,
  okMetric,
  ratePercent,
  unavailable,
  type Metric,
} from '../series'
import {
  countSeries,
  distinctCount,
  fetchRows,
  firstMessageTimes,
  flowMetric,
  headCount,
  metric,
  realUsers,
  type Admin,
} from './core'

const DAY = 24 * 3600 * 1000

interface SwipeRow {
  swiper_id: string
  action: string
  created_at: string
}
interface MessageRow {
  sender_id: string
  match_id: string
  created_at: string
}
interface BookingRow {
  buyer_id: string | null
  cook_id: string | null
  status: string | null
  created_at: string
}
interface MatchRow {
  user1_id: string
  user2_id: string
  created_at: string
}

export async function getEngagement(admin: Admin, range: ResolvedRange) {
  const metrics: Record<string, Metric> = {}
  const tasks: Promise<void>[] = []
  const set = (key: string, build: () => Promise<Metric>, reason?: string) =>
    tasks.push(metric(build, reason).then((m) => void (metrics[key] = m)))

  const [swipes, messages, bookings] = await Promise.all([
    fetchRows<SwipeRow>(admin, 'swipes', 'swiper_id, action, created_at', {
      from: range.from,
      to: range.to,
    }).catch(() => null),
    fetchRows<MessageRow>(
      admin,
      'messages',
      'sender_id, match_id, created_at',
      {
        from: range.from,
        to: range.to,
      },
    ).catch(() => null),
    fetchRows<BookingRow>(
      admin,
      'bookings',
      'buyer_id, cook_id, status, created_at',
      { from: range.from, to: range.to },
    ).catch(() => null),
  ])

  // Anyone who swiped, messaged or booked counts as active in that period.
  const actors = [
    ...(swipes?.rows ?? []).map((r) => ({ t: r.created_at, id: r.swiper_id })),
    ...(messages?.rows ?? []).map((r) => ({
      t: r.created_at,
      id: r.sender_id,
    })),
    ...(bookings?.rows ?? []).flatMap((r) =>
      r.buyer_id ? [{ t: r.created_at, id: r.buyer_id }] : [],
    ),
  ]
  set('activeMembers', async () =>
    okMetric(
      distinctCount(actors.map((a) => a.id)),
      null,
      bucketDistinct(actors, range),
      'Members who swiped, sent a message or made a booking.',
    ),
  )

  // DAU / WAU / MAU as of now.
  set('dau', async () => activeWithin(admin, 1))
  set('wau', async () => activeWithin(admin, 7))
  set('mau', async () => activeWithin(admin, 30))

  set('swipes', async () =>
    flowMetric(await countSeries(admin, 'swipes', range)),
  )
  const likes = (swipes?.rows ?? []).filter(
    (r) => r.action === 'like' || r.action === 'superlike',
  ).length
  set('likes', async () =>
    flowMetric(
      await countSeries(admin, 'swipes', range, (q) =>
        q.in('action', ['like', 'superlike']),
      ),
    ),
  )
  set('matches', async () =>
    flowMetric(await countSeries(admin, 'matches', range)),
  )
  const matchesInRange = await headCount(admin, 'matches', {
    from: range.from,
    to: range.to,
  }).catch(() => null)
  set('matchConversion', async () =>
    matchesInRange !== null && likes > 0
      ? okMetric(
          ratePercent(matchesInRange, likes) ?? 0,
          null,
          [],
          'Matches created per 100 likes in this period (the likes and matches are not necessarily from the same people).',
        )
      : unavailable('Needs at least one like in this period.'),
  )
  set('messagesSent', async () =>
    flowMetric(await countSeries(admin, 'messages', range)),
  )
  set('newConversations', async () => {
    const { first, truncated } = await firstMessageTimes(admin)
    const inRange = Array.from(first).filter(
      ([, t]) => t >= range.from && t < range.to,
    )
    const inPrev = Array.from(first).filter(
      ([, t]) => t >= range.prevFrom && t < range.prevTo,
    )
    return okMetric(
      inRange.length,
      inPrev.length,
      bucketDistinct(
        inRange.map(([id, t]) => ({ id, t })),
        range,
      ),
      truncated
        ? 'Very large history: older conversations may be missing.'
        : undefined,
      first.size,
    )
  })
  set('bookingRequests', async () =>
    flowMetric(await countSeries(admin, 'bookings', range)),
  )
  set('profilesCreated', async () =>
    flowMetric(await countSeries(admin, 'profiles', range, realUsers)),
  )
  set('profilesCompleted', async () =>
    flowMetric(
      await countSeries(admin, 'profiles', range, (q) =>
        realUsers(q.eq('onboarding_complete', true)),
      ),
      'People who joined in this period and finished setting up their profile.',
    ),
  )
  set('storiesPosted', async () =>
    flowMetric(await countSeries(admin, 'stories', range)),
  )

  // Things nobody records yet. Shown as unavailable, never as zero.
  for (const key of ['chefProfileViews', 'storyViews', 'storySaves']) {
    set(key, async () =>
      unavailable(
        'Not tracked yet. This needs a view event added to that screen, which is a separate piece of work.',
      ),
    )
  }

  await Promise.all(tasks)

  // ---- Funnel -------------------------------------------------------------
  const funnel = await buildJourney(
    admin,
    range,
    swipes?.rows ?? [],
    messages?.rows ?? [],
  )

  return {
    range,
    metrics,
    funnel,
    truncated: Boolean(
      swipes?.truncated || messages?.truncated || bookings?.truncated,
    ),
    generatedAt: new Date().toISOString(),
  }
}

async function activeWithin(admin: Admin, days: number): Promise<Metric> {
  const now = Date.now()
  const from = new Date(
    days === 1 ? startOfAdminDay(now) : now - days * DAY,
  ).toISOString()
  const [s, m, b] = await Promise.all([
    fetchRows<{ swiper_id: string }>(admin, 'swipes', 'swiper_id, created_at', {
      from,
    }),
    fetchRows<{ sender_id: string }>(
      admin,
      'messages',
      'sender_id, created_at',
      { from },
    ),
    fetchRows<{ buyer_id: string | null }>(
      admin,
      'bookings',
      'buyer_id, created_at',
      { from },
    ),
  ])
  return okMetric(
    distinctCount([
      ...s.rows.map((r) => r.swiper_id),
      ...m.rows.map((r) => r.sender_id),
      ...b.rows.map((r) => r.buyer_id),
    ]),
    null,
    [],
    days === 1 ? 'Active today.' : `Active in the last ${days} days.`,
  )
}

// Visitor -> waitlist -> account -> profile -> first swipe -> first match ->
// first conversation. The first two steps come from consent-based analytics;
// every later step is counted from real records of the members who joined in
// the selected period.
async function buildJourney(
  admin: Admin,
  range: ResolvedRange,
  swipes: SwipeRow[],
  messages: MessageRow[],
) {
  let visitors: number | null = null
  let waitlist: number | null = null
  try {
    const [sessions, events] = await Promise.all([
      fetchRows<{ visitor_id: string }>(
        admin,
        'analytics_sessions',
        'visitor_id, started_at',
        {
          from: range.from,
          to: range.to,
          column: 'started_at',
        },
      ),
      fetchRows<{ visitor_id: string }>(
        admin,
        'analytics_events',
        'visitor_id, created_at',
        {
          from: range.from,
          to: range.to,
          apply: (q) => q.eq('name', 'waitlist_signup'),
        },
      ),
    ])
    visitors = distinctCount(sessions.rows.map((r) => r.visitor_id))
    waitlist = distinctCount(events.rows.map((r) => r.visitor_id))
  } catch {
    // analytics not collecting yet: those two steps stay "not measurable"
  }

  const cohort = await fetchRows<{
    id: string
    onboarding_complete: boolean | null
  }>(admin, 'profiles', 'id, onboarding_complete, created_at', {
    apply: realUsers,
    from: range.from,
    to: range.to,
  }).catch(() => null)
  if (!cohort) return []
  const ids = new Set(cohort.rows.map((r) => r.id))
  const matches = await fetchRows<MatchRow>(
    admin,
    'matches',
    'user1_id, user2_id, created_at',
    {
      from: range.from,
    },
  ).catch(() => null)

  const swiped = new Set(
    swipes.map((s) => s.swiper_id).filter((id) => ids.has(id)),
  )
  const matched = new Set<string>()
  matches?.rows.forEach((m) => {
    if (ids.has(m.user1_id)) matched.add(m.user1_id)
    if (ids.has(m.user2_id)) matched.add(m.user2_id)
  })
  const talked = new Set(
    messages.map((m) => m.sender_id).filter((id) => ids.has(id)),
  )

  return buildFunnel([
    {
      key: 'visitors',
      label: 'Website visitors',
      count: visitors,
      note: 'Consenting visitors only',
    },
    {
      key: 'waitlist',
      label: 'Joined the waitlist',
      count: waitlist,
      note: 'Consenting visitors only',
    },
    { key: 'registered', label: 'Created an account', count: ids.size },
    {
      key: 'profile',
      label: 'Completed their profile',
      count: cohort.rows.filter((r) => r.onboarding_complete).length,
    },
    { key: 'swipe', label: 'First swipe', count: swiped.size },
    { key: 'match', label: 'First match', count: matched.size },
    { key: 'conversation', label: 'Sent a first message', count: talked.size },
  ])
}

// ---------------------------------------------------------------- Retention
export async function getRetention(admin: Admin) {
  const now = Date.now()
  const WEEK = 7 * DAY
  const windowCount = 8
  // Eight 7-day windows, the last one ending at tomorrow's Lagos midnight.
  const firstWindowStartMs = startOfAdminDay(now) + DAY - windowCount * WEEK
  const from = new Date(firstWindowStartMs).toISOString()

  try {
    const [members, swipes, messages, bookings] = await Promise.all([
      fetchRows<{ id: string; created_at: string }>(
        admin,
        'profiles',
        'id, created_at',
        {
          apply: realUsers,
          from,
        },
      ),
      fetchRows<{ swiper_id: string; created_at: string }>(
        admin,
        'swipes',
        'swiper_id, created_at',
        { from },
      ),
      fetchRows<{ sender_id: string; created_at: string }>(
        admin,
        'messages',
        'sender_id, created_at',
        { from },
      ),
      fetchRows<{ buyer_id: string | null; created_at: string }>(
        admin,
        'bookings',
        'buyer_id, created_at',
        { from },
      ),
    ])
    const activity = [
      ...swipes.rows.map((r) => ({
        id: r.swiper_id,
        ms: Date.parse(r.created_at),
      })),
      ...messages.rows.map((r) => ({
        id: r.sender_id,
        ms: Date.parse(r.created_at),
      })),
      ...bookings.rows.flatMap((r) =>
        r.buyer_id ? [{ id: r.buyer_id, ms: Date.parse(r.created_at) }] : [],
      ),
    ]
    const rows = computeRetention({
      members: members.rows.map((r) => ({
        id: r.id,
        joinedMs: Date.parse(r.created_at),
      })),
      activity,
      firstWindowStartMs,
      windowMs: WEEK,
      windowCount,
      nowMs: now,
    })
    return {
      available: true as const,
      rows,
      truncated:
        members.truncated ||
        swipes.truncated ||
        messages.truncated ||
        bookings.truncated,
      note: 'Each row is the members who joined that week. Each column shows what share of them did something (swiped, messaged or booked) in a later week. Small groups swing widely, so read percentages with the group size in mind.',
      generatedAt: new Date(now).toISOString(),
    }
  } catch {
    return {
      available: false as const,
      reason: 'Retention could not be calculated right now.',
    }
  }
}
