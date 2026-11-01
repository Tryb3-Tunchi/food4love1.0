import { createClient } from '@/lib/supabase/client'
import { createMatch } from '@/services/matches'

export interface MatchRequest {
  id: string
  swiper_id: string
  created_at: string
  swiper: {
    id: string
    full_name: string | null
    avatar_url: string | null
    bio: string | null
    location: string | null
  } | null
}

// Food lovers who liked this chef and have not been answered yet. A like is
// answered once the chef has swiped on them back, or a match exists.
export async function getMatchRequests(
  cookId: string,
): Promise<MatchRequest[]> {
  const supabase = createClient()

  const [likes, mine, matches] = await Promise.all([
    supabase
      .from('swipes')
      .select(
        'id, swiper_id, created_at, swiper:profiles!swipes_swiper_id_fkey(id, full_name, avatar_url, bio, location)',
      )
      .eq('swiped_id', cookId)
      .in('action', ['like', 'superlike'])
      .order('created_at', { ascending: false }),
    supabase.from('swipes').select('swiped_id').eq('swiper_id', cookId),
    supabase
      .from('matches')
      .select('user1_id, user2_id')
      .or(`user1_id.eq.${cookId},user2_id.eq.${cookId}`),
  ])

  if (likes.error) throw likes.error

  const answered = new Set<string>([
    ...(mine.data ?? []).map((swipe) => swipe.swiped_id),
    ...(matches.data ?? []).flatMap((match) => [
      match.user1_id,
      match.user2_id,
    ]),
  ])

  return ((likes.data ?? []) as unknown as MatchRequest[]).filter(
    (request) => !answered.has(request.swiper_id),
  )
}

// Saves the chef's answer so the request does not come back. Accepting also
// opens the match, so both can start chatting.
export async function respondToMatchRequest(
  cookId: string,
  buyerId: string,
  decision: 'accept' | 'decline',
) {
  const supabase = createClient()
  const { error } = await supabase.from('swipes').insert({
    swiper_id: cookId,
    swiped_id: buyerId,
    action: decision === 'accept' ? 'like' : 'pass',
  })
  // 23505: the chef already swiped on this person, which is fine.
  if (error && error.code !== '23505') throw error

  if (decision === 'decline') return null
  return createMatch(buyerId, cookId)
}
