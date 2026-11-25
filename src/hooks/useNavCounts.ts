'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'
import { getMyBookings } from '@/services/bookings'
import { getMatchRequests } from '@/services/cookRequests'
import {
  countNewMatches,
  countPendingBookings,
  type NavCounts,
} from '@/lib/navBadges'

// The real numbers behind the bottom-navigation badges (never the notification total).
//
// Cheap by design: head-only counts, the embedded first message only, and for cooks the SAME
// query keys and functions as the Requests page, so the page and the badge share one cached
// result instead of fetching twice. RLS scopes every query to the signed-in member.
//
// Freshness without new subscriptions or polling:
//  * the chat/match keys start with 'matches', so every existing ['matches'] invalidation
//    (match/message realtime, marking a chat read, like/match/message notifications) refreshes them;
//  * the cook keys are already invalidated by booking/like notifications;
//  * changing page refreshes them once (a member who just read a chat sees the badge go).
export function useNavCounts(): NavCounts {
  const profile = useAuthStore((state) => state.profile)
  const userId = profile?.id
  const isCook = profile?.role === 'cook'
  const queryClient = useQueryClient()
  const pathname = usePathname()

  const unreadMessages = useQuery({
    queryKey: ['matches', 'nav-unread-messages', userId],
    enabled: !!userId,
    staleTime: 15_000,
    queryFn: async () => {
      // Messages sent TO this member that they have not read. RLS returns only messages of
      // conversations this member belongs to; their own messages are excluded explicitly.
      const { count, error } = await createClient()
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .neq('sender_id', userId!)
        .is('read_at', null)
      if (error) throw error
      return count ?? 0
    },
  })

  const newMatches = useQuery({
    queryKey: ['matches', 'nav-new-matches', userId],
    enabled: !!userId && !isCook,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('matches')
        .select('id, messages(id)')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .eq('status', 'matched')
        .order('created_at', { ascending: false })
        .limit(1, { referencedTable: 'messages' })
        .limit(100)
      if (error) throw error
      return countNewMatches(data)
    },
  })

  // Same keys and functions as src/app/(app)/requests/page.tsx (shared cache).
  const cookBookings = useQuery({
    queryKey: ['cook-bookings', userId],
    enabled: !!userId && isCook,
    staleTime: 15_000,
    queryFn: () => getMyBookings(userId!, 'cook'),
  })
  const likeRequests = useQuery({
    queryKey: ['match-requests', userId],
    enabled: !!userId && isCook,
    staleTime: 15_000,
    queryFn: () => getMatchRequests(userId!),
  })

  useEffect(() => {
    if (!userId) return
    void queryClient.invalidateQueries({
      queryKey: ['matches', 'nav-unread-messages', userId],
    })
    if (!isCook)
      void queryClient.invalidateQueries({
        queryKey: ['matches', 'nav-new-matches', userId],
      })
  }, [pathname, userId, isCook, queryClient])

  return {
    unreadMessages: unreadMessages.data ?? 0,
    newMatches: isCook ? 0 : (newMatches.data ?? 0),
    pendingBookings: isCook ? countPendingBookings(cookBookings.data) : 0,
    pendingLikeRequests: isCook ? (likeRequests.data?.length ?? 0) : 0,
  }
}
