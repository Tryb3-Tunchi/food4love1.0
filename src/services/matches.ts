import { createClient } from '@/lib/supabase/client'

export async function createMatch(user1Id: string, user2Id: string) {
  const supabase = createClient()

  // Check if match already exists
  const { data: existing } = await supabase
    .from('matches')
    .select('id')
    .or(
      `and(user1_id.eq.${user1Id},user2_id.eq.${user2Id}),and(user1_id.eq.${user2Id},user2_id.eq.${user1Id})`,
    )
    .single()

  if (existing) return existing

  const { data, error } = await supabase
    .from('matches')
    .insert({
      user1_id: user1Id,
      user2_id: user2Id,
      status: 'matched',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}
