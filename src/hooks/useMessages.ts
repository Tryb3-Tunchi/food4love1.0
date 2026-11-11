import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  markConversationRead,
  sendMessage as insertMessage,
} from '@/services/messages'
import type { Message } from '@/types/db'

export type DisplayMessage = Message & { status?: 'sending' | 'failed' }

interface OutboxItem {
  tempId: string
  content: string
  status: 'sending' | 'failed'
  created_at: string
}

const byCreatedAt = (a: Message, b: Message) =>
  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()

export function useMessages(matchId: string, userId: string | undefined) {
  const queryClient = useQueryClient()
  const messagesKey = useMemo(() => ['messages', matchId], [matchId])
  const [outbox, setOutbox] = useState<OutboxItem[]>([])

  const messagesQuery = useQuery({
    queryKey: messagesKey,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as Message[]
    },
  })

  // One place that adds or updates a stored message, keyed by id. The send
  // response and the realtime echo of the same row both land here, so the same
  // message can never appear twice.
  const upsertStored = useCallback(
    (row: Message) => {
      queryClient.setQueryData<Message[]>(messagesKey, (old = []) => {
        const exists = old.some((m) => m.id === row.id)
        const next = exists
          ? old.map((m) => (m.id === row.id ? { ...m, ...row } : m))
          : [...old, row]
        return next.sort(byCreatedAt)
      })
      void queryClient.invalidateQueries({ queryKey: ['matches'] })
    },
    [queryClient, messagesKey],
  )

  const deliver = useCallback(
    async (tempId: string, content: string) => {
      if (!userId) {
        setOutbox((items) =>
          items.map((i) =>
            i.tempId === tempId ? { ...i, status: 'failed' } : i,
          ),
        )
        return
      }
      try {
        const saved = await insertMessage(matchId, userId, content)
        upsertStored(saved)
        setOutbox((items) => items.filter((i) => i.tempId !== tempId))
      } catch {
        setOutbox((items) =>
          items.map((i) =>
            i.tempId === tempId ? { ...i, status: 'failed' } : i,
          ),
        )
      }
    },
    [matchId, userId, upsertStored],
  )

  const send = useCallback(
    (raw: string) => {
      const content = raw.trim()
      if (!content) return
      const tempId = `pending-${crypto.randomUUID()}`
      setOutbox((items) => [
        ...items,
        {
          tempId,
          content,
          status: 'sending',
          created_at: new Date().toISOString(),
        },
      ])
      void deliver(tempId, content)
    },
    [deliver],
  )

  const retry = useCallback(
    (tempId: string) => {
      const item = outbox.find((i) => i.tempId === tempId)
      if (!item) return
      setOutbox((items) =>
        items.map((i) =>
          i.tempId === tempId ? { ...i, status: 'sending' } : i,
        ),
      )
      void deliver(tempId, item.content)
    },
    [outbox, deliver],
  )

  const discard = useCallback((tempId: string) => {
    setOutbox((items) => items.filter((i) => i.tempId !== tempId))
  }, [])

  // Realtime: new rows and read-receipt updates for this conversation only.
  useEffect(() => {
    const supabase = createClient()
    const refetch = () =>
      void queryClient.invalidateQueries({ queryKey: messagesKey })
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const channel = supabase
      .channel(`messages:${matchId}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => upsertStored(payload.new as Message),
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => upsertStored(payload.new as Message),
      )
      .subscribe((status) => {
        // Joining or re-joining closes any gap since the last fetch.
        if (status === 'SUBSCRIBED') refetch()
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(retryTimer)
          retryTimer = setTimeout(refetch, 4000)
        }
      })

    // Coming back to a backgrounded phone tab: catch up on anything missed.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [matchId, messagesKey, queryClient, upsertStored])

  // Read receipts: when the other person's messages are on screen, store that.
  const stored = messagesQuery.data
  const markedRef = useRef<string>('')
  useEffect(() => {
    if (!userId || !stored) return
    const unread = stored.filter((m) => m.sender_id !== userId && !m.read_at)
    if (unread.length === 0) return
    const signature = unread.map((m) => m.id).join(',')
    if (markedRef.current === signature) return
    markedRef.current = signature
    void markConversationRead(matchId, userId).then((saved) => {
      if (!saved) {
        markedRef.current = ''
        return
      }
      const readAt = new Date().toISOString()
      queryClient.setQueryData<Message[]>(messagesKey, (old = []) =>
        old.map((m) =>
          m.sender_id !== userId && !m.read_at ? { ...m, read_at: readAt } : m,
        ),
      )
      void queryClient.invalidateQueries({ queryKey: ['matches'] })
    })
  }, [stored, userId, matchId, messagesKey, queryClient])

  const messages: DisplayMessage[] = useMemo(() => {
    const pending: DisplayMessage[] = outbox.map((item) => ({
      id: item.tempId,
      match_id: matchId,
      sender_id: userId ?? '',
      content: item.content,
      created_at: item.created_at,
      status: item.status,
    }))
    return [...(stored ?? []), ...pending]
  }, [stored, outbox, matchId, userId])

  return {
    messages,
    isLoading: messagesQuery.isLoading,
    error: messagesQuery.error,
    refetch: () => messagesQuery.refetch(),
    send,
    retry,
    discard,
  }
}
