'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Heart, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { recordSwipe } from '@/services/swipes'

// "Like back" reuses the existing swipe API, so the matching rules, the database
// uniqueness and the notification triggers are exactly the same as swiping.
export function LikeBackButton({
  personId,
  name,
  onMatch,
}: {
  personId: string
  name: string
  onMatch?: (matchId: string) => void
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function likeBack() {
    if (busy) return
    setBusy(true)
    try {
      const result = await recordSwipe(personId, 'like')
      if (result.match && result.match_id) {
        toast.success(`It's a match with ${name}!`)
        onMatch?.(result.match_id)
      } else {
        toast.success('Like sent')
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['likes'] }),
        queryClient.invalidateQueries({ queryKey: ['matches'] }),
        queryClient.invalidateQueries({ queryKey: ['member-access'] }),
      ])
      router.refresh() // re-run server-rendered profile pages
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not send your like',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={likeBack}
      disabled={busy}
      aria-label={`Like ${name} back`}
      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-60"
      style={{ background: 'var(--accent)' }}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Heart className="h-4 w-4" aria-hidden="true" />
      )}
      Like back
    </button>
  )
}
