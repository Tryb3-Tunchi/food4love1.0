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
