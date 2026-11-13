'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchLikes, type LikeItem } from '@/services/likes'
import { useAuthStore } from '@/stores/useAuthStore'

// Likes received / sent, newest first, loaded 30 at a time. The query key starts
// with 'likes', so one invalidate from the live-sync handlers refreshes both lists.
export function useLikes(type: 'received' | 'sent') {
  const userId = useAuthStore((s) => s.profile?.id)
  const query = useInfiniteQuery({
    queryKey: ['likes', type, userId],
    enabled: !!userId,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchLikes(type, pageParam),
    getNextPageParam: (last) => last.next,
    staleTime: 15_000,
  })
  const seen = new Set<string>()
  const items: LikeItem[] = (query.data?.pages ?? [])
    .flatMap((page) => page.items)
    .filter((item) =>
      seen.has(item.person.id) ? false : (seen.add(item.person.id), true),
    )
  return {
    ...query,
    items,
    total: query.data?.pages[0]?.total ?? 0,
  }
}
