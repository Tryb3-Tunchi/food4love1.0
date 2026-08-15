'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const setProfile = useAuthStore((s) => s.setProfile)
  const setLoading = useAuthStore((s) => s.setLoading)

  useEffect(() => {
    const supabase = createClient()

    async function initAuth() {
      setLoading(true)

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.user) {
        setProfile(null)
        setLoading(false)
        return
      }

      // Use .maybeSingle() — returns null instead of error when no rows
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      if (!profile) {
        console.warn('No profile found for user', session.user.id)
        setProfile(null)
        setLoading(false)

        // Redirect to onboarding if they're on an app page
        if (
          window.location.pathname.startsWith('/swipe') ||
          window.location.pathname.startsWith('/matches') ||
          window.location.pathname.startsWith('/chat')
        ) {
          router.push('/onboarding/role')
        }
        return
      }

      setProfile(profile)
      setLoading(false)
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        return
      }

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        setProfile(profile)
      }
    })

    return () => subscription.unsubscribe()
  }, [setProfile, setLoading, router])

  return <>{children}</>
}
