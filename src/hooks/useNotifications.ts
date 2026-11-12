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
        () => {
          queryClient.invalidateQueries({
            queryKey: ['notifications-unread', userId],
          })
          queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
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

    return () => {
      void supabase.removeChannel(channel)
    }
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
