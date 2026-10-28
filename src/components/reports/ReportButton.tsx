'use client'

import { Flag } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

export function ReportButton({
  targetType,
  targetId,
  className = '',
}: {
  targetType: 'profile' | 'daily_special' | 'post' | 'story' | 'message'
  targetId: string
  className?: string
}) {
  const [submitting, setSubmitting] = useState(false)

  async function submitReport() {
    const reason = window.prompt('What is the concern?')
    if (!reason?.trim() || reason.trim().length < 3) return
    const description = window.prompt(
      'Please add details (at least 10 characters).',
    )
    if (!description?.trim() || description.trim().length < 10) return

    setSubmitting(true)
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason: reason.trim(),
          description: description.trim(),
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not submit report')
      toast.success('Report sent to Food4Love Support')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not submit report',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={submitReport}
      disabled={submitting}
      aria-label="Report this content"
      title="Report this content"
      className={`inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--text-3)] transition hover:border-red-500/30 hover:text-red-500 disabled:opacity-50 ${className}`}
    >
      <Flag className="h-3.5 w-3.5" />
      {submitting ? 'Sending...' : 'Report'}
    </button>
  )
}
