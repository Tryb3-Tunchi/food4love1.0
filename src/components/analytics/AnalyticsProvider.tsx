'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  CONSENT_EVENT,
  getConsent,
  heartbeat,
  setConsent,
  track,
  type Consent,
} from '@/lib/analytics/client'
import { HEARTBEAT_SECONDS } from '@/lib/admin/intelligence/presence'

// The admin console and API routes are never tracked or interrupted by a banner.
function isExcluded(pathname: string | null) {
  return !pathname || pathname.startsWith('/admin')
}

export function AnalyticsProvider() {
  const pathname = usePathname()
  const [consent, setConsentState] = useState<Consent>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sync = () => setConsentState(getConsent())
    sync()
    setReady(true)
    window.addEventListener(CONSENT_EVENT, sync)
    return () => window.removeEventListener(CONSENT_EVENT, sync)
  }, [])

  // One page view per navigation (query strings are never sent).
  useEffect(() => {
    if (consent !== 'accepted' || isExcluded(pathname)) return
    track('page_view')
  }, [consent, pathname])

  // Heartbeat: keeps "online now" accurate. Beats only while the tab is
  // visible, so a hidden or closed tab expires by itself within 2 minutes.
  useEffect(() => {
    if (consent !== 'accepted' || isExcluded(pathname)) return
    const beat = () => {
      if (document.visibilityState === 'visible') heartbeat()
    }
    const timer = window.setInterval(beat, HEARTBEAT_SECONDS * 1000)
    document.addEventListener('visibilitychange', beat)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', beat)
    }
  }, [consent, pathname])

  if (!ready || consent !== null || isExcluded(pathname)) return null

  return (
    <section
      role="region"
      aria-label="Privacy choices"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-2xl border p-4 shadow-lg sm:bottom-5"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
        color: 'var(--text-1)',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      <p className="text-sm font-semibold">Help us improve Food4Love</p>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>
        With your OK, we count visits and see which pages and links bring people
        in, using a random ID stored on this device. We never record your IP
        address, messages or anything you type, and you can say no.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setConsent('accepted')}
          className="min-h-11 rounded-xl px-4 text-sm font-semibold"
          style={{
            background: 'var(--bubble-own)',
            color: 'var(--bubble-own-text)',
          }}
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => setConsent('declined')}
          className="min-h-11 rounded-xl border px-4 text-sm font-semibold"
          style={{ borderColor: 'var(--border)', color: 'var(--text-1)' }}
        >
          No thanks
        </button>
      </div>
    </section>
  )
}
