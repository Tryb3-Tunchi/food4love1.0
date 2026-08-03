import { createClient } from '@/lib/supabase/client'

export async function recordSwipe(
  swiperId: string,
  swipedId: string,
  action: 'like' | 'pass' | 'superlike',
) {
  const supabase = createClient()
  const { error } = await supabase.from('swipes').insert({
    swiper_id: swiperId,
    swiped_id: swipedId,
    action,
  })
  if (error) throw error
}

export async function checkMutualLike(user1: string, user2: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('swipes')
    .select('id')
    .eq('swiper_id', user2)
    .eq('swiped_id', user1)
    .in('action', ['like', 'superlike'])
    .single()

  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
  return !!data
}

export async function getSwipesForUser(userId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('swipes')
    .select('swiped_id, action')
    .eq('swiper_id', userId)

  if (error) throw error
  return data ?? []
}
