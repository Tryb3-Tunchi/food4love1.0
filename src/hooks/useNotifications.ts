'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  getUnreadCount,
  getNotifications,
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
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createClient>['channel']
  > | null>(null)

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

    // Use a unique channel name per mount to avoid collision
    const channelName = `notifications-${userId}-${Date.now()}`
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
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [userId, queryClient])

  return {
    unreadCount: unreadQuery.data ?? 0,
    notifications: notificationsQuery.data ?? [],
    isLoading: unreadQuery.isLoading || notificationsQuery.isLoading,
    error: notificationsQuery.error,
    refetch: () => {
      queryClient.invalidateQueries({
        queryKey: ['notifications-unread', userId],
      })
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  }
}
