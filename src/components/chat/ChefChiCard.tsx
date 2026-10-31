'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ChefHat, ChevronRight, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { getChiMessages } from '@/services/chefChi'
import { CHI_NAME } from '@/lib/chefChi'

export function ChefChiAvatar({ size = 'lg' }: { size?: 'md' | 'lg' }) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ember to-pepper text-white ${
        size === 'lg' ? 'h-14 w-14' : 'h-10 w-10'
      }`}
    >
      <ChefHat className={size === 'lg' ? 'h-7 w-7' : 'h-5 w-5'} />
      <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--bg)] bg-[var(--accent)]">
        <Sparkles className="h-2.5 w-2.5" />
      </span>
    </div>
  )
}

// Pinned conversation with Chef Chi. Every account gets one, so the chat and
// matches screens are never empty.
export function ChefChiCard({
  variant = 'card',
  className = '',
}: {
  variant?: 'card' | 'row'
  className?: string
}) {
  const userId = useAuthStore((s) => s.profile?.id)
  const { data: messages } = useQuery({
    queryKey: ['chef-chi', userId],
    queryFn: () => getChiMessages(userId!),
    enabled: !!userId,
    retry: false,
  })
  const last = messages?.[messages.length - 1]

  const body = (
    <>
      <ChefChiAvatar />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span
            className="truncate text-sm font-bold"
            style={{ color: 'var(--text-1)' }}
          >
            {CHI_NAME}
          </span>
          <span className="f4l-badge f4l-badge-accent">AI</span>
        </div>
        <p className="truncate text-sm" style={{ color: 'var(--text-3)' }}>
          {last ? (
            last.content
          ) : (
            <span style={{ color: 'var(--accent)' }}>
              Ask me anything about food ✨
            </span>
          )}
        </p>
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0"
        style={{ color: 'var(--text-3)', opacity: 0.4 }}
      />
    </>
  )

  if (variant === 'row')
    return (
      <Link
        href="/chat/chi"
        className={`hover:bg-[var(--bg-2)]/50 flex items-center gap-4 p-4 transition-colors ${className}`}
      >
        {body}
      </Link>
    )

  return (
    <Link
      href="/chat/chi"
      className={`app-card flex items-center gap-3 rounded-2xl p-4 transition-all duration-150 active:scale-[0.99] ${className}`}
    >
      {body}
    </Link>
  )
}
