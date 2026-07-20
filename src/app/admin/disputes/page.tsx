'use client'
import { useEffect, useState } from 'react'
import { getDisputes, resolveDispute } from '@/services/disputes'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import toast from 'react-hot-toast'

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDisputes(true)
      .then(setDisputes)
      .finally(() => setLoading(false))
  }, [])

  const resolve = async (id: string) => {
    const resolution = prompt('Resolution notes:')
    if (!resolution) return
    const refundPct = prompt('Refund % to buyer (0-100):')
    if (!refundPct) return
    try {
      await resolveDispute(id, resolution, Number(refundPct), resolution)
      setDisputes((p) => p.filter((d) => d.id !== id))
      toast.success('Dispute resolved')
    } catch {
      toast.error('Failed to resolve')
    }
  }

  const statusColor: Record<string, any> = {
    open: 'default',
    ai_reviewed: 'ember',
    admin_review: 'default',
    resolved_buyer: 'success',
    resolved_chef: 'success',
    resolved_partial: 'muted',
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-char p-6">
      <h1 className="mb-2 text-2xl font-bold text-white">Dispute Resolution</h1>
      <p className="mb-6 text-mist">
        AI pre-analyzes every dispute. You make the final call.
      </p>
      {loading ? (
        <p className="text-mist">Loading...</p>
      ) : !disputes.length ? (
        <div className="rounded-2xl border border-white/5 bg-smoke p-12 text-center">
          <p className="mb-3 text-4xl">⚖️</p>
          <p className="font-semibold text-white">No open disputes</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <div
              key={d.id}
              className="rounded-2xl border border-white/5 bg-smoke p-5"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-bold text-white">
                      Dispute #{d.id.slice(0, 8)}
                    </span>
                    <Badge variant={statusColor[d.status] ?? 'muted'} size="sm">
                      {d.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-ash">{d.reason}</p>
                  <p className="mt-1 text-xs text-mist">{d.description}</p>
                </div>
              </div>
              {d.ai_recommendation && (
                <div className="mb-4 rounded-xl border border-ember/20 bg-ember/5 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-semibold text-ember">
                      🤖 AI Analysis
                    </span>
                    <span className="text-xs text-mist">
                      Confidence: {Math.round((d.ai_confidence ?? 0) * 100)}%
                    </span>
                  </div>
                  <p className="mb-1 text-sm font-medium capitalize text-white">
                    Recommendation: {d.ai_recommendation?.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-ash">{d.ai_reasoning}</p>
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  variant="ember"
                  size="sm"
                  className="flex-1"
                  onClick={() => resolve(d.id)}
                >
                  Resolve Dispute
                </Button>
                <Button variant="ghost" size="sm" className="text-mist">
                  View Booking
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
