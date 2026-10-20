'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences'

export default function SettingsPage() {
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
        <h2 className="mb-3 text-base font-semibold text-[var(--text-1)]">
          Notifications
        </h2>
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <NotificationPreferences />
        </div>
      </section>
    </main>
  )
}
