'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface AuditEvent {
  id: string
  actor_id: string
  action: string
  target_type: string
  target_id: string
  details: Record<string, unknown>
  outcome: string
  error_message: string | null
  created_at: string
}

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  async function loadEvents() {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/audit', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not load audit log')
      setEvents(result.events ?? [])
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not load audit log',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEvents()
  }, [])

  return (
    <div className="mx-auto min-h-screen max-w-6xl bg-char p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin audit log</h1>
          <p className="mt-1 text-sm text-mist">
            Recorded staff actions and sensitive KYC access
          </p>
        </div>
        <button
          onClick={loadEvents}
          disabled={loading}
          aria-label="Refresh audit log"
          className="rounded-lg border border-white/10 p-2 text-white hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>
      <div className="overflow-x-auto border-y border-white/10">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase text-mist">
            <tr>
              <th className="py-3 pr-4">When</th>
              <th className="py-3 pr-4">Action</th>
              <th className="py-3 pr-4">Actor</th>
              <th className="py-3 pr-4">Record</th>
              <th className="py-3 pr-4">Outcome</th>
              <th className="py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.id}
                className="border-b border-white/5 align-top text-white/80"
              >
                <td className="whitespace-nowrap py-3 pr-4">
                  {new Date(event.created_at).toLocaleString()}
                </td>
                <td className="py-3 pr-4 font-medium text-white">
                  {event.action}
                </td>
                <td className="py-3 pr-4 font-mono text-xs">
                  {event.actor_id}
                </td>
                <td className="py-3 pr-4">
                  <span className="block">{event.target_type}</span>
                  <span className="font-mono text-xs text-mist">
                    {event.target_id}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  {event.outcome}
                  {event.error_message ? `: ${event.error_message}` : ''}
                </td>
                <td className="max-w-sm py-3 text-xs text-mist">
                  {JSON.stringify(event.details)}
                </td>
              </tr>
            ))}
            {!loading && events.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-mist">
                  No audit events recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
