import type { CookAvailability, DayHours, WeekdayKey } from '@/types/db'

export const WEEKDAYS: { key: WeekdayKey; label: string; short: string }[] = [
  { key: 'mon', label: 'Monday', short: 'Mon' },
  { key: 'tue', label: 'Tuesday', short: 'Tue' },
  { key: 'wed', label: 'Wednesday', short: 'Wed' },
  { key: 'thu', label: 'Thursday', short: 'Thu' },
  { key: 'fri', label: 'Friday', short: 'Fri' },
  { key: 'sat', label: 'Saturday', short: 'Sat' },
  { key: 'sun', label: 'Sunday', short: 'Sun' },
]

const JS_DAY_TO_KEY: WeekdayKey[] = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
]

const NIGERIA_UTC_OFFSET = '+01:00'

export type AvailabilityCheck = { ok: true } | { ok: false; reason: string }

export function formatClock(time: string) {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return m
    ? `${hour}:${String(m).padStart(2, '0')}${suffix}`
    : `${hour}${suffix}`
}

export function hasWeeklySchedule(availability: CookAvailability) {
  return Object.keys(availability.weekly_hours ?? {}).length > 0
}

export function checkAvailability(
  availability: CookAvailability,
  request: { date: string; time: string; ordersThatDay: number; now?: Date },
): AvailabilityCheck {
  if (availability.is_paused) {
    return {
      ok: false,
      reason: 'This cook is not taking new bookings right now.',
    }
  }

  if (hasWeeklySchedule(availability)) {
    const weekday = new Date(
      `${request.date}T12:00:00${NIGERIA_UTC_OFFSET}`,
    ).getUTCDay()
    const dayKey = JS_DAY_TO_KEY[weekday]
    const day = WEEKDAYS.find((d) => d.key === dayKey)!
    const hours = availability.weekly_hours[dayKey]

    if (!hours) {
      return {
        ok: false,
        reason: `This cook doesn't take bookings on ${day.label}s.`,
      }
    }
    if (request.time < hours.open || request.time > hours.close) {
      return {
        ok: false,
        reason: `On ${day.label}s this cook is available ${formatClock(hours.open)} to ${formatClock(hours.close)}.`,
      }
    }
  }

  if (availability.notice_hours) {
    const now = request.now ?? new Date()
    const earliest = now.getTime() + availability.notice_hours * 3_600_000
    const requested = new Date(
      `${request.date}T${request.time}:00${NIGERIA_UTC_OFFSET}`,
    ).getTime()
    if (requested < earliest) {
      return {
        ok: false,
        reason: `This cook needs at least ${availability.notice_hours} hours' notice.`,
      }
    }
  }

  if (
    availability.max_orders_per_day &&
    request.ordersThatDay >= availability.max_orders_per_day
  ) {
    return {
      ok: false,
      reason: 'This cook is fully booked that day. Please try another date.',
    }
  }

  return { ok: true }
}

export function summarizeHours(weekly: CookAvailability['weekly_hours']) {
  const runs: { from: string; to: string; hours: DayHours }[] = []

  for (const day of WEEKDAYS) {
    const hours = weekly[day.key]
    if (!hours) continue
    const last = runs[runs.length - 1]
    const previousIndex = WEEKDAYS.findIndex((d) => d.short === last?.to)
    const isNextDay = WEEKDAYS[previousIndex + 1]?.key === day.key
    if (
      last &&
      isNextDay &&
      last.hours.open === hours.open &&
      last.hours.close === hours.close
    ) {
      last.to = day.short
    } else {
      runs.push({ from: day.short, to: day.short, hours })
    }
  }

  if (runs.length === 0) return 'Closed'
  return runs
    .map((run) => {
      const days = run.from === run.to ? run.from : `${run.from}–${run.to}`
      return `${days} ${formatClock(run.hours.open)}–${formatClock(run.hours.close)}`
    })
    .join(', ')
}
