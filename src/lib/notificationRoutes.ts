// Pure helpers (no imports) so they can be unit-tested with `node --test`.

export type NotificationKind =
  'match' | 'like' | 'message' | 'booking' | 'request' | 'review' | 'system'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Notification `data` is written by database triggers and API routes, so it is
// treated as untrusted: only a well-formed UUID may end up inside a URL.
function readId(data: unknown, keys: string[]): string | null {
  if (!data || typeof data !== 'object') return null
  for (const key of keys) {
    const value = (data as Record<string, unknown>)[key]
    if (typeof value === 'string' && UUID.test(value)) return value
  }
  return null
}

function readKind(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const value = (data as Record<string, unknown>).kind
  return typeof value === 'string' ? value : null
}

export function notificationHref(
  notification: { type: NotificationKind; data?: unknown },
  role: string | null | undefined,
): string | null {
  const matchId = readId(notification.data, ['match_id', 'matchId'])
  const kind = readKind(notification.data)
  // Verification and interest notifications are about a cook's verification, not a booking.
  if (kind === 'verification' || kind === 'interest')
    return role === 'cook' ? '/cook/verification' : null
  if (kind === 'interest_available') {
    const cookId = readId(notification.data, ['cook_id'])
    return cookId ? `/cook/${cookId}` : '/swipe'
  }
  // A reply from Food4Love Support (type 'message', but not a member chat).
  if (readId(notification.data, ['support_thread_id'])) return '/support'
  switch (notification.type) {
    case 'match':
      return matchId ? `/chat/${matchId}` : '/matches'
    case 'message':
      return matchId ? `/chat/${matchId}` : '/chat'
    case 'like':
      return role === 'cook' ? '/requests' : '/matches'
    case 'request':
      return role === 'cook' ? '/requests' : null
    case 'booking': {
      const bookingId = readId(notification.data, ['booking_id', 'bookingId'])
      return bookingId ? `/bookings/${bookingId}` : '/bookings'
    }
    default:
      return null
  }
}
