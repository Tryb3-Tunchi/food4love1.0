// No imports on purpose: unit-tested with `node --test`.
//
// Loads the booking a person wants to act on. The newer column (proposed_scheduled_for)
// only exists once the booking migration is applied. Until then the full query fails, and
// without this fallback EVERY accept/decline would answer "not found". So: try the full
// query, and if the database says the column is missing, read the older columns instead.

export interface BookingActionRow {
  id: string
  buyer_id: string
  cook_id: string
  match_id: string | null
  status: string
  payment_status: string | null
  scheduled_for: string | null
  proposed_scheduled_for: string | null
}

const BASE_COLUMNS =
  'id, buyer_id, cook_id, match_id, status, payment_status, scheduled_for'

interface QueryResult {
  data: unknown
  error: { code?: string; message?: string } | null
}

interface MinimalClient {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): { maybeSingle(): PromiseLike<QueryResult> }
    }
  }
}

export async function loadBookingForAction(
  client: MinimalClient,
  bookingId: string,
  isMissingSchema: (error: QueryResult['error']) => boolean,
): Promise<BookingActionRow | null> {
  const full = await client
    .from('bookings')
    .select(`${BASE_COLUMNS}, proposed_scheduled_for`)
    .eq('id', bookingId)
    .maybeSingle()
  if (!full.error) return (full.data as BookingActionRow | null) ?? null

  if (isMissingSchema(full.error)) {
    const legacy = await client
      .from('bookings')
      .select(BASE_COLUMNS)
      .eq('id', bookingId)
      .maybeSingle()
    if (legacy.error || !legacy.data) return null
    return {
      ...(legacy.data as Omit<BookingActionRow, 'proposed_scheduled_for'>),
      proposed_scheduled_for: null,
    }
  }
  return null
}
