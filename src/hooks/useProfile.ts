import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProfile, updateProfile } from '@/services/profiles'
import { useAuthStore } from '@/stores/useAuthStore'

export function useProfile(id?: string) {
  const profile = useAuthStore((s) => s.profile)
  const userId = id ?? profile?.id
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getProfile(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  const { profile, updateProfile: updateStore } = useAuthStore()
  return useMutation({
    mutationFn: (updates: Parameters<typeof updateProfile>[1]) =>
      updateProfile(profile!.id, updates),
    onSuccess: (data) => {
      updateStore(data)
      qc.invalidateQueries({ queryKey: ['profile', profile!.id] })
    },
  })
}
