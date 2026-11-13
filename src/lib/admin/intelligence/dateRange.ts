// Pure module (no framework imports) so it can be unit-tested with node --test.

// Food4Love's audience is in Nigeria (WAT = UTC+1, no daylight saving), so
// "today" and "this week" are cut at Lagos midnight, not UTC midnight.
export const ADMIN_TZ_OFFSET_MINUTES = 60
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MAX_CUSTOM_DAYS = 400

export type RangePreset =
  'today' | 'yesterday' | '7d' | '30d' | '90d' | 'year' | 'custom'

export type Bucket = 'hour' | 'day' | 'week'

export interface ResolvedRange {
  preset: RangePreset
  label: string
  from: string // ISO, inclusive
  to: string // ISO, exclusive
  prevFrom: string
  prevTo: string
  bucket: Bucket
  days: number
}

export const RANGE_PRESETS: { key: RangePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'year', label: 'This year' },
  { key: 'custom', label: 'Custom range' },
]

const SHIFT = ADMIN_TZ_OFFSET_MINUTES * MINUTE

// Midnight (in the admin time zone) at or before the given instant.
export function startOfAdminDay(ms: number): number {
  return Math.floor((ms + SHIFT) / DAY) * DAY - SHIFT
}

function startOfAdminYear(ms: number): number {
  const local = new Date(ms + SHIFT)
  return Date.UTC(local.getUTCFullYear(), 0, 1) - SHIFT
}

function chooseBucket(lengthMs: number): Bucket {
  if (lengthMs <= 2 * DAY) return 'hour'
  if (lengthMs <= 92 * DAY) return 'day'
  return 'week'
}

function build(
  preset: RangePreset,
  label: string,
  fromMs: number,
  toMs: number,
): ResolvedRange {
  const length = Math.max(toMs - fromMs, HOUR)
  // Compare with the previous equivalent period, shifted back by whole days so
  // "today so far" is compared with "yesterday up to the same time".
  const shift = Math.ceil(length / DAY) * DAY
  return {
    preset,
    label,
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    prevFrom: new Date(fromMs - shift).toISOString(),
    prevTo: new Date(toMs - shift).toISOString(),
    bucket: chooseBucket(length),
    days: Math.max(1, Math.round(length / DAY)),
  }
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function parseLocalDate(value: string | null | undefined): number | null {
  if (!value || !DATE_ONLY.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d)
  const check = new Date(utc)
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  )
    return null
  return utc - SHIFT
}

export function resolveRange(
  input: { range?: string | null; from?: string | null; to?: string | null },
  nowMs: number = Date.now(),
): ResolvedRange {
  const today = startOfAdminDay(nowMs)
  switch (input.range) {
    case 'today':
      return build('today', 'Today', today, nowMs)
    case 'yesterday':
      return build('yesterday', 'Yesterday', today - DAY, today)
    case '7d':
      return build('7d', 'Last 7 days', today - 6 * DAY, nowMs)
    case '90d':
      return build('90d', 'Last 90 days', today - 89 * DAY, nowMs)
    case 'year':
      return build('year', 'This year', startOfAdminYear(nowMs), nowMs)
    case 'custom': {
      const fromMs = parseLocalDate(input.from)
      const toDay = parseLocalDate(input.to)
      if (
        fromMs !== null &&
        toDay !== null &&
        fromMs <= toDay &&
        toDay <= today &&
        (toDay - fromMs) / DAY < MAX_CUSTOM_DAYS
      ) {
        const toMs = Math.min(toDay + DAY, nowMs)
        return build('custom', 'Custom range', fromMs, toMs)
      }
      break
    }
    default:
      break
  }
  return build('30d', 'Last 30 days', today - 29 * DAY, nowMs)
}

export function bucketStepMs(bucket: Bucket): number {
  return bucket === 'hour' ? HOUR : bucket === 'day' ? DAY : 7 * DAY
}

// Cut-off used by "new this week / this month" style cards, independent of the
// selected range: always relative to now.
export function windowStart(
  kind: 'today' | 'week' | 'month',
  nowMs: number = Date.now(),
): number {
  const today = startOfAdminDay(nowMs)
  if (kind === 'today') return today
  if (kind === 'week') return today - 6 * DAY
  return today - 29 * DAY
}
