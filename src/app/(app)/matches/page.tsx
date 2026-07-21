'use client'
import { useMatches } from '@/hooks/useMatches'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { AppPage } from '@/components/ui/AppPage'
import { PageHeader } from '@/components/ui/PageHeader'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Heart, Clock, ChevronRight, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

function MatchSkeleton() {
  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-4"
      style={{ background: 'var(--surface-muted)' }}
    >
      <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

export default function MatchesPage() {
  const { data: matches, isLoading } = useMatches()

  return (
    <AppPage ambient="pepper" ambientIntensity="low" className="px-4 pb-6 pt-6">
      <PageHeader
        title="Your Matches"
        icon={Heart}
        iconColor="var(--accent)"
        iconBg="var(--accent-soft)"
        badge={matches?.length ? `${matches.length} active` : undefined}
      />

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <MatchSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !matches?.length && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center px-4 py-20 text-center"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.5 }}
            className="mb-6 text-6xl"
          >
            🍽️
          </motion.div>

          <h3
            className="mb-2 text-xl font-bold"
            style={{ color: 'var(--text-1)' }}
          >
            No matches yet
          </h3>
          <p
            className="mb-8 max-w-xs text-sm leading-relaxed"
            style={{ color: 'var(--text-3)' }}
          >
            When a chef likes you back, they appear here. You have 24 hours to
            start a conversation before it expires.
          </p>

          {/* Tip */}
          <div
            className="mb-6 w-full max-w-sm rounded-2xl p-4 text-left"
            style={{
              background: 'var(--accent-soft)',
              border:
                '1px solid color-mix(in srgb, var(--accent-alt) 30%, transparent)',
            }}
          >
            <div className="mb-2 flex items-center gap-2">
              <Sparkles
                className="h-4 w-4"
                style={{ color: 'var(--accent-alt)' }}
              />
              <span
                className="text-xs font-bold"
                style={{ color: 'var(--accent-alt)' }}
              >
                Pro tip
              </span>
            </div>
            <p
              className="text-xs leading-relaxed"
              style={{ color: 'var(--text-2)' }}
            >
              Chefs with a complete profile and daily special get 3× more
              matches. Swipe right on chefs you genuinely want cooking for you.
            </p>
          </div>

          <Link
            href="/swipe"
            className="inline-flex items-center gap-2 rounded-full px-8 py-4 font-bold text-white transition-all active:scale-95"
            style={{
              background: 'var(--accent)',
              boxShadow: 'var(--shadow-warm)',
            }}
          >
            Start Swiping →
          </Link>
        </motion.div>
      )}

      {/* Match list */}
      {!isLoading && matches && matches.length > 0 && (
        <div className="space-y-2">
          {matches.map((match, i) => {
            const chef = match.other_user
            if (!chef) return null
            const expiresAt = new Date(match.expires_at)
            const isExpiringSoon =
              expiresAt.getTime() - Date.now() < 3 * 60 * 60 * 1000
            const isExpired = expiresAt.getTime() < Date.now()

            return (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Link
                  href={`/chat/${match.id}`}
                  className="app-card group flex items-center gap-3 rounded-2xl p-4 transition-all duration-150 active:scale-[0.99]"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <Avatar
                      src={chef.avatar_url}
                      name={chef.full_name}
                      size="lg"
                      verified={chef.is_verified}
                    />
                    {!match.last_message && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2"
                        style={{
                          background: 'var(--accent)',
                          borderColor: 'var(--app-bg)',
                        }}
                      >
                        <span
                          className="absolute inset-0 animate-ping rounded-full opacity-75"
                          style={{ background: 'var(--accent)' }}
                        />
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center justify-between">
                      <span
                        className="truncate text-sm font-bold"
                        style={{ color: 'var(--text-1)' }}
                      >
                        {chef.full_name}
                      </span>
                      {match.unread_count ? (
                        <span
                          className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: 'var(--accent)' }}
                        >
                          {match.unread_count > 9 ? '9+' : match.unread_count}
                        </span>
                      ) : null}
                    </div>

                    <p
                      className="mb-1.5 truncate text-sm"
                      style={{ color: 'var(--text-3)' }}
                    >
                      {match.last_message?.content ?? (
                        <span style={{ color: 'var(--accent)' }}>
                          ✨ New match — say hi!
                        </span>
                      )}
                    </p>

                    <div className="flex items-center gap-1">
                      <Clock
                        className="h-3 w-3 shrink-0"
                        style={{
                          color: isExpiringSoon
                            ? 'var(--accent)'
                            : 'var(--text-3)',
                          opacity: isExpiringSoon ? 1 : 0.5,
                        }}
                      />
                      <span
                        className="text-[11px]"
                        style={{
                          color: isExpiringSoon
                            ? 'var(--accent)'
                            : 'var(--text-3)',
                          opacity: isExpiringSoon ? 1 : 0.6,
                        }}
                      >
                        {isExpired
                          ? 'Expired'
                          : `Expires ${formatDistanceToNow(expiresAt, { addSuffix: true })}`}
                      </span>
                      {isExpiringSoon && !isExpired && (
                        <span
                          className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                          style={{
                            background: 'var(--accent-soft)',
                            color: 'var(--accent)',
                          }}
                        >
                          Act fast
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight
                    className="h-4 w-4 shrink-0 transition-opacity group-hover:opacity-50"
                    style={{ color: 'var(--text-3)', opacity: 0.3 }}
                  />
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </AppPage>
  )
}
