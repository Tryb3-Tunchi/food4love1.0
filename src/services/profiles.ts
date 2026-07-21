import { supabase } from '@/lib/supabase'
import { Profile } from '@/types/db'

export async function getProfile(id: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Profile
}

export async function updateProfile(
  id: string,
  updates: Partial<Profile>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as Profile
}

export async function getSwipeDeck(
  userId?: string,
  filters?: { cuisines?: string[]; priceMax?: number; distance?: number },
) {
  let query = supabase
    .from('profiles')
    .select('*')
    .eq('role', 'cook') // <-- MUST BE 'cook' NOT 'chef'
    .eq('onboarding_complete', true)

  // Exclude current user if logged in
  if (userId) {
    query = query.neq('id', userId)
  }

  // Apply price filter if provided
  if (filters?.priceMax) {
    query = query.lte('price_min', filters.priceMax)
  }

  // Apply cuisines filter if provided
  if (filters?.cuisines && filters.cuisines.length > 0) {
    query = query.overlaps('cuisines', filters.cuisines)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error in getSwipeDeck:', error)
    return []
  }

  return data || []
}
