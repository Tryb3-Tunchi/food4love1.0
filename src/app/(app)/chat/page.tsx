'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, X, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMatches } from '@/hooks/useMatches'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'

export default function ChatIndexPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const { data: matches, isLoading } = useMatches()

  const conversations = (matches ?? []).filter((c) => {
    const other = c.other_user
    return (
      search === '' ||
      (other?.full_name?.toLowerCase() || '').includes(search.toLowerCase())
    )
  })

  return (
    <div
      className="flex h-[100dvh] flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* Header */}
      <div className="shrink-0 px-4 pb-4 pt-6">
        <h1
          className="mb-4 font-heading text-2xl font-bold"
          style={{ color: 'var(--text-1)' }}
        >
          Messages
        </h1>
        <div
          className="flex items-center gap-2 rounded-2xl px-4 py-3"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <Search
            className="h-4 w-4 shrink-0"
            style={{ color: 'var(--text-3)' }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-1)' }}
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <X className="h-4 w-4" style={{ color: 'var(--text-3)' }} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 space-y-1 overflow-y-auto px-4 pb-24">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl p-4"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                }}
              >
                <Skeleton className="h-13 w-13 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : !conversations.length ? (
          <EmptyState
            icon="💬"
            title="No conversations yet"
            description="Match with someone to start chatting"
            action={
              <button
                onClick={() => router.push('/swipe')}
                className="rounded-full px-6 py-3 text-sm font-bold text-white"
                style={{ background: 'var(--accent)' }}
              >
                Discover →
              </button>
            }
          />
        ) : (
          conversations.map((convo, i) => {
            const other = convo.other_user
            if (!other) return null
            const isNew = !convo.last_message

            return (
              <motion.button
                key={convo.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => router.push(`/chat/${convo.id}`)}
                className="flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-all active:scale-[0.99]"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 1px 3px rgba(47,36,31,0.04)',
                }}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <Avatar
                    src={other.avatar_url}
                    name={other.full_name}
                    size="md"
                    verified={other.is_verified}
                  />
                  {isNew && (
                    <div
                      className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full border-2"
                      style={{
                        background: 'var(--accent)',
                        borderColor: 'var(--card)',
                      }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between">
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color: 'var(--text-1)',
                        fontWeight: convo.unread_count ? 700 : 600,
                      }}
                    >
                      {other.full_name}
                    </span>
                    {convo.last_message?.created_at && (
                      <span
                        className="ml-2 shrink-0 text-xs"
                        style={{ color: 'var(--text-3)' }}
                      >
                        {new Date(
                          convo.last_message.created_at,
                        ).toLocaleTimeString('en-NG', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                  <p
                    className="truncate text-xs"
                    style={{
                      color: isNew ? 'var(--accent)' : 'var(--text-3)',
                      fontWeight: convo.unread_count ? 600 : 400,
                    }}
                  >
                    {isNew
                      ? '✨ New match — say hello!'
                      : convo.last_message?.content}
                  </p>
                </div>

                {/* Unread / arrow */}
                <div className="flex shrink-0 items-center gap-2">
                  {convo.unread_count ? (
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: 'var(--accent)' }}
                    >
                      {convo.unread_count}
                    </span>
                  ) : (
                    <ChevronRight
                      className="h-4 w-4 opacity-30"
                      style={{ color: 'var(--text-2)' }}
                    />
                  )}
                </div>
              </motion.button>
            )
          })
        )}
      </div>
    </div>
  )
}
