import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useMessages(matchId: string) {
  const queryClient = useQueryClient()

  const messagesQuery = useQuery({
    queryKey: ['messages', matchId],
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data
    },
  })

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const {
        data: { user },
      } = await createClient().auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await createClient().from('messages').insert({
        match_id: matchId,
        sender_id: user.id,
        content,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', matchId] })
      queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
  })

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ['messages', matchId],
          })
          void queryClient.invalidateQueries({ queryKey: ['matches'] })
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Close the gap between the initial history fetch and joining realtime.
          void queryClient.invalidateQueries({
            queryKey: ['messages', matchId],
          })
          void queryClient.invalidateQueries({ queryKey: ['matches'] })
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [matchId, queryClient])

  return {
    messages: messagesQuery.data || [],
    isLoading: messagesQuery.isLoading,
    sendMessage,
  }
}
