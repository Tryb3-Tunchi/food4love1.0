// Pure module with NO imports (Node's test runner cannot resolve extensionless
// relative imports, and tsc rejects ".ts" ones), so it is unit-tested directly.

type Bucket = 'hour' | 'day' | 'week'

function bucketStepMs(bucket: Bucket): number {
  return bucket === 'hour'
    ? 3_600_000
    : bucket === 'day'
      ? 86_400_000
      : 7 * 86_400_000
}

export interface Point {
  t: string // ISO start of the bucket
  v: number
}

interface Window {
  from: string
  to: string
  bucket: Bucket
}

function bucketCount(range: Window): number {
  const span = Date.parse(range.to) - Date.parse(range.from)
  return Math.max(1, Math.ceil(span / bucketStepMs(range.bucket)))
}

function emptyBuckets(range: Window): Point[] {
  const start = Date.parse(range.from)
  const step = bucketStepMs(range.bucket)
  const n = bucketCount(range)
  const points: Point[] = []
  for (let i = 0; i < n; i += 1) {
    points.push({ t: new Date(start + i * step).toISOString(), v: 0 })
  }
  return points
}

function indexFor(range: Window, ms: number): number {
  const start = Date.parse(range.from)
  if (!Number.isFinite(ms) || ms < start || ms >= Date.parse(range.to)) {
    return -1
  }
  return Math.floor((ms - start) / bucketStepMs(range.bucket))
}

// How many timestamps fall in each bucket (zero-filled, so charts have no gaps).
export function bucketCounts(timestamps: string[], range: Window): Point[] {
  const points = emptyBuckets(range)
  for (const stamp of timestamps) {
    const i = indexFor(range, Date.parse(stamp))
    if (i >= 0 && i < points.length) points[i].v += 1
  }
  return points
}

// How many DIFFERENT ids appear in each bucket (e.g. daily active members).
export function bucketDistinct(
  rows: { t: string; id: string }[],
  range: Window,
): Point[] {
  const points = emptyBuckets(range)
  const seen: Set<string>[] = points.map(() => new Set<string>())
  for (const row of rows) {
    const i = indexFor(range, Date.parse(row.t))
    if (i >= 0 && i < points.length) seen[i].add(row.id)
  }
  return points.map((p, i) => ({ ...p, v: seen[i].size }))
}

export function totalOf(points: Point[]): number {
  return points.reduce((sum, p) => sum + p.v, 0)
}

// Percentage change. Returns null when a percentage would be meaningless
// (nothing to compare against), so the UI shows "new" or a dash, not "Infinity".
export function growthPercent(
  current: number,
  previous: number,
): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export function ratePercent(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) {
    return null
  }
  return Math.round((part / whole) * 1000) / 10
}

// A metric as the dashboard needs it. `unavailable` is a real state: it means
// "this was never collected / cannot be computed", never "zero".
export type Metric =
  | {
      status: 'ok'
      value: number
      previous: number | null
      growth: number | null
      series: Point[]
      total?: number // all-time figure, when the card shows a running total
      note?: string
    }
  | { status: 'unavailable'; reason: string }

export function okMetric(
  value: number,
  previous: number | null,
  series: Point[],
  note?: string,
  total?: number,
): Metric {
  return {
    status: 'ok',
    value,
    previous,
    growth: previous === null ? null : growthPercent(value, previous),
    series,
    total,
    note,
  }
}

export function unavailable(reason: string): Metric {
  return { status: 'unavailable', reason }
}

export interface FunnelStepInput {
  key: string
  label: string
  count: number | null // null = not measurable
  note?: string
}

export interface FunnelRow extends FunnelStepInput {
  percentOfFirst: number | null
  percentOfPrevious: number | null
}

export function buildFunnel(steps: FunnelStepInput[]): FunnelRow[] {
  const firstKnown = steps.find((s) => s.count !== null)?.count ?? null
  let previous: number | null = null
  return steps.map((step) => {
    const row: FunnelRow = {
      ...step,
      percentOfFirst:
        step.count !== null && firstKnown !== null
          ? ratePercent(step.count, firstKnown)
          : null,
      percentOfPrevious:
        step.count !== null && previous !== null
          ? ratePercent(step.count, previous)
          : null,
    }
    if (step.count !== null) previous = step.count
    return row
  })
}
