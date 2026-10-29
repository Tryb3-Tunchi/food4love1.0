import { createClient } from '@/lib/supabase/client'

export async function recordSwipe(
  swipedId: string,
  action: 'like' | 'pass' | 'superlike',
): Promise<{ match: boolean; match_id?: string }> {
  const response = await fetch('/api/swipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_id: swipedId, action }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error || 'Could not save this swipe')
  }
  return result
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
