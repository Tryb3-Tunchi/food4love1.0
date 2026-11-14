'use client'

import { useEffect, useState } from 'react'
import {
  CONSENT_EVENT,
  analyticsEnabled,
  getConsent,
  setConsent,
  type Consent,
} from '@/lib/analytics/client'

// Lets a visitor see and change their analytics choice at any time. Withdrawing
// consent is as easy as giving it, and deletes the stored identifiers.
export function PrivacyChoices() {
  const [consent, setState] = useState<Consent>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sync = () => setState(getConsent())
    sync()
    setReady(true)
    window.addEventListener(CONSENT_EVENT, sync)
    return () => window.removeEventListener(CONSENT_EVENT, sync)
  }, [])

  if (!ready) return null
  const off = !analyticsEnabled()

  return (
    <section
      id="choices"
      aria-labelledby="privacy-choices-title"
      className="rounded-2xl border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
    >
      <h2
        id="privacy-choices-title"
        className="font-heading text-lg font-bold"
        style={{ color: 'var(--text-1)' }}
      >
        Your privacy choices
      </h2>
      {off ? (
        <p className="mt-2 text-sm" style={{ color: 'var(--text-2)' }}>
          Analytics are switched off on this site, so nothing is being counted
          or stored about your visit.
        </p>
      ) : (
        <>
          <p
            className="mt-2 text-sm"
            style={{ color: 'var(--text-2)' }}
            role="status"
          >
            Analytics:{' '}
            <strong>
              {consent === 'accepted'
                ? 'on'
                : consent === 'declined'
                  ? 'off'
                  : 'not chosen yet (off)'}
            </strong>
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
              Allow analytics
            </button>
            <button
              type="button"
              onClick={() => setConsent('declined')}
              className="min-h-11 rounded-xl border px-4 text-sm font-semibold"
              style={{ borderColor: 'var(--border)', color: 'var(--text-1)' }}
            >
              Turn analytics off and delete my IDs
            </button>
          </div>
        </>
      )}
    </section>
  )
}
