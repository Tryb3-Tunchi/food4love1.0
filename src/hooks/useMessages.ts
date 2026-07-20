import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMessages, sendMessage, markMessagesRead } from '@/services/messages'
import { useAuthStore } from '@/stores/useAuthStore'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useMessages(matchId: string) {
  const qc = useQueryClient()
  const profile = useAuthStore((s) => s.profile)

  const query = useQuery({
    queryKey: ['messages', matchId],
    queryFn: () => getMessages(matchId),
    enabled: !!matchId,
  })

  useEffect(() => {
    const sb = createClient()
    const channel = sb
      .channel(`messages:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        () => qc.invalidateQueries({ queryKey: ['messages', matchId] }),
      )
      .subscribe()
    return () => {
      sb.removeChannel(channel)
    }
  }, [matchId, qc])

  const send = useMutation({
    mutationFn: (content: string) => sendMessage(matchId, profile!.id, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', matchId] }),
  })

  useEffect(() => {
    if (profile?.id && matchId) markMessagesRead(matchId, profile.id)
  }, [matchId, profile?.id])

  return { ...query, send }
}
