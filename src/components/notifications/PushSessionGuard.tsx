'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { dropSubscriptionIfNotOwnedBy } from '@/lib/push/client'
import { markAsRead } from '@/services/notifications'
import { useAuthStore } from '@/stores/useAuthStore'
import { safePushUrl } from '../../../supabase/functions/_shared/push-core'

const NOTIFICATION_ID = /^[0-9a-f-]{36}$/i

// The page side of Web Push. Renders nothing.
//  1. Sign-out / account switch: the push subscription that belonged to the previous account is
//     cancelled in this browser, so that account's notifications stop arriving here (any sign-out
//     path, an expired session, or a global sign-out after a password reset).
//  2. A tapped notification with Food4Love already open: the service worker asks this page to go
//     there (allowlisted path only) and the notification is marked read.
//  3. A tapped notification that opened a new window arrives as ?f4l_n=<id>: marked read, then the
//     parameter is removed from the address bar.
//  4. A push arrived while the app is open: the bell and badge refresh at once.
export function PushSessionGuard() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.profile?.id ?? null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === 'SIGNED_OUT' ||
        event === 'SIGNED_IN' ||
        event === 'INITIAL_SESSION'
      )
        void dropSubscriptionIfNotOwnedBy(session?.user?.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
    const markOpened = (id: unknown) => {
      if (!userId || typeof id !== 'string' || !NOTIFICATION_ID.test(id)) return
      void markAsRead(id, userId)
        .catch(() => 0)
        .then(refresh)
    }
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: unknown; id?: unknown }
      if (data?.type === 'F4L_PUSH_RECEIVED') refresh()
      if (data?.type === 'F4L_OPEN_NOTIFICATION') {
        markOpened(data.id)
        router.push(safePushUrl(data.url))
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)

    const params = new URLSearchParams(window.location.search)
    const opened = params.get('f4l_n')
    if (opened && userId) {
      markOpened(opened)
      params.delete('f4l_n')
      const rest = params.toString()
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`,
      )
    }
    return () =>
      navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [router, queryClient, userId])

  return null
}
