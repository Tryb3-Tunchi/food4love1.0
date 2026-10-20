'use client'

import * as Switch from '@radix-ui/react-switch'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { updateProfile } from '@/services/profiles'
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/services/notifications'
import { useAuthStore } from '@/stores/useAuthStore'
import type { NotificationPreferences as Preferences } from '@/types/db'

const preferenceOptions: Array<{
  key: keyof Preferences
  title: string
  description: string
}> = [
  {
    key: 'messages',
    title: 'Chats and messages',
    description: 'New conversations and messages',
  },
  {
    key: 'swipeActivity',
    title: 'Swipe activity',
    description: 'Likes, matches, and incoming requests',
  },
  {
    key: 'bookings',
    title: 'Bookings',
    description: 'Booking requests and status updates',
  },
  {
    key: 'reviews',
    title: 'Reviews',
    description: 'New reviews and review activity',
  },
]

export function NotificationPreferences() {
  const profile = useAuthStore((state) => state.profile)
  const updateStore = useAuthStore((state) => state.updateProfile)
  const authLoading = useAuthStore((state) => state.loading)
  const [saving, setSaving] = useState<keyof Preferences | null>(null)
  const preferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...profile?.notification_preferences,
  }

  const updatePreference = async (key: keyof Preferences, checked: boolean) => {
    if (!profile || saving) return

    const nextPreferences = { ...preferences, [key]: checked }
    setSaving(key)
    try {
      const updated = await updateProfile(profile.id, {
        notification_preferences: nextPreferences,
      })
      updateStore(updated)
      toast.success('Notification preference saved')
    } catch {
      toast.error('Could not save this preference')
    } finally {
      setSaving(null)
    }
  }

  if (authLoading || !profile) {
    return (
      <p className="px-5 py-6 text-sm text-[var(--text-3)]" role="status">
        Loading preferences…
      </p>
    )
  }

  return (
    <div className="divide-y divide-[var(--border)]">
      <div className="space-y-3 px-5 pb-4 pt-2">
        <p className="text-sm text-[var(--text-2)]">
          Choose which updates appear in your Food4Love notification feed.
        </p>
        <p className="text-xs text-[var(--text-3)]">
          These preferences do not enable push, email, or background delivery.
        </p>
      </div>
      {preferenceOptions.map(({ key, title, description }) => (
        <div
          key={key}
          className="flex items-center justify-between gap-4 px-5 py-4"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-1)]">
              {title}
            </p>
            <p className="mt-1 text-xs text-[var(--text-3)]">{description}</p>
          </div>
          <Switch.Root
            checked={preferences[key]}
            onCheckedChange={(checked) => void updatePreference(key, checked)}
            disabled={saving !== null}
            aria-label={title}
            className="relative h-6 w-11 shrink-0 rounded-full bg-[var(--border)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-60 data-[state=checked]:bg-[var(--accent)]"
          >
            <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
          </Switch.Root>
        </div>
      ))}
    </div>
  )
}
