import 'server-only'
import { resolveRange, type ResolvedRange } from '../dateRange'
import { CHANNEL_LABELS, type Channel } from '../attribution'
import {
  bucketCounts,
  bucketDistinct,
  growthPercent,
  okMetric,
  ratePercent,
  unavailable,
  type Metric,
} from '../series'
import {
  countSeries,
  distinctCount,
  fetchRows,
  flowMetric,
  metric,
  realUsers,
  topCounts,
  type Admin,
} from './core'

export interface SessionRow {
  id: string
  visitor_id: string
  user_id: string | null
  is_returning: boolean
  started_at: string
  last_seen_at: string
  landing_path: string
  channel: Channel
  country: string | null
  region: string | null
  utm_campaign: string | null
  utm_source: string | null
}
export interface EventRow {
  session_id: string
  visitor_id: string
  user_id: string | null
  name: string
  path: string | null
  created_at: string
}

const SESSION_COLUMNS =
  'id, visitor_id, user_id, is_returning, started_at, last_seen_at, landing_path, channel, country, region, utm_campaign, utm_source'

const loadSessions = (admin: Admin, from: string, to: string) =>
  fetchRows<SessionRow>(admin, 'analytics_sessions', SESSION_COLUMNS, {
    from,
    to,
    column: 'started_at',
  })

const loadEvents = (admin: Admin, from: string, to: string, names: string[]) =>
  fetchRows<EventRow>(
    admin,
    'analytics_events',
    'session_id, visitor_id, user_id, name, path, created_at',
    {
      from,
      to,
      apply: (q) => q.in('name', names),
    },
  )

const distinctVisitorsBetween = async (
  admin: Admin,
  from: string,
  to: string,
) =>
  distinctCount(
    (await loadSessions(admin, from, to)).rows.map((r) => r.visitor_id),
  )

// ---------------------------------------------------------------- Visitors
export async function getVisitors(admin: Admin, range: ResolvedRange) {
  const metrics: Record<string, Metric> = {}
  const tables: Record<string, { key: string; count: number }[]> = {}
  const tasks: Promise<void>[] = []
  const set = (key: string, build: () => Promise<Metric>) =>
    tasks.push(metric(build).then((m) => void (metrics[key] = m)))

  let sessions: Awaited<ReturnType<typeof loadSessions>> | null = null
  let views: Awaited<ReturnType<typeof loadEvents>> | null = null
  let signups: Awaited<ReturnType<typeof loadEvents>> | null = null
  let available = true
  try {
    ;[sessions, views, signups] = await Promise.all([
      loadSessions(admin, range.from, range.to),
      loadEvents(admin, range.from, range.to, ['page_view']),
      loadEvents(admin, range.from, range.to, [
        'waitlist_signup',
        'signup_complete',
      ]),
    ])
  } catch {
    available = false
  }
  if (!available || !sessions || !views || !signups) {
    return {
      range,
      available: false as const,
      reason:
        'Visitor analytics is not collecting yet. Apply the analytics migration; visits are recorded from people who accept the privacy banner.',
    }
  }
  const s = sessions
  const v = views
  const sg = signups

  const prevVisits = await countSeries(
    admin,
    'analytics_sessions',
    range,
    undefined,
    { column: 'started_at' },
  ).catch(() => null)

  set('visits', async () =>
    okMetric(
      s.rows.length,
      prevVisits?.previous ?? null,
      bucketCounts(
        s.rows.map((r) => r.started_at),
        range,
      ),
      'Counts visits by people who accepted analytics.',
      prevVisits?.total,
    ),
  )
  set('uniqueVisitors', async () => {
    const prev = await distinctVisitorsBetween(
      admin,
      range.prevFrom,
      range.prevTo,
    )
    return okMetric(
      distinctCount(s.rows.map((r) => r.visitor_id)),
      prev,
      bucketDistinct(
        s.rows.map((r) => ({ t: r.started_at, id: r.visitor_id })),
        range,
      ),
    )
  })
  set('pageViews', async () =>
    okMetric(
      v.rows.length,
      null,
      bucketCounts(
        v.rows.map((r) => r.created_at),
        range,
      ),
    ),
  )

  // New vs returning (a visitor is "returning" if any of their sessions was).
  const returningVisitors = new Set(
    s.rows.filter((r) => r.is_returning).map((r) => r.visitor_id),
  )
  const allVisitors = new Set(s.rows.map((r) => r.visitor_id))
  set('firstTime', async () =>
    okMetric(allVisitors.size - returningVisitors.size, null, []),
  )
  set('returning', async () => okMetric(returningVisitors.size, null, []))

  // Fixed windows, independent of the selected range.
  for (const [key, preset] of [
    ['visitorsToday', 'today'],
    ['visitorsWeek', '7d'],
    ['visitorsMonth', '30d'],
  ] as const) {
    set(key, async () => {
      const r = resolveRange({ range: preset })
      const [cur, prev] = await Promise.all([
        distinctVisitorsBetween(admin, r.from, r.to),
        distinctVisitorsBetween(admin, r.prevFrom, r.prevTo),
      ])
      return okMetric(cur, prev, [])
    })
  }

  // Session length: only sessions whose browser kept checking in can be timed.
  const timed = s.rows
    .map((r) => (Date.parse(r.last_seen_at) - Date.parse(r.started_at)) / 1000)
    .filter((sec) => sec >= 30)
  set('avgSession', async () =>
    timed.length
      ? okMetric(
          Math.round(timed.reduce((a, b) => a + b, 0) / timed.length),
          null,
          [],
          `Seconds, from ${timed.length} sessions that stayed at least 30 seconds. Shorter visits cannot be timed.`,
        )
      : unavailable('No session stayed long enough to be timed yet.'),
  )

  // Single-page sessions (a "bounce" proxy that is honest about what it is).
  const pagesBySession = new Map<string, number>()
  v.rows.forEach((r) =>
    pagesBySession.set(
      r.session_id,
      (pagesBySession.get(r.session_id) ?? 0) + 1,
    ),
  )
  const withViews = pagesBySession.size
  const singlePage = Array.from(pagesBySession.values()).filter(
    (n) => n === 1,
  ).length
  set('singlePageRate', async () =>
    withViews
      ? okMetric(
          ratePercent(singlePage, withViews) ?? 0,
          null,
          [],
          'Percent of sessions that viewed exactly one page.',
        )
      : unavailable('No page views recorded in this period.'),
  )

  // Conversion, measured on consenting visitors only.
  const unique = allVisitors.size
  const waitlistVisitors = distinctCount(
    sg.rows
      .filter((r) => r.name === 'waitlist_signup')
      .map((r) => r.visitor_id),
  )
  const registerVisitors = distinctCount(
    sg.rows
      .filter((r) => r.name === 'signup_complete')
      .map((r) => r.visitor_id),
  )
  set('waitlistConversion', async () =>
    unique
      ? okMetric(
          ratePercent(waitlistVisitors, unique) ?? 0,
          null,
          [],
          `${waitlistVisitors} of ${unique} visitors joined the waitlist.`,
        )
      : unavailable('No visitors in this period.'),
  )
  set('registrationConversion', async () =>
    unique
      ? okMetric(
          ratePercent(registerVisitors, unique) ?? 0,
          null,
          [],
          `${registerVisitors} of ${unique} visitors created an account.`,
        )
      : unavailable('No visitors in this period.'),
  )

  await Promise.all(tasks)

  tables.landing = topCounts(
    s.rows.map((r) => r.landing_path),
    10,
  )
  tables.pages = topCounts(
    v.rows.map((r) => r.path),
    10,
  )

  // Four audiences, never mixed up.
  const signedIn = distinctCount(s.rows.map((r) => r.user_id))
  const returningSignedIn = distinctCount(
    s.rows.filter((r) => r.user_id && r.is_returning).map((r) => r.user_id),
  )
  return {
    range,
    available: true as const,
    truncated: s.truncated || v.truncated,
    metrics,
    tables,
    audiences: [
      {
        key: 'anonymous',
        label: 'Anonymous visitors',
        count: Math.max(0, unique - signedIn - waitlistVisitors),
      },
      {
        key: 'waitlist',
        label: 'Joined the waitlist',
        count: waitlistVisitors,
      },
      { key: 'registered', label: 'Signed-in members', count: signedIn },
      {
        key: 'returningRegistered',
        label: 'Returning members',
        count: returningSignedIn,
      },
    ],
    generatedAt: new Date().toISOString(),
  }
}

// --------------------------------------------------------------- Geography
export async function getGeography(
  admin: Admin,
  range: ResolvedRange,
  country: string | null,
) {
  let cur: Awaited<ReturnType<typeof loadSessions>>
  let prev: Awaited<ReturnType<typeof loadSessions>>
  let signups: Awaited<ReturnType<typeof loadEvents>>
  try {
    ;[cur, prev, signups] = await Promise.all([
      loadSessions(admin, range.from, range.to),
      loadSessions(admin, range.prevFrom, range.prevTo),
      loadEvents(admin, range.from, range.to, ['waitlist_signup']),
    ])
  } catch {
    return {
      range,
      available: false as const,
      reason:
        'Location analytics is not collecting yet. Apply the analytics migration; the country is estimated from the connection when a visitor accepts analytics.',
    }
  }

  const visitorsBy = (
    rows: SessionRow[],
    pick: (r: SessionRow) => string | null,
  ) => {
    const map = new Map<string, Set<string>>()
    rows.forEach((r) => {
      const key = pick(r) ?? '??'
      if (!map.has(key)) map.set(key, new Set())
      map.get(key)!.add(r.visitor_id)
    })
    return map
  }
  const usersBy = (
    rows: SessionRow[],
    pick: (r: SessionRow) => string | null,
  ) => {
    const map = new Map<string, Set<string>>()
    rows.forEach((r) => {
      if (!r.user_id) return
      const key = pick(r) ?? '??'
      if (!map.has(key)) map.set(key, new Set())
      map.get(key)!.add(r.user_id)
    })
    return map
  }

  const countryOf = (r: SessionRow) => r.country
  const cVisitors = visitorsBy(cur.rows, countryOf)
  const pVisitors = visitorsBy(prev.rows, countryOf)
  const cUsers = usersBy(cur.rows, countryOf)

  const sessionCountry = new Map(cur.rows.map((r) => [r.id, r.country ?? '??']))
  const waitlistBy = new Map<string, Set<string>>()
  signups.rows.forEach((e) => {
    const key = sessionCountry.get(e.session_id) ?? '??'
    if (!waitlistBy.has(key)) waitlistBy.set(key, new Set())
    waitlistBy.get(key)!.add(e.visitor_id)
  })

  const countries = Array.from(cVisitors, ([code, set]) => {
    const before = pVisitors.get(code)?.size ?? 0
    return {
      code,
      visitors: set.size,
      previous: before,
      growth: growthPercent(set.size, before),
      registered: cUsers.get(code)?.size ?? 0,
      waitlist: waitlistBy.get(code)?.size ?? 0,
    }
  }).sort((a, b) => b.visitors - a.visitors)

  let regions: { code: string; visitors: number; registered: number }[] | null =
    null
  if (country) {
    const rows = cur.rows.filter((r) => (r.country ?? '??') === country)
    const rv = visitorsBy(rows, (r) => r.region)
    const ru = usersBy(rows, (r) => r.region)
    regions = Array.from(rv, ([code, set]) => ({
      code,
      visitors: set.size,
      registered: ru.get(code)?.size ?? 0,
    })).sort((a, b) => b.visitors - a.visitors)
  }
  const allRegions = Array.from(
    visitorsBy(
      cur.rows.filter((r) => r.region),
      (r) => `${r.country ?? '??'}-${r.region}`,
    ),
    ([code, set]) => ({ code, visitors: set.size }),
  )
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, 10)

  // What members typed into their own profile (a different source, labelled so).
  // Only values shared by at least 3 members are shown, so nobody can be singled out.
  const profiles = await fetchRows<{ location: string | null }>(
    admin,
    'profiles',
    'location, created_at',
    { apply: realUsers, cap: 5000 },
  ).catch(() => null)
  const provided = profiles
    ? topCounts(
        profiles.rows.map((r) => r.location?.trim().toLowerCase() || null),
        50,
        '',
      )
        .filter((x) => x.key && x.count >= 3)
        .slice(0, 15)
    : []

  return {
    range,
    available: true as const,
    truncated: cur.truncated,
    estimatedFrom: 'connection (coarse, country and region only)',
    countries,
    topCountries: countries.filter((c) => c.code !== '??').slice(0, 10),
    unknownVisitors: cVisitors.get('??')?.size ?? 0,
    topRegions: allRegions,
    regions,
    selectedCountry: country,
    userProvided: provided,
    generatedAt: new Date().toISOString(),
  }
}

// ------------------------------------------------------------- Acquisition
export async function getAcquisition(admin: Admin, range: ResolvedRange) {
  let cur: Awaited<ReturnType<typeof loadSessions>>
  let prev: Awaited<ReturnType<typeof loadSessions>>
  let conv: Awaited<ReturnType<typeof loadEvents>>
  let collecting = true
  try {
    ;[cur, prev, conv] = await Promise.all([
      loadSessions(admin, range.from, range.to),
      loadSessions(admin, range.prevFrom, range.prevTo),
      loadEvents(admin, range.from, range.to, [
        'waitlist_signup',
        'signup_complete',
      ]),
    ])
  } catch {
    collecting = false
    cur = { rows: [], truncated: false }
    prev = { rows: [], truncated: false }
    conv = { rows: [], truncated: false }
  }

  const sessionChannel = new Map(cur.rows.map((r) => [r.id, r.channel]))
  const channels = Object.keys(CHANNEL_LABELS) as Channel[]
  const rows = channels
    .map((channel) => {
      const mine = cur.rows.filter((r) => r.channel === channel)
      const before = prev.rows.filter((r) => r.channel === channel)
      const visitors = distinctCount(mine.map((r) => r.visitor_id))
      const waitlist = distinctCount(
        conv.rows
          .filter(
            (e) =>
              e.name === 'waitlist_signup' &&
              sessionChannel.get(e.session_id) === channel,
          )
          .map((e) => e.visitor_id),
      )
      const registered = distinctCount(
        conv.rows
          .filter(
            (e) =>
              e.name === 'signup_complete' &&
              sessionChannel.get(e.session_id) === channel,
          )
          .map((e) => e.visitor_id),
      )
      return {
        channel,
        label: CHANNEL_LABELS[channel],
        visits: mine.length,
        previousVisits: before.length,
        growth: growthPercent(mine.length, before.length),
        visitors,
        returningVisitors: distinctCount(
          mine.filter((r) => r.is_returning).map((r) => r.visitor_id),
        ),
        waitlist,
        registered,
        waitlistRate: ratePercent(waitlist, visitors),
        registrationRate: ratePercent(registered, visitors),
      }
    })
    .filter((r) => r.visits > 0 || r.previousVisits > 0)
    .sort((a, b) => b.visits - a.visits)

  const campaigns = new Map<
    string,
    {
      visits: number
      visitors: Set<string>
      waitlist: Set<string>
      registered: Set<string>
    }
  >()
  const campaignOf = new Map<string, string>()
  cur.rows.forEach((r) => {
    if (!r.utm_campaign) return
    const key = `${r.utm_campaign}${r.utm_source ? ` · ${r.utm_source}` : ''}`
    campaignOf.set(r.id, key)
    if (!campaigns.has(key))
      campaigns.set(key, {
        visits: 0,
        visitors: new Set(),
        waitlist: new Set(),
        registered: new Set(),
      })
    const c = campaigns.get(key)!
    c.visits += 1
    c.visitors.add(r.visitor_id)
  })
  conv.rows.forEach((e) => {
    const key = campaignOf.get(e.session_id)
    if (!key) return
    const c = campaigns.get(key)!
    if (e.name === 'waitlist_signup') c.waitlist.add(e.visitor_id)
    else c.registered.add(e.visitor_id)
  })

  // Referral-link signups come from the existing referrals table, so this part
  // is real history, not just consenting visitors.
  const referrals = await metric(async () =>
    flowMetric(await countSeries(admin, 'referrals', range)),
  )

  return {
    range,
    available: collecting,
    reason:
      'Source tracking is not collecting yet. Apply the analytics migration, then share links such as /?utm_source=instagram&utm_campaign=launch.',
    truncated: cur.truncated,
    channels: rows,
    campaigns: Array.from(campaigns, ([name, c]) => ({
      name,
      visits: c.visits,
      visitors: c.visitors.size,
      waitlist: c.waitlist.size,
      registered: c.registered.size,
    }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 20),
    referrals,
    generatedAt: new Date().toISOString(),
  }
}
