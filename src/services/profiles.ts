import { supabase } from '@/lib/supabase'
import { Profile } from '@/types/db'
import {
  PUBLIC_PROFILE_SELECT,
  touchesPrivateColumns,
} from '@/lib/profileColumns'
import { fetchOwnPrivate } from '@/services/ownProfile'

export async function getProfile(id: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_SELECT)
    .eq('id', id)
    .single()

  if (error) throw error
  // A member's own profile also carries their private settings.
  const { data: session } = await supabase.auth.getSession()
  if (session.session?.user.id === id) {
    return {
      ...(data as unknown as Profile),
      ...(await fetchOwnPrivate(supabase, id)),
    }
  }
  return data as unknown as Profile
}

export async function updateProfile(
  id: string,
  updates: Partial<Profile>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select(PUBLIC_PROFILE_SELECT)
    .single()

  if (error) throw error
  // The database can adjust private fields on save (for example the consent
  // timestamp), so read them back for the owner when they were part of the change.
  const own = touchesPrivateColumns(updates)
    ? await fetchOwnPrivate(supabase, id)
    : {}
  return { ...(data as unknown as Profile), ...own }
}

export async function getSwipeDeck(
  userId?: string,
  filters?: { cuisines?: string[]; priceMax?: number; distance?: number },
) {
  let query = supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_SELECT)
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
