'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

interface VerifiedCook {
  id: string
  full_name: string | null
}

// Lets an administrator with the verification permission take an approval back. The
// server checks the permission again, records an audit entry, and refuses anything
// that is not a currently verified cook.
export function VerifiedCooksPanel() {
  const [cooks, setCooks] = useState<VerifiedCook[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await fetch('/api/admin/kyc/verified', {
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Could not load')
      setCooks(body.cooks ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function revoke(cook: VerifiedCook) {
    const reason = window.prompt(
      `Revoke verification for ${cook.full_name ?? 'this cook'}? Reason (at least 5 characters, recorded in the audit log):`,
    )
    if (!reason || reason.trim().length < 5) return
    setBusy(cook.id)
    try {
      const response = await fetch('/api/admin/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cook_id: cook.id, reason: reason.trim() }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Could not revoke')
      toast.success(
        'Verification revoked. The cook can no longer take bookings.',
      )
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not revoke')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section
      aria-labelledby="verified-cooks-title"
      className="mt-10 rounded-2xl border border-white/10 p-5"
    >
      <h2 id="verified-cooks-title" className="text-lg font-bold text-white">
        Verified cooks
      </h2>
      <p className="mt-1 text-sm text-mist">
        Revoking returns a cook to “not verified”. Their bookings can no longer
        be accepted, and they can apply again. The action is audited.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {cooks === null && !error && (
        <p className="mt-3 text-sm text-mist">Loading…</p>
      )}
      {cooks && cooks.length === 0 && (
        <p className="mt-3 text-sm text-mist">No verified cooks yet.</p>
      )}
      {cooks && cooks.length > 0 && (
        <ul className="mt-3 divide-y divide-white/5">
          {cooks.map((cook) => (
            <li
              key={cook.id}
              className="flex items-center justify-between gap-3 py-2 text-sm text-white/80"
            >
              <span>{cook.full_name ?? 'Cook'}</span>
              <button
                type="button"
                disabled={busy === cook.id}
                onClick={() => revoke(cook)}
                className="min-h-10 rounded-lg border border-red-400/30 px-3 text-xs font-semibold text-red-200 hover:bg-red-400/10 disabled:opacity-50"
              >
                {busy === cook.id ? 'Revoking…' : 'Revoke verification'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
