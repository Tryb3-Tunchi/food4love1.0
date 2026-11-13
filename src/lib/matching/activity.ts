// Pure module with NO imports so it can be unit-tested with node --test.

export interface PersonPreview {
  id: string
  role: 'cook' | 'buyer' | string
  full_name: string | null
  avatar_url: string | null
}

export interface LikeRow {
  created_at: string
  action?: string
  person: PersonPreview
}

export interface MatchRow {
  id: string
  created_at: string
  person: PersonPreview
}

export type ActivityKind = 'match' | 'like_received' | 'like_sent'

export interface ActivityEvent {
  key: string
  kind: ActivityKind
  at: string
  person: PersonPreview
}

// "New activity": recent likes and matches, newest first. Someone you matched
// with shows ONE event (the match), not a like plus a match for the same person,
// so the feed is never noisy or contradictory. Rows without a valid person or
// date are dropped instead of rendering as broken cards.
export function buildActivity(input: {
  received: LikeRow[]
  sent: LikeRow[]
  matches: MatchRow[]
  limit?: number
}): ActivityEvent[] {
  const matched = new Set(
    input.matches.map((m) => m.person?.id).filter(Boolean),
  )
  const events: ActivityEvent[] = []
  const valid = (id: unknown, at: unknown) =>
    typeof id === 'string' &&
    typeof at === 'string' &&
    !Number.isNaN(Date.parse(at))

  for (const m of input.matches) {
    if (valid(m.person?.id, m.created_at)) {
      events.push({
        key: `match:${m.id}`,
        kind: 'match',
        at: m.created_at,
        person: m.person,
      })
    }
  }
  for (const l of input.received) {
    if (valid(l.person?.id, l.created_at) && !matched.has(l.person.id)) {
      events.push({
        key: `received:${l.person.id}`,
        kind: 'like_received',
        at: l.created_at,
        person: l.person,
      })
    }
  }
  for (const l of input.sent) {
    if (valid(l.person?.id, l.created_at) && !matched.has(l.person.id)) {
      events.push({
        key: `sent:${l.person.id}`,
        kind: 'like_sent',
        at: l.created_at,
        person: l.person,
      })
    }
  }
  const seen = new Set<string>()
  return events
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .filter((e) => (seen.has(e.key) ? false : (seen.add(e.key), true)))
    .slice(0, input.limit ?? 20)
}

// Likes someone sent you that you have not answered yet (no swipe back, no match).
export function pendingLikes(
  received: LikeRow[],
  answeredIds: Iterable<string>,
): LikeRow[] {
  const answered = new Set(answeredIds)
  return received.filter((l) => !answered.has(l.person.id))
}

// A like you sent is either already a match or still waiting for an answer.
export function sentLikeState(
  personId: string,
  matchedIds: Iterable<string>,
): 'matched' | 'waiting' {
  for (const id of matchedIds) if (id === personId) return 'matched'
  return 'waiting'
}

export function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
}
