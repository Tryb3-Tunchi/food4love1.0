import { useQuery } from '@tanstack/react-query'
import { getMatches } from '@/services/matches'
import { useAuthStore } from '@/stores/useAuthStore'

export function useMatches() {
  const profile = useAuthStore((s) => s.profile)
  return useQuery({
    queryKey: ['matches', profile?.id],
    queryFn: () => getMatches(profile!.id),
    enabled: !!profile?.id,
    refetchInterval: 30_000,
  })
}
