'use client'
import { useEffect, useState } from 'react'
import { getKYCSubmissions, reviewKYC } from '@/services/kyc'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import toast from 'react-hot-toast'

export default function AdminKYCPage() {
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState<string | null>(null)

  useEffect(() => {
    getKYCSubmissions('pending')
      .then(setSubmissions)
      .finally(() => setLoading(false))
  }, [])

  const handle = async (
    id: string,
    userId: string,
    approved: boolean,
    reason?: string,
  ) => {
    setReviewing(id)
    try {
      await reviewKYC(id, userId, approved, reason)
      setSubmissions((p) => p.filter((s) => s.id !== id))
      toast.success(approved ? 'Chef verified ✓' : 'Submission rejected')
    } catch {
      toast.error('Failed to update')
    } finally {
      setReviewing(null)
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-char p-6">
      <h1 className="mb-2 text-2xl font-bold text-white">KYC Review Queue</h1>
      <p className="mb-6 text-mist">
        Review chef video verifications before they can sell
      </p>
      {loading ? (
        <p className="text-mist">Loading...</p>
      ) : !submissions.length ? (
        <div className="rounded-2xl border border-white/5 bg-smoke p-12 text-center">
          <p className="mb-3 text-4xl">✅</p>
          <p className="font-semibold text-white">
            All clear! No pending submissions.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-white/5 bg-smoke p-5"
            >
              <div className="mb-4 flex items-start gap-4">
                <Avatar src={s.user?.avatar_url} name={s.full_name} size="lg" />
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-bold text-white">{s.full_name}</span>
                    <Badge variant="muted" size="sm">
                      {s.id_type?.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-ash">ID: {s.id_number}</p>
                  <p className="mt-0.5 text-xs text-mist">
                    Submitted {new Date(s.submitted_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-3">
                {s.id_document_url && (
                  <a
                    href={s.id_document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-coal p-3 text-sm text-white transition-all hover:border-white/20"
                  >
                    📄 View ID Document
                  </a>
                )}
                {s.face_video_url && (
                  <a
                    href={s.face_video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border border-ember/30 bg-ember/10 p-3 text-sm text-ember transition-all hover:border-ember/50"
                  >
                    🎥 Watch KYC Video
                  </a>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1 bg-lime shadow-none hover:bg-lime/90"
                  loading={reviewing === s.id}
                  onClick={() => handle(s.id, s.user_id, true)}
                >
                  ✓ Approve & Verify
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  loading={reviewing === s.id}
                  onClick={() => {
                    const r = prompt('Rejection reason (shown to chef):')
                    if (r) handle(s.id, s.user_id, false, r)
                  }}
                >
                  ✕ Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
