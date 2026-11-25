// Which number each bottom-navigation tab shows. Pure (no imports) so it is unit-tested.
//
// Each tab counts ITS OWN thing. The general notification total belongs to the bell only:
//   Chat      unread messages the member received (their own messages never count)
//   Matches   new matches with no message exchanged yet (food lovers)
//   Requests  pending booking requests + unanswered likes waiting for a reply (cooks)
// A tab with nothing waiting shows no badge.

export interface NavCounts {
  unreadMessages: number
  newMatches: number
  pendingBookings: number
  pendingLikeRequests: number
}

export type NavRole = 'cook' | 'buyer' | string | null | undefined

const clean = (n: unknown) =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0

export function navBadgeFor(
  href: string,
  role: NavRole,
  counts: Partial<NavCounts>,
): number {
  const isCook = role === 'cook'
  switch (href) {
    case '/chat':
      return clean(counts.unreadMessages)
    case '/matches':
      // cooks answer new likes in Requests, so their Matches tab carries no badge
      return isCook ? 0 : clean(counts.newMatches)
    case '/requests':
      return isCook
        ? clean(counts.pendingBookings) + clean(counts.pendingLikeRequests)
        : 0
    default:
      return 0
  }
}

// A match "needs attention" while nobody has written yet. Rows come from
// matches.select('id, messages(id)') with the embedded list limited to one message.
export function countNewMatches(
  rows: Array<{ messages?: unknown[] | null }> | null | undefined,
): number {
  return (rows ?? []).filter(
    (row) => !Array.isArray(row.messages) || row.messages.length === 0,
  ).length
}

export function countPendingBookings(
  bookings: Array<{ status?: string | null }> | null | undefined,
): number {
  // the same rule as the Requests page's "waiting" count
  return (bookings ?? []).filter((b) => b.status === 'pending').length
}
