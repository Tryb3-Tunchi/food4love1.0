'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  Moon,
  Sun,
  UserRound,
} from 'lucide-react'
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences'
import { useHungerMode } from '@/components/providers/HungerModeProviders'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'

export default function SettingsPage() {
  const router = useRouter()
  const { hungerMode, toggleHungerMode } = useHungerMode()
  const profile = useAuthStore((state) => state.profile)

  const signOut = async () => {
    const { error } = await createClient().auth.signOut()
    if (error) {
      toast.error('Could not sign out. Please try again.')
      return
    }
    router.replace('/login')
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] pb-24">
      <header className="bg-[var(--bg)]/90 sticky top-0 z-10 border-b border-[var(--border)] px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <Link
            href="/profile"
            aria-label="Back to profile"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--bg-2)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-bold text-[var(--text-1)]">Settings</h1>
        </div>
      </header>
      <section className="mx-auto max-w-xl px-4 py-6">
        <section aria-labelledby="account-heading" className="mb-7">
          <h2
            id="account-heading"
            className="mb-3 text-base font-semibold text-[var(--text-1)]"
          >
            Account
          </h2>
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <Link
              href="/profile"
              className="flex items-center gap-3 px-4 py-4 transition hover:bg-[var(--bg-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]"
            >
              <UserRound className="h-4 w-4 text-[var(--accent)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--text-1)]">
                  Profile details
                </span>
                <span className="mt-0.5 block truncate text-xs text-[var(--text-3)]">
                  {profile?.full_name ?? 'Edit your Food4Love profile'}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-[var(--text-3)]" />
            </Link>
            <div className="flex items-center gap-3 border-t border-[var(--border)] px-4 py-4">
              {hungerMode ? (
                <Moon className="h-4 w-4 text-[var(--accent)]" />
              ) : (
                <Sun className="h-4 w-4 text-[var(--accent)]" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--text-1)]">
                  Hunger Mode
                </span>
                <span className="mt-0.5 block text-xs text-[var(--text-3)]">
                  {hungerMode ? 'Warm dark appearance' : 'Light appearance'}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={hungerMode}
                aria-label="Hunger Mode appearance"
                onClick={toggleHungerMode}
                className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 ${hungerMode ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${hungerMode ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="w-full border-t border-[var(--border)] px-4 py-3 text-left text-sm font-semibold text-[var(--danger)] transition hover:bg-[var(--bg-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--danger)]"
            >
              Sign out
            </button>
          </div>
        </section>

        <section aria-labelledby="discovery-heading" className="mb-7">
          <h2
            id="discovery-heading"
            className="mb-3 text-base font-semibold text-[var(--text-1)]"
          >
            Discovery and location
          </h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--text-1)]">
                  Map location
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-3)]">
                  Your device location is requested only when you choose “Use my
                  location” on the map. It is used on this device to center the
                  map, is not saved to your profile, and can be stopped at any
                  time.
                </p>
                <Link
                  href="/map"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                  Open map <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="notifications-heading">
          <h2
            id="notifications-heading"
            className="mb-3 text-base font-semibold text-[var(--text-1)]"
          >
            Notification preferences
          </h2>
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <NotificationPreferences />
          </div>
        </section>
      </section>
    </main>
  )
}
