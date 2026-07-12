import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { Profile } from '@/types/db'

interface AuthState {
  profile: Profile | null
  loading: boolean
  setProfile: (p: Profile | null) => void
  setLoading: (v: boolean) => void
  updateProfile: (updates: Partial<Profile>) => void
}

export const useAuthStore = create<AuthState>()(
  immer((set) => ({
    profile: null,
    loading: true,
    setProfile: (p) =>
      set((s) => {
        s.profile = p
      }),
    setLoading: (v) =>
      set((s) => {
        s.loading = v
      }),
    updateProfile: (updates) =>
      set((s) => {
        if (s.profile) Object.assign(s.profile, updates)
      }),
  })),
)
