import { createClient } from '@/lib/supabase/client'
import { getMyBookings } from '@/services/bookings'
import { getDailySpecialsByCook } from '@/services/dailySpecials'
import { getPostsByCook } from '@/services/posts'
import { getReviewsForProfile, getReviewStats } from '@/services/reviews'

async function orEmpty<T>(request: Promise<T[]>): Promise<T[]> {
  try {
    return await request
  } catch {
    return []
  }
}

export async function getCookDashboard(cookId: string) {
  const supabase = createClient()

  const [bookings, specials, posts, reviews, reviewStats, likes, matches] =
    await Promise.all([
      orEmpty(getMyBookings(cookId, 'cook')),
      orEmpty(getDailySpecialsByCook(cookId)),
      orEmpty(getPostsByCook(cookId)),
      orEmpty(getReviewsForProfile(cookId)),
      getReviewStats(cookId).catch(() => ({
        average: 0,
        count: 0,
        distribution: [],
      })),
      supabase
        .from('swipes')
        .select('swiper_id')
        .eq('swiped_id', cookId)
        .eq('action', 'like'),
      supabase
        .from('matches')
        .select('user1_id, user2_id')
        .or(`user1_id.eq.${cookId},user2_id.eq.${cookId}`),
    ])

  const matchedIds = new Set(
    (matches.data ?? []).flatMap((m) => [m.user1_id, m.user2_id]),
  )
  const newRequests = (likes.data ?? []).filter(
    (like) => !matchedIds.has(like.swiper_id),
  ).length

  return { bookings, specials, posts, reviews, reviewStats, newRequests }
}
