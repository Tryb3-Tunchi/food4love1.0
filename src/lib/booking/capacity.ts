// No imports on purpose: unit-tested with `node --test`.
//
// "Is this cook free on this day?" in ONE place, so creating a booking and accepting a
// suggested new time use the same rule. The cook's availability rule itself
// (opening hours, notice period, daily limit) is passed in, not copied here.

// Cook schedules are stored and shown in Nigeria time (UTC+1, no daylight saving).
export interface LagosSlot {
  date: string // YYYY-MM-DD in Lagos
  time: string // HH:MM in Lagos
  dayStart: string // ISO instant: 00:00 that Lagos day
  dayEnd: string // ISO instant: 00:00 the next Lagos day
}

export function lagosSlot(iso: string): LagosSlot {
  const at = new Date(iso)
  const lagos = new Date(at.getTime() + 60 * 60 * 1000)
  const date = lagos.toISOString().slice(0, 10)
  const time = lagos.toISOString().slice(11, 16)
  const start = new Date(`${date}T00:00:00+01:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return {
    date,
    time,
    dayStart: start.toISOString(),
    dayEnd: end.toISOString(),
  }
}

interface QueryResult {
  data?: unknown
  count?: number | null
  error: { code?: string; message?: string } | null
}
// The slice of the database client this check needs (so it can be tested without one).
export interface CapacityClient {
  from(table: string): {
    select(columns: string, options?: { count: 'exact'; head: true }): Query
  }
}
interface Query extends PromiseLike<QueryResult> {
  eq(column: string, value: string): Query
  neq(column: string, value: string): Query
  gte(column: string, value: string): Query
  lt(column: string, value: string): Query
  maybeSingle(): PromiseLike<QueryResult>
}

export type SlotResult =
  | { ok: true }
  | {
      ok: false
      status: number
      reason: string
      code: 'slot_unavailable' | 'check_failed'
    }

export interface SlotDeps {
  // the existing availability rule (src/lib/availability.ts)
  checkAvailability: (
    availability: never,
    request: { date: string; time: string; ordersThatDay: number },
  ) => { ok: true } | { ok: false; reason: string }
}

// Re-checks a cook's availability for a time that is about to become (or stay) a real
// booking: used when a customer accepts the cook's suggested time. The booking being
// moved is NOT counted against the new day (it is excluded by id), exactly like the
// database guard does it, so moving within a day never blocks itself.
// Fails CLOSED: if the database cannot answer, the time is not accepted.
export async function checkProposedSlot(
  client: CapacityClient,
  input: { cookId: string; bookingId: string; scheduledAtIso: string },
  deps: SlotDeps,
): Promise<SlotResult> {
  const slot = lagosSlot(input.scheduledAtIso)

  const availability = await client
    .from('cook_availability')
    .select('*')
    .eq('cook_id', input.cookId)
    .maybeSingle()
  if (availability.error) {
    return {
      ok: false,
      status: 503,
      code: 'check_failed',
      reason:
        'We could not check this cook’s availability just now. Please try again.',
    }
  }
  // A cook with no availability settings has no limits to enforce (as when booking).
  if (!availability.data) return { ok: true }

  const booked = await client
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('cook_id', input.cookId)
    .neq('id', input.bookingId)
    .gte('scheduled_for', slot.dayStart)
    .lt('scheduled_for', slot.dayEnd)
    .neq('status', 'cancelled')
  if (booked.error) {
    return {
      ok: false,
      status: 503,
      code: 'check_failed',
      reason:
        'We could not check this cook’s bookings just now. Please try again.',
    }
  }

  const verdict = deps.checkAvailability(availability.data as never, {
    date: slot.date,
    time: slot.time,
    ordersThatDay: booked.count ?? 0,
  })
  if (verdict.ok) return { ok: true }
  return {
    ok: false,
    status: 409,
    code: 'slot_unavailable',
    reason: `The suggested time is no longer available. ${verdict.reason} You can ask the cook for another time, or cancel the booking.`,
  }
}
