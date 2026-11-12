'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusChip } from './kit'

// Opens a throw-away Realtime channel from THIS browser and reports whether it
// connected. It sends and stores nothing; it proves the Realtime service is
// reachable, which is what live chat and notifications depend on.
export function RealtimeCheck() {
  const [state, setState] = useState<'checking' | 'ok' | 'bad'>('checking')
  const [ms, setMs] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const started = Date.now()
    const channel = supabase.channel(`admin-health-${started}`)
    const timer = window.setTimeout(() => setState('bad'), 8000)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        window.clearTimeout(timer)
        setMs(Date.now() - started)
        setState('ok')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        window.clearTimeout(timer)
        setState('bad')
      }
    })
    return () => {
      window.clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [])

  return (
    <p className="text-sm" role="status">
      {state === 'checking' && (
        <StatusChip tone="neutral">Checking…</StatusChip>
      )}
      {state === 'ok' && (
        <>
          <StatusChip tone="ok">Connected</StatusChip>{' '}
          <span className="text-[var(--admin-muted)]">in {ms} ms</span>
        </>
      )}
      {state === 'bad' && (
        <>
          <StatusChip tone="bad">Could not connect</StatusChip>{' '}
          <span className="text-[var(--admin-muted)]">
            Live chat and notifications may be delayed. Check Supabase status.
          </span>
        </>
      )}
    </p>
  )
}
