'use client'

import { formatDistanceToNowStrict } from 'date-fns'
import { motion } from 'framer-motion'
import { Heart, Loader2, MapPin, X } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import type { MatchRequest } from '@/services/cookRequests'

export function MatchRequestCard({
  request,
  index,
  busy,
  onAccept,
  onDecline,
}: {
  request: MatchRequest
  index: number
  busy: boolean
  onAccept: (request: MatchRequest) => void
  onDecline: (request: MatchRequest) => void
}) {
  const name = request.swiper?.full_name ?? 'Food lover'

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ delay: Math.min(index, 6) * 0.05, type: 'spring' }}
      className="f4l-card p-4"
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          {request.swiper?.avatar_url ? (
            <img
              src={request.swiper.avatar_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            getInitials(name)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold"
            style={{ color: 'var(--text-1)' }}
          >
            {name}
          </p>
          <p
            className="flex items-center gap-1 text-xs"
            style={{ color: 'var(--accent)' }}
          >
            <Heart className="h-3 w-3 fill-current" />
            Liked you{' '}
            {formatDistanceToNowStrict(new Date(request.created_at), {
              addSuffix: true,
            })}
          </p>
          {request.swiper?.location && (
            <p
              className="mt-0.5 flex items-center gap-1 text-xs"
              style={{ color: 'var(--text-3)' }}
            >
              <MapPin className="h-3 w-3" />
              {request.swiper.location}
            </p>
          )}
        </div>
      </div>

      {request.swiper?.bio && (
        <p
          className="mt-3 line-clamp-2 text-sm leading-relaxed"
          style={{ color: 'var(--text-2)' }}
        >
          {request.swiper.bio}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onDecline(request)}
          disabled={busy}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-5 text-sm font-semibold transition active:scale-95 disabled:opacity-50"
          style={{ color: 'var(--text-2)' }}
        >
          <X className="h-4 w-4" />
          Decline
        </button>
        <button
          type="button"
          onClick={() => onAccept(request)}
          disabled={busy}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-white transition active:scale-95 disabled:opacity-70"
          style={{
            background: 'linear-gradient(135deg, #ff9a52, var(--accent))',
            boxShadow: 'var(--shadow-warm)',
          }}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Heart className="h-4 w-4 fill-white" />
          )}
          Accept and say hi
        </button>
      </div>
    </motion.article>
  )
}
