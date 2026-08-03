import { createClient } from '@/lib/supabase/client'

export interface ReviewWithReviewer {
  id: string
  booking_id: string
  reviewer_id: string
  reviewee_id: string
  rating: number
  comment: string
  created_at: string
  reviewer: {
    full_name: string
    avatar_url: string | null
  } | null
}

export async function getReviewsForProfile(profileId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('reviews')
    .select(`*, reviewer:profiles!reviewer_id(full_name, avatar_url)`)
    .eq('reviewee_id', profileId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ReviewWithReviewer[]
}

export async function getReviewStats(profileId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('reviewee_id', profileId)

  if (error) throw error

  const ratings = data?.map((r) => r.rating) ?? []
  const avg =
    ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0

  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: ratings.filter((r) => r === star).length,
  }))

  return {
    average: Number(avg.toFixed(1)),
    count: ratings.length,
    distribution,
  }
}
