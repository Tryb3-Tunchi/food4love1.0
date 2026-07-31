'use client'

import { useMatches } from '@/hooks/useMatches'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { MessageSquare, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'

export default function ChatIndexPage() {
  const { data: matches, isLoading } = useMatches()

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (!matches || matches.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="h-12 w-12" />}
        title="No matches yet"
        description="Start swiping to match with amazing home chefs!"
        action={{ label: 'Discover Chefs', href: '/swipe' }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="bg-[var(--bg)]/80 sticky top-0 z-10 border-b border-[var(--border)] px-4 py-4 backdrop-blur-xl">
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-sm text-[var(--text-muted)]">
          {matches.length} active {matches.length === 1 ? 'match' : 'matches'}
        </p>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {matches.map((match) => (
          <Link
            key={match.id}
            href={`/chat/${match.id}`}
            className="hover:bg-[var(--bg-2)]/50 group flex items-center gap-4 p-4 transition-colors"
          >
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border-2 border-[var(--border)]">
              {match.other_user?.avatar_url ? (
                <Image
                  src={match.other_user.avatar_url}
                  alt=""
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[var(--bg-2)] text-xl">
                  {match.other_user?.role === 'cook' ? '👨‍🍳' : '👤'}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center justify-between">
                <h3 className="truncate font-semibold text-[var(--text)]">
                  {match.other_user?.full_name || 'User'}
                </h3>
                {match.last_message && (
                  <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">
                    {formatDistanceToNow(
                      new Date(match.last_message.created_at),
                      { addSuffix: false },
                    )}
                  </span>
                )}
              </div>
              <p className="truncate text-sm text-[var(--text-muted)] transition-colors group-hover:text-[var(--text)]">
                {match.last_message ? (
                  <span
                    className={
                      match.last_message.read_at
                        ? ''
                        : 'font-medium text-[var(--text)]'
                    }
                  >
                    {match.last_message.content}
                  </span>
                ) : (
                  'Start the conversation...'
                )}
              </p>
            </div>

            <ChevronRight className="h-5 w-5 flex-shrink-0 text-[var(--text-muted)]" />
          </Link>
        ))}
      </div>
    </div>
  )
}
