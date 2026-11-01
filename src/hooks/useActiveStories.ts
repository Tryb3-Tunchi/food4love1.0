import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Story } from '@/types/db'

// A chef's stories that are still live, oldest first so they play in order.
export function useActiveStories(cookId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ['active-stories', cookId],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('stories')
        .select('*')
        .eq('cook_id', cookId!)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Story[]
    },
    enabled: !!cookId && enabled,
    staleTime: 60_000,
  })
}
