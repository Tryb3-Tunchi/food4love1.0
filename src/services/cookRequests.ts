import { createClient } from '@/lib/supabase/client'
import { recordSwipe } from '@/services/swipes'
import { fetchLikes } from '@/services/likes'

export interface MatchRequest {
  id: string
  swiper_id: string
  created_at: string
  swiper: {
    id: string
    full_name: string | null
    avatar_url: string | null
    role: string | null
    is_verified: boolean | null
    bio: string | null
    location: string | null
  } | null
}

// Food lovers who liked this chef and have not been answered yet. Incoming
// swipes are private under RLS, so the authenticated likes endpoint performs
// the scoped read and returns only safe profile fields.
export async function getMatchRequests(
  cookId: string,
): Promise<MatchRequest[]> {
  const {
    data: { user },
    error: authError,
  } = await createClient().auth.getUser()
  if (authError || !user || user.id !== cookId) {
    throw new Error('Could not verify this cook account')
  }

  const requests: MatchRequest[] = []
  const seen = new Set<string>()
  let before: string | null = null

  do {
    const page = await fetchLikes('received', before)
    for (const item of page.items) {
      const person = item.person
      if (
        item.state !== 'pending' ||
        person.role !== 'buyer' ||
        seen.has(person.id)
      ) {
        continue
      }
      seen.add(person.id)
      requests.push({
        id: person.id,
        swiper_id: person.id,
        created_at: item.created_at,
        swiper: {
          id: person.id,
          full_name: person.full_name,
          avatar_url: person.avatar_url,
          role: person.role,
          is_verified: person.is_verified,
          bio: person.bio,
          location: null,
        },
      })
    }

    // A malformed/repeated cursor must not trap the Requests screen in a loop.
    if (!page.next || page.next === before) break
    before = page.next
  } while (before)

  return requests
}

// Saves the chef's answer so the request does not come back. Accepting also
// opens the match, so both can start chatting. The server does both in one
// step, so the swipe and the match can never get out of sync.
export async function respondToMatchRequest(
  buyerId: string,
  decision: 'accept' | 'decline',
): Promise<{ id: string } | null> {
  const result = await recordSwipe(
    buyerId,
    decision === 'accept' ? 'like' : 'pass',
  )
  if (decision === 'decline' || !result.match_id) return null
  return { id: result.match_id }
}
