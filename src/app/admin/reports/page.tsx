'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface Report {
  id: string
  reporter_id: string
  target_type: string
  target_id: string
  reason: string
  description: string
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed'
  resolution: string | null
  created_at: string
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  async function loadReports() {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/reports', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not load reports')
      setReports(result.reports ?? [])
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not load reports',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReports()
  }, [])

  async function review(
    report: Report,
    status: 'reviewing' | 'resolved' | 'dismissed',
  ) {
    const resolution = window.prompt(
      `${status === 'dismissed' ? 'Reason for dismissal' : 'Review note'} (minimum 5 characters):`,
    )
    if (!resolution?.trim() || resolution.trim().length < 5) return
    setSaving(report.id)
    try {
      const response = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: report.id,
          status,
          resolution: resolution.trim(),
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not update report')
      toast.success(`Report marked ${status}`)
      await loadReports()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not update report',
      )
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl bg-char p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="mt-1 text-sm text-mist">
            Review reported accounts, listings, posts, stories, and messages.
          </p>
        </div>
        <button
          onClick={loadReports}
          disabled={loading}
          aria-label="Refresh reports"
          className="rounded-lg border border-white/10 p-2 text-white hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>
      {loading ? (
        <p className="py-10 text-sm text-mist">Loading reports...</p>
      ) : (
        <div className="divide-y divide-white/10 border-y border-white/10">
          {reports.map((report) => (
            <article key={report.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold capitalize text-white">
                      {report.target_type.replace('_', ' ')}
                    </span>
                    <span className="font-mono text-xs text-mist">
                      {report.target_id}
                    </span>
                    <span className="rounded bg-white/5 px-2 py-0.5 text-xs capitalize text-white/70">
                      {report.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-amber-200">{report.reason}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-white/70">
                    {report.description}
                  </p>
                  <p className="mt-2 text-xs text-mist">
                    Reported {new Date(report.created_at).toLocaleString()} ·
                    Reporter {report.reporter_id}
                  </p>
                  {report.resolution && (
                    <p className="mt-1 text-xs text-mist">
                      Staff note: {report.resolution}
                    </p>
                  )}
                </div>
                {['open', 'reviewing'].includes(report.status) && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={saving === report.id}
                      onClick={() => review(report, 'reviewing')}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white disabled:opacity-50"
                    >
                      Mark reviewing
                    </button>
                    <button
                      disabled={saving === report.id}
                      onClick={() => review(report, 'resolved')}
                      className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Resolve
                    </button>
                    <button
                      disabled={saving === report.id}
                      onClick={() => review(report, 'dismissed')}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
          {!reports.length && (
            <p className="py-10 text-center text-mist">No reports found.</p>
          )}
        </div>
      )}
    </div>
  )
}
