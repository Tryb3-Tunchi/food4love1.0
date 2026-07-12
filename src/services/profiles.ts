import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/db'

const sb = () => createClient()

export async function getProfile(id: string): Promise<Profile | null> {
  const { data } = await sb().from('profiles').select('*').eq('id', id).single()
  return data
}

export async function updateProfile(id: string, updates: Partial<Profile>) {
  const { data, error } = await sb()
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getSwipeDeck(
  userId: string,
  filters?: { cuisines?: string[]; priceMax?: number },
): Promise<Profile[]> {
  let query = sb()
    .from('profiles')
    .select('*, daily_special:daily_specials(*)')
    .eq('role', 'cook')
    .eq('onboarding_complete', true)
    .neq('id', userId)
    .not(
      'id',
      'in',
      `(SELECT swiped_id FROM swipes WHERE swiper_id = '${userId}')`,
    )
    .limit(20)

  if (filters?.cuisines?.length)
    query = query.overlaps('cuisines', filters.cuisines)
  if (filters?.priceMax) query = query.lte('price_min', filters.priceMax)

  const { data } = await query
  return data ?? []
}
