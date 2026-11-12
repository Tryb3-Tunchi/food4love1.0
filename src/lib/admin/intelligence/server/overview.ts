import 'server-only'
import { resolveRange, type ResolvedRange } from '../dateRange'
import {
  bucketCounts,
  bucketDistinct,
  okMetric,
  unavailable,
  type Metric,
} from '../series'
import {
  ROW_CAP,
  countSeries,
  distinctCount,
  fetchRows,
  flowMetric,
  headCount,
  metric,
  realUsers,
  type Admin,
} from './core'

interface SessionRow {
  started_at: string
  visitor_id: string
}
interface MessageRow {
  created_at: string
  match_id: string
}

export async function getOverview(admin: Admin, range: ResolvedRange) {
  const metrics: Record<string, Metric> = {}
  const tasks: Promise<void>[] = []
  const set = (key: string, build: () => Promise<Metric>, reason?: string) => {
    tasks.push(
      metric(build, reason).then((m) => {
        metrics[key] = m
      }),
    )
  }

  const today = resolveRange({ range: 'today' })
  const week = resolveRange({ range: '7d' })
  const month = resolveRange({ range: '30d' })

  set('registered', async () =>
    flowMetric(await countSeries(admin, 'profiles', range, realUsers)),
  )
  set('newToday', async () =>
    flowMetric(await countSeries(admin, 'profiles', today, realUsers)),
  )
  set('newWeek', async () =>
    flowMetric(await countSeries(admin, 'profiles', week, realUsers)),
  )
  set('newMonth', async () =>
    flowMetric(await countSeries(admin, 'profiles', month, realUsers)),
  )
  set('waitlist', async () =>
    flowMetric(
      await countSeries(admin, 'waitlist_subscribers', range),
      'People on the waitlist. Joining the waitlist does not create an account.',
    ),
  )
  set('cooks', async () =>
    flowMetric(
      await countSeries(admin, 'profiles', range, (q) =>
        realUsers(q.eq('role', 'cook')),
      ),
    ),
  )
  set('matches', async () =>
    flowMetric(
      await countSeries(admin, 'matches', range),
      'Every match ever created, including ended or blocked ones.',
    ),
  )
  set('messages', async () =>
    flowMetric(await countSeries(admin, 'messages', range)),
  )

  // Conversations = matches that have at least one message.
  set('conversations', async () => {
    const all = await fetchRows<MessageRow>(
      admin,
      'messages',
      'match_id, created_at',
      { cap: ROW_CAP * 2 },
    )
    // Count each conversation once, in the period of its FIRST message.
    const firstSeen = new Map<string, string>()
    all.rows.forEach((row) => {
      const known = firstSeen.get(row.match_id)
      if (!known || row.created_at < known) {
        firstSeen.set(row.match_id, row.created_at)
      }
    })
    const started = Array.from(firstSeen, ([id, t]) => ({ id, t }))
    const inRange = started.filter((s) => s.t >= range.from && s.t < range.to)
    const inPrev = started.filter(
      (s) => s.t >= range.prevFrom && s.t < range.prevTo,
    )
    return okMetric(
      inRange.length,
      inPrev.length,
      bucketDistinct(inRange, range),
      all.truncated
        ? 'Very large history: older conversations may be missing.'
        : 'A conversation is a match with at least one message.',
      started.length,
    )
  })

  set('chefs', async () =>
    unavailable(
      'Food4Love does not store a separate “professional chef” type. Every chef account is a cook, so the two cannot be told apart yet.',
    ),
  )

  // Visitor figures come from consent-based analytics.
  set('visits', async () => {
    const [cur, prev, total] = await Promise.all([
      fetchRows<SessionRow>(
        admin,
        'analytics_sessions',
        'started_at, visitor_id',
        {
          from: range.from,
          to: range.to,
          column: 'started_at',
        },
      ),
      headCount(admin, 'analytics_sessions', {
        from: range.prevFrom,
        to: range.prevTo,
        column: 'started_at',
      }),
      headCount(admin, 'analytics_sessions', { column: 'started_at' }),
    ])
    return okMetric(
      cur.rows.length,
      prev,
      bucketCounts(
        cur.rows.map((r) => r.started_at),
        range,
      ),
      'Counts visits by people who accepted analytics.',
      total,
    )
  })
  set('uniqueVisitors', async () => {
    const [cur, prev, all] = await Promise.all([
      fetchRows<SessionRow>(
        admin,
        'analytics_sessions',
        'started_at, visitor_id',
        {
          from: range.from,
          to: range.to,
          column: 'started_at',
        },
      ),
      fetchRows<SessionRow>(
        admin,
        'analytics_sessions',
        'started_at, visitor_id',
        {
          from: range.prevFrom,
          to: range.prevTo,
          column: 'started_at',
        },
      ),
      fetchRows<SessionRow>(
        admin,
        'analytics_sessions',
        'started_at, visitor_id',
        {
          column: 'started_at',
          cap: ROW_CAP * 2,
        },
      ),
    ])
    return okMetric(
      distinctCount(cur.rows.map((r) => r.visitor_id)),
      distinctCount(prev.rows.map((r) => r.visitor_id)),
      bucketDistinct(
        cur.rows.map((r) => ({ t: r.started_at, id: r.visitor_id })),
        range,
      ),
      'One random ID per browser, so someone using two devices counts twice.',
      distinctCount(all.rows.map((r) => r.visitor_id)),
    )
  })

  set('activeNow', async () => {
    const since = new Date(Date.now() - 120_000).toISOString()
    const count = await headCount(admin, 'user_presence', {
      from: since,
      column: 'last_seen_at',
    })
    return okMetric(
      count,
      null,
      [],
      'Signed-in members whose browser checked in during the last 2 minutes.',
    )
  })

  await Promise.all(tasks)
  return {
    range,
    metrics,
    analyticsEnabled: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true',
    generatedAt: new Date().toISOString(),
  }
}
