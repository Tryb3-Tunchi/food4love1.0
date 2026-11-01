import { getMyBookings } from '@/services/bookings'
import { getDailySpecialsByCook } from '@/services/dailySpecials'
import { getPostsByCook } from '@/services/posts'
import { getReviewsForProfile, getReviewStats } from '@/services/reviews'
import { getMatchRequests } from '@/services/cookRequests'

async function orEmpty<T>(request: Promise<T[]>): Promise<T[]> {
  try {
    return await request
  } catch {
    return []
  }
}

export async function getCookDashboard(cookId: string) {
  const [bookings, specials, posts, reviews, reviewStats, matchRequests] =
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
      orEmpty(getMatchRequests(cookId)),
    ])

  return {
    bookings,
    specials,
    posts,
    reviews,
    reviewStats,
    newRequests: matchRequests.length,
  }
}
