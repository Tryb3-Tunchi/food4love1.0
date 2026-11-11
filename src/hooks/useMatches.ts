import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface MatchProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: 'cook' | 'buyer' | string | null
  is_verified?: boolean | null
}

export interface MatchListItem {
  id: string
  user1_id: string
  user2_id: string
  status: string
  expires_at: string
  created_at: string
  other_user: MatchProfile
  // True when the profile join came back empty. The match is still shown so a
  // notification never points at a match that the list silently hides.
  profile_missing: boolean
  last_message: {
    content: string
    created_at: string
    sender_id: string | null
    read_at?: string | null
  } | null
  unread_count: number
}

const PROFILE_FIELDS = 'id, full_name, avatar_url, role, is_verified'

export function useMatches() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['matches'],
    queryFn: async (): Promise<MatchListItem[]> => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('matches')
        .select(
          `
          *,
          user1:profiles!matches_user1_id_fkey(${PROFILE_FIELDS}),
          user2:profiles!matches_user2_id_fkey(${PROFILE_FIELDS}),
          last_message:messages(content, created_at, sender_id, read_at)
        `,
        )
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .eq('status', 'matched')
        .order('created_at', { ascending: false })
        // Only the newest message per match, not the whole conversation.
        .order('created_at', { referencedTable: 'messages', ascending: false })
        .limit(1, { referencedTable: 'messages' })

      if (error) throw error
      const rows = data ?? []

      // Unread = messages from the other person with no read_at, straight from
      // the stored state rather than guessed in the UI.
      const unreadByMatch = new Map<string, number>()
      if (rows.length > 0) {
        const { data: unread } = await supabase
          .from('messages')
          .select('match_id')
          .in(
            'match_id',
            rows.map((match) => match.id),
          )
          .neq('sender_id', user.id)
          .is('read_at', null)
        for (const row of unread ?? []) {
          unreadByMatch.set(
            row.match_id,
            (unreadByMatch.get(row.match_id) ?? 0) + 1,
          )
        }
      }

      return rows.map((match): MatchListItem => {
        const otherUser = (
          match.user1_id === user.id ? match.user2 : match.user1
        ) as MatchProfile | null
        const otherId =
          match.user1_id === user.id ? match.user2_id : match.user1_id
        return {
          id: match.id,
          user1_id: match.user1_id,
          user2_id: match.user2_id,
          status: match.status,
          expires_at: match.expires_at,
          created_at: match.created_at,
          other_user: otherUser ?? {
            id: otherId,
            full_name: null,
            avatar_url: null,
            role: null,
            is_verified: null,
          },
          profile_missing: !otherUser,
          last_message: match.last_message?.[0] ?? null,
          unread_count: unreadByMatch.get(match.id) ?? 0,
        }
      })
    },
  })

  useEffect(() => {
    const supabase = createClient()
    const refreshMatches = () => {
      void queryClient.invalidateQueries({ queryKey: ['matches'] })
    }
    const channel = supabase
      .channel(`my-matches-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        refreshMatches,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        refreshMatches,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        refreshMatches,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refreshMatches()
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  return query
}
