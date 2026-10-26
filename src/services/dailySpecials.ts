import { createClient } from '@/lib/supabase/client'

export async function getDailySpecialsByCook(cookId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('daily_specials')
    .select('*')
    .eq('cook_id', cookId)
    .gte('available_until', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getAllActiveSpecials() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('daily_specials')
    .select(`*, cook:profiles(id, full_name, avatar_url, rating)`)
    .gte('available_until', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export interface DailySpecialChanges {
  title?: string
  description?: string | null
  price?: number
  image_url?: string | null
  available_until?: string
  is_paused?: boolean
  serving_size?: number | null
  lead_time_hours?: number | null
  fulfillment_options?: string[] | null
  fulfillment_notes?: string | null
  ingredients?: string | null
  allergens?: string[] | null
  portions_available?: number | null
}

export interface DailySpecialInput extends DailySpecialChanges {
  cook_id: string
  title: string
  price: number
  available_until: string
}

export async function createDailySpecial(special: DailySpecialInput) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('daily_specials')
    .insert(special)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateDailySpecial(
  id: string,
  changes: DailySpecialChanges,
) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('daily_specials')
    .update(changes)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteDailySpecial(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('daily_specials').delete().eq('id', id)
  if (error) throw error
}
