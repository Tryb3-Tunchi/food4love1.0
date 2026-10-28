import { createClient } from '@/lib/supabase/client'
import type { CookAvailability } from '@/types/db'

export async function getCookAvailability(cookId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('cook_availability')
    .select('*')
    .eq('cook_id', cookId)
    .maybeSingle()

  if (error) return null
  return data as CookAvailability | null
}

export async function saveCookAvailability(
  cookId: string,
  values: Omit<CookAvailability, 'cook_id' | 'updated_at'>,
) {
  const supabase = createClient()
  const { error } = await supabase.from('cook_availability').upsert(
    {
      cook_id: cookId,
      ...values,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'cook_id' },
  )

  if (error) throw error
}
