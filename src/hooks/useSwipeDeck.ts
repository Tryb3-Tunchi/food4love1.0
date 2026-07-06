import { useQuery } from "@tanstack/react-query";
import { getSwipeDeck } from "@/services/profiles";
import { useAuthStore } from "@/stores/useAuthStore";

export function useSwipeDeck(filters?: { cuisines?: string[]; priceMax?: number }) {
  const profile = useAuthStore((s) => s.profile);
  return useQuery({
    queryKey: ["swipe-deck", profile?.id, filters],
    queryFn: () => getSwipeDeck(profile!.id, filters),
    enabled: !!profile?.id,
    staleTime: 5 * 60 * 1000,
  });
}
