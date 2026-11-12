import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  bucketCounts,
  okMetric,
  unavailable,
  type Metric,
  type Point,
} from '../series'
import type { ResolvedRange } from '../dateRange'

export type Admin = ReturnType<typeof createAdminClient>
// Supabase's query builder is generic over the schema, which this project does
// not generate types for. One alias keeps the loose typing in a single place.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyQuery = any

// Never pull more than this many rows into memory for one aggregate. If a
// window holds more, the figure is flagged as truncated instead of guessed.
export const ROW_CAP = 20000

export class DataError extends Error {
  missing: boolean
  constructor(message: string, missing = false) {
    super(message)
    this.missing = missing
  }
}

function fail(error: { code?: string; message?: string }): never {
  const missing = error.code === '42P01' || error.code === 'PGRST205'
  throw new DataError(missing ? 'missing_table' : 'query_failed', missing)
}

export const NOT_COLLECTED =
  'Not collected yet. Needs the analytics migration, the analytics switch turned on (NEXT_PUBLIC_ANALYTICS_ENABLED), and visitors who accept the banner.'

// Members that are real people (demo/seed profiles are excluded everywhere).
export const realUsers = (q: AnyQuery) =>
  q.or('is_demo.is.null,is_demo.eq.false')

export async function headCount(
  admin: Admin,
  table: string,
  options: {
    apply?: (q: AnyQuery) => AnyQuery
    from?: string
    to?: string
    column?: string
  } = {},
): Promise<number> {
  const column = options.column ?? 'created_at'
  let q: AnyQuery = admin
    .from(table)
    .select('*', { count: 'exact', head: true })
  if (options.from) q = q.gte(column, options.from)
  if (options.to) q = q.lt(column, options.to)
  if (options.apply) q = options.apply(q)
  const { count, error } = await q
  if (error) fail(error)
  return count ?? 0
}

export async function fetchRows<T>(
  admin: Admin,
  table: string,
  columns: string,
  options: {
    apply?: (q: AnyQuery) => AnyQuery
    from?: string
    to?: string
    column?: string
    cap?: number
  } = {},
): Promise<{ rows: T[]; truncated: boolean }> {
  const column = options.column ?? 'created_at'
  const cap = options.cap ?? ROW_CAP
  let q: AnyQuery = admin.from(table).select(columns)
  if (options.from) q = q.gte(column, options.from)
  if (options.to) q = q.lt(column, options.to)
  if (options.apply) q = options.apply(q)
  const { data, error } = await q.order(column, { ascending: false }).limit(cap)
  if (error) fail(error)
  const rows = (data ?? []) as T[]
  return { rows, truncated: rows.length >= cap }
}

// Count + comparison + trend for any table with a created_at column.
export async function countSeries(
  admin: Admin,
  table: string,
  range: ResolvedRange,
  apply?: (q: AnyQuery) => AnyQuery,
  options: { column?: string } = {},
): Promise<{
  value: number
  previous: number
  total: number
  series: Point[]
  truncated: boolean
}> {
  const column = options.column ?? 'created_at'
  const [current, previous, total] = await Promise.all([
    fetchRows<Record<string, string>>(admin, table, column, {
      apply,
      from: range.from,
      to: range.to,
      column,
    }),
    headCount(admin, table, {
      apply,
      from: range.prevFrom,
      to: range.prevTo,
      column,
    }),
    headCount(admin, table, { apply }),
  ])
  const value = current.truncated
    ? await headCount(admin, table, {
        apply,
        from: range.from,
        to: range.to,
        column,
      })
    : current.rows.length
  return {
    value,
    previous,
    total,
    series: bucketCounts(
      current.rows.map((r) => r[column]),
      range,
    ),
    truncated: current.truncated,
  }
}

// Runs one metric. A failure becomes an honest "unavailable" card; it never
// turns into a zero and never takes the rest of the page down.
export async function metric(
  build: () => Promise<Metric>,
  missingReason = NOT_COLLECTED,
): Promise<Metric> {
  try {
    return await build()
  } catch (error) {
    if (error instanceof DataError && error.missing) {
      return unavailable(missingReason)
    }
    return unavailable('This figure could not be read right now.')
  }
}

export function flowMetric(
  s: Awaited<ReturnType<typeof countSeries>>,
  note?: string,
): Metric {
  return okMetric(
    s.value,
    s.previous,
    s.series,
    s.truncated
      ? `${note ? `${note} ` : ''}Large window: trend is based on the most recent ${ROW_CAP.toLocaleString()} records.`
      : note,
    s.total,
  )
}

// When was each conversation's first message sent? Only ids and timestamps are
// read; message text is never selected anywhere in the admin analytics.
export async function firstMessageTimes(admin: Admin) {
  const all = await fetchRows<{ match_id: string; created_at: string }>(
    admin,
    'messages',
    'match_id, created_at',
    { cap: ROW_CAP * 2 },
  )
  const first = new Map<string, string>()
  all.rows.forEach((row) => {
    const known = first.get(row.match_id)
    if (!known || row.created_at < known)
      first.set(row.match_id, row.created_at)
  })
  return { first, truncated: all.truncated }
}

export function distinctCount(values: (string | null | undefined)[]): number {
  const set = new Set<string>()
  for (const v of values) if (v) set.add(v)
  return set.size
}

export function topCounts(
  values: (string | null | undefined)[],
  limit: number,
  unknownLabel = 'Unknown',
): { key: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const v of values) {
    const key = v && v.trim() ? v : unknownLabel
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts, ([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
