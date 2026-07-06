import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Match } from '../types/db'

type UseMatchState = {
  isLoading: boolean
  matches: Match[]
  refresh: () => Promise<void>
}

export function useMatch(userId: string | null): UseMatchState {
  const [isLoading, setIsLoading] = useState(true)
  const [matches, setMatches] = useState<Match[]>([])

  const refresh = useCallback(async () => {
    if (!userId) {
      setMatches([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .or(`buyer_id.eq.${userId},cook_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (error) throw error
    setMatches((data as Match[]) ?? [])
    setIsLoading(false)
  }, [userId])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  return useMemo(() => ({ isLoading, matches, refresh }), [isLoading, matches, refresh])
}
