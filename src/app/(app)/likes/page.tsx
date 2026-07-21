'use client'
import { useMatches } from '@/hooks/useMatches'
import { useAuthStore } from '@/stores/useAuthStore'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { AppPage } from '@/components/ui/AppPage'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { motion } from 'framer-motion'

export default function LikesPage() {
  const profile = useAuthStore((s) => s.profile)
  const { data: matches, isLoading } = useMatches()

  // Likes = matches where the other user initiated (no last message yet = new match)
  // In practice this will be replaced by a real swipes query once schema is applied.
  const likes = (matches ?? []).filter((m) => !m.last_message)

  if (profile?.role !== 'cook') {
    return (
      <AppPage
        ambient="pepper"
        ambientIntensity="low"
        className="px-4 pb-6 pt-6"
      >
        <EmptyState
          icon="❤️"
          title="This page is for chefs"
          description="Buyers see their matches in the Matches tab."
        />
      </AppPage>
    )
  }

  return (
    <AppPage ambient="pepper" ambientIntensity="low" className="px-4 pb-6 pt-6">
      <PageHeader
        title="Who liked you"
        icon={Heart}
        iconColor="var(--accent)"
        iconBg="var(--accent-soft)"
        badge={likes.length ? `${likes.length} new` : undefined}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 rounded-2xl p-4"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <Skeleton className="h-16 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      ) : !likes.length ? (
        <EmptyState
          icon="💫"
          title="No new likes yet"
          description="When a food lover swipes right on you, they'll appear here."
          action={
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              Keep your profile fresh — add a daily special to get 3× more
              matches.
            </p>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {likes.map((m, i) => {
            const liker = m.other_user
            if (!liker) return null
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.07 }}
              >
                <Link
                  href={`/chat/${m.id}`}
                  className="flex flex-col items-center gap-2 rounded-2xl p-4 text-center transition-all active:scale-95"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="relative">
                    <Avatar
                      src={liker.avatar_url}
                      name={liker.full_name}
                      size="xl"
                      verified={liker.is_verified}
                    />
                    <span
                      className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full text-sm"
                      style={{
                        background: 'var(--accent)',
                        boxShadow: 'var(--shadow-warm)',
                      }}
                    >
                      ❤️
                    </span>
                  </div>
                  <div>
                    <p
                      className="text-sm font-bold"
                      style={{ color: 'var(--text-1)' }}
                    >
                      {liker.full_name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      Tap to chat
                    </p>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </AppPage>
  )
}
