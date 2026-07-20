import { useQuery } from '@tanstack/react-query'
import { getSwipeDeck } from '@/services/profiles'
import { useAuthStore } from '@/stores/useAuthStore'

export function useSwipeDeck(filters?: {
  cuisines?: string[]
  priceMax?: number
  distance?: number
}) {
  const profile = useAuthStore((s) => s.profile)

  return useQuery({
    queryKey: ['swipe-deck', profile?.id || 'guest', filters],
    queryFn: () => getSwipeDeck(profile?.id, filters),
    // Allow query to execute even if profile is not loaded yet in dev mode:
    enabled: true,
    staleTime: 5 * 60 * 1000,
  })
}
