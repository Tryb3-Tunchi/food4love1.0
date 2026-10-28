import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { Profile } from '@/types/db'

interface AuthState {
  profile: Profile | null
  isAdmin: boolean
  loading: boolean
  setProfile: (p: Profile | null) => void
  setIsAdmin: (value: boolean) => void
  setLoading: (v: boolean) => void
  updateProfile: (updates: Partial<Profile>) => void
}

export const useAuthStore = create<AuthState>()(
  immer((set) => ({
    profile: null,
    isAdmin: false,
    loading: true,
    setProfile: (p) =>
      set((s) => {
        s.profile = p
      }),
    setIsAdmin: (value) =>
      set((s) => {
        s.isAdmin = value
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
