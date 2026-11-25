'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getUnreadCount,
  getNotifications,
  markAllAsRead,
  markAsRead,
  type Notification,
} from '@/services/notifications'

// Shared, reference-counted Realtime subscriptions (keyed by member id).
const liveChannels = new Map<string, { refs: number; remove: () => void }>()
function releaseLiveChannel(userId: string) {
  const entry = liveChannels.get(userId)
  if (!entry) return
  entry.refs--
  if (entry.refs <= 0) {
    entry.remove()
    liveChannels.delete(userId)
  }
}

export function useNotifications() {
  const profile = useAuthStore((s) => s.profile)
  const userId = profile?.id
  const preferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...profile?.notification_preferences,
  }
  const preferencesKey = JSON.stringify(preferences)
  const queryClient = useQueryClient()

  const unreadQuery = useQuery({
    queryKey: ['notifications-unread', userId, preferencesKey],
    queryFn: () => (userId ? getUnreadCount(userId, preferences) : 0),
    enabled: !!userId,
    refetchInterval: 30000,
  })

  const notificationsQuery = useQuery({
    queryKey: ['notifications', userId, preferencesKey],
    queryFn: () => (userId ? getNotifications(userId, 20, preferences) : []),
    enabled: !!userId,
  })

  useEffect(() => {
    if (!userId) return
    // One Realtime channel per signed-in member, however many components use this hook
    // (the bell, the bottom navigation, the notifications page).
    const shared = liveChannels.get(userId)
    if (shared) {
      shared.refs++
      return () => releaseLiveChannel(userId)
    }

    const supabase = createClient()

    const channelName = `notifications-${userId}-${crypto.randomUUID()}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({
            queryKey: ['notifications-unread', userId],
          })
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
          // Live sync: the database already writes a notification when someone
          // likes you or you match, so that single event also refreshes the
          // likes, matches and counts without a page reload (no extra channel).
          const kind = (payload.new as { type?: string } | null)?.type
          // Booking updates and verification changes refresh the booking screens too.
          if (kind === 'booking' || kind === 'system') {
            queryClient.invalidateQueries({ queryKey: ['bookings'] })
            queryClient.invalidateQueries({ queryKey: ['cook-bookings'] })
            queryClient.invalidateQueries({ queryKey: ['booking-status'] })
          }
          // A new chat message: the chat list and the Chat tab badge refresh (both use 'matches').
          if (kind === 'message') {
            queryClient.invalidateQueries({ queryKey: ['matches'] })
          }
          if (kind === 'like' || kind === 'match') {
            queryClient.invalidateQueries({ queryKey: ['likes'] })
            queryClient.invalidateQueries({ queryKey: ['match-requests'] })
            queryClient.invalidateQueries({ queryKey: ['matches'] })
            queryClient.invalidateQueries({ queryKey: ['member-access'] })
          }
        },
      )
      // Read state changed (this tab, another tab, or another device).
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['notifications-unread', userId],
          })
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          queryClient.invalidateQueries({
            queryKey: ['notifications-unread', userId],
          })
          queryClient.invalidateQueries({
            queryKey: ['notifications', userId],
          })
        }
      })

    liveChannels.set(userId, {
      refs: 1,
      remove: () => void supabase.removeChannel(channel),
    })
    return () => releaseLiveChannel(userId)
  }, [userId, queryClient])

  const refetch = () => {
    queryClient.invalidateQueries({
      queryKey: ['notifications-unread', userId],
    })
    queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
  }

  // Updates the screen first so the badge drops at once, then asks the database.
  // If the database changed nothing (or failed) the cache is refetched, so the
  // badge can never stay lowered while the stored state is still unread.
  const markRead = async (id: string): Promise<boolean> => {
    if (!userId) return false
    const target = (
      queryClient.getQueriesData<Notification[]>({
        queryKey: ['notifications', userId],
      }) ?? []
    )
      .flatMap(([, list]) => list ?? [])
      .find((item) => item.id === id)
    if (!target || target.read) return true

    queryClient.setQueriesData<Notification[]>(
      { queryKey: ['notifications', userId] },
      (list) =>
        list?.map((item) => (item.id === id ? { ...item, read: true } : item)),
    )
    queryClient.setQueriesData<number>(
      { queryKey: ['notifications-unread', userId] },
      (count) => Math.max(0, (count ?? 0) - 1),
    )
    try {
      const changed = await markAsRead(id, userId)
      if (changed === 0) {
        refetch()
        return false
      }
      return true
    } catch {
      refetch()
      return false
    }
  }

  const markEverythingRead = async (): Promise<boolean> => {
    if (!userId) return false
    try {
      const changed = await markAllAsRead(userId)
      refetch()
      return changed > 0
    } catch {
      refetch()
      return false
    }
  }

  return {
    unreadCount: unreadQuery.data ?? 0,
    notifications: notificationsQuery.data ?? [],
    isLoading: unreadQuery.isLoading || notificationsQuery.isLoading,
    error: notificationsQuery.error,
    refetch,
    markRead,
    markEverythingRead,
  }
}
