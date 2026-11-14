'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/useAuthStore'
import { MINIMUM_AGE, ageGate } from '@/lib/ageGate'

// Shown once to a signed-in member who has not yet confirmed they are an adult.
// It cannot be dismissed: the app is for adults, and the server refuses matching,
// likes and the map until the confirmation is recorded.
export function AgeGate() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const [busy, setBusy] = useState(false)

  if (!profile || ageGate(profile.age_confirmed_at) !== 'required') return null

  async function confirm() {
    setBusy(true)
    try {
      const response = await fetch('/api/account/confirm-age', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok)
        throw new Error(body.error || 'Could not save your confirmation')
      updateProfile({ age_confirmed_at: body.age_confirmed_at })
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not save your confirmation',
      )
    } finally {
      setBusy(false)
    }
  }

  async function underage() {
    setBusy(true)
    await createClient().auth.signOut()
    toast('Food4Love is for adults only. You have been signed out.')
    window.location.assign('/waitlist')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
    >
      <div
        className="w-full max-w-md rounded-3xl p-6 shadow-xl"
        style={{ background: 'var(--card)', color: 'var(--text-1)' }}
      >
        <h2 id="age-gate-title" className="font-heading text-xl font-bold">
          Are you {MINIMUM_AGE} or older?
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-2)' }}>
          Food4Love lets adults match, message and arrange food with each other.
          We only ask you to confirm. We do not ask for your date of birth or an
          ID document.
        </p>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-3)' }}>
          By continuing you also agree to our{' '}
          <Link href="/terms" className="underline">
            Terms
          </Link>{' '}
          and have read our{' '}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={confirm}
            className="min-h-11 rounded-full px-5 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: 'var(--accent)' }}
          >
            I am {MINIMUM_AGE} or older
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={underage}
            className="min-h-11 rounded-full border px-5 text-sm font-semibold disabled:opacity-60"
            style={{ borderColor: 'var(--divider)' }}
          >
            I am under {MINIMUM_AGE}
          </button>
        </div>
      </div>
    </div>
  )
}
