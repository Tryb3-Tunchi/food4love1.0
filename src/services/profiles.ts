import { supabase } from '@/lib/supabase'

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
