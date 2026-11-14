'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useMessages } from '@/hooks/useMessages'
import { useAuthStore } from '@/stores/useAuthStore'
import { useState, useRef, useEffect } from 'react'
import { Send, ArrowLeft, Calendar } from 'lucide-react'
import Link from 'next/link'
import { profileHref } from '@/lib/profileLinks'
import Image from 'next/image'
import { format } from 'date-fns'
import BookingModal from '@/components/booking/BookingModal'
import { ChefChiLauncher } from '@/components/chat/ChefChiLauncher'

interface Profile {
  id: string
  full_name: string
  avatar_url?: string | null
  role: 'cook' | 'buyer'
  bio?: string | null
  location?: string | null
  cuisines?: string[] | null
  photos?: string[] | null
  price_min?: number | null
  price_max?: number | null
  rating?: number | null
  is_verified?: boolean
}

interface MatchDetail {
  id: string
  user1_id: string
  user2_id: string
  status: string
  expires_at: string
  user1: Profile
  user2: Profile
}

export default function ChatDetailPage() {
  const { matchId } = useParams()
  const { profile } = useAuthStore()
  const {
    messages,
    isLoading: messagesLoading,
    error: messagesError,
    refetch: refetchMessages,
    send,
    retry,
    discard,
  } = useMessages(matchId as string, profile?.id)
  const [input, setInput] = useState('')
  const [showBooking, setShowBooking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const seenCount = useRef(0)

  // FETCH REAL MATCH + OTHER USER PROFILE
  const {
    data: matchDetail,
    isLoading: matchLoading,
    isError: matchError,
  } = useQuery<MatchDetail>({
    queryKey: ['match', matchId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('matches')
        .select(
          `
          *,
          user1:profiles!matches_user1_id_fkey(id, full_name, avatar_url, role, bio, location, cuisines, photos, price_min, price_max, rating, is_verified),
          user2:profiles!matches_user2_id_fkey(id, full_name, avatar_url, role, bio, location, cuisines, photos, price_min, price_max, rating, is_verified)
        `,
        )
        .eq('id', matchId)
        .single()

      if (error) throw error
      return data as unknown as MatchDetail
    },
    enabled: !!matchId,
    retry: false,
  })

  // otherUser = the person you're chatting with
  const otherUser: Profile | null = matchDetail
    ? matchDetail.user1_id === profile?.id
      ? matchDetail.user2
      : matchDetail.user1
    : null

  const isCook = otherUser?.role === 'cook'

  // Jump to the newest message on first load, glide when new ones arrive.
  useEffect(() => {
    if (messages.length === seenCount.current) return
    bottomRef.current?.scrollIntoView({
      behavior: seenCount.current === 0 ? 'auto' : 'smooth',
      block: 'end',
    })
    seenCount.current = messages.length
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return
    send(input)
    setInput('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isLoading = messagesLoading || matchLoading

  if (matchError) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-[var(--bg)] px-6 text-center">
        <p className="text-base font-semibold text-[var(--text-1)]">
          This conversation isn&apos;t available
        </p>
        <p className="max-w-xs text-sm text-[var(--text-2)]">
          It may have ended, or it may belong to a different account.
        </p>
        <Link
          href="/chat"
          className="inline-flex min-h-11 items-center rounded-full bg-[var(--bubble-own)] px-6 text-sm font-bold text-[var(--bubble-own-text)]"
        >
          Back to messages
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] min-w-0 flex-col overflow-x-hidden bg-[var(--bg)]">
      {/* Header */}
      <div className="bg-[var(--bg)]/90 sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-2 backdrop-blur-xl sm:gap-3 sm:px-4">
        <Link
          href="/chat"
          aria-label="Back to messages"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <ArrowLeft className="h-5 w-5 text-[var(--text-1)]" />
        </Link>

        {/* The photo and the name open this person's real profile, with a way back to this chat */}
        {(() => {
          const profileLink = otherUser
            ? profileHref(otherUser, `/chat/${matchId}`)
            : null
          const content = (
            <>
              <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border-2 border-[var(--border)] bg-[var(--bg-2)]">
                {otherUser?.avatar_url ? (
                  <Image
                    src={otherUser.avatar_url}
                    alt={otherUser.full_name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg">
                    {isCook ? '👨‍🍳' : '👤'}
                  </div>
                )}
                {otherUser?.is_verified && (
                  <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--bg)] bg-[var(--success)]">
                    <span className="text-[8px] font-bold text-white">✓</span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-[var(--text-1)]">
                  {otherUser?.full_name ||
                    (isLoading ? 'Loading…' : 'Food4Love member')}
                </h2>
                <p className="truncate text-xs text-[var(--text-2)]">
                  {isCook
                    ? otherUser?.is_verified
                      ? 'Verified home chef'
                      : 'Home chef'
                    : 'Food lover'}
                </p>
              </div>
            </>
          )
          return profileLink ? (
            <Link
              href={profileLink}
              aria-label={`View ${otherUser?.full_name || 'their'} profile`}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:gap-3"
            >
              {content}
            </Link>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              {content}
            </div>
          )
        })()}

        {/* Book Meal Button — opens modal, uses otherUser.id */}
        {isCook && otherUser && (
          <button
            onClick={() => setShowBooking(true)}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-[var(--bubble-own)] px-3 text-xs font-bold text-[var(--bubble-own-text)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            Book Meal
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4"
        role="log"
        aria-live="polite"
        aria-label="Conversation"
      >
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}
              >
                <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-[var(--bg-2)]" />
              </div>
            ))}
          </div>
        ) : messagesError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm font-semibold text-[var(--text-1)]">
              Messages could not load
            </p>
            <button
              type="button"
              onClick={() => void refetchMessages()}
              className="inline-flex min-h-11 items-center rounded-full bg-[var(--bubble-own)] px-6 text-sm font-bold text-[var(--bubble-own-text)]"
            >
              Try again
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center space-y-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-2)] text-3xl">
              💬
            </div>
            <h3 className="font-semibold text-[var(--text-1)]">
              Start chatting
            </h3>
            <p className="max-w-[220px] text-sm text-[var(--text-2)]">
              Say hello to {otherUser?.full_name || 'your match'} and plan your
              meal!
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_id === profile?.id
            const showDate =
              idx === 0 ||
              format(new Date(msg.created_at), 'yyyy-MM-dd') !==
                format(new Date(messages[idx - 1].created_at), 'yyyy-MM-dd')

            return (
              <div key={msg.id} className="space-y-1">
                {showDate && (
                  <div className="my-4 flex justify-center">
                    <span className="rounded-full bg-[var(--bg-2)] px-3 py-1 text-xs text-[var(--text-2)]">
                      {format(new Date(msg.created_at), 'MMMM d, yyyy')}
                    </span>
                  </div>
                )}
                <div
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[78%] ${
                      isMe
                        ? 'rounded-br-md bg-[var(--bubble-own)] text-[var(--bubble-own-text)]'
                        : 'rounded-bl-md border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-1)]'
                    } ${msg.status === 'sending' ? 'opacity-70' : ''}`}
                    style={{ overflowWrap: 'anywhere' }}
                  >
                    {msg.content}
                  </div>
                </div>
                <div
                  className={`flex items-center gap-2 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.status === 'failed' ? (
                    <>
                      <span className="text-[11px] font-medium text-[var(--danger)]">
                        Not sent
                      </span>
                      <button
                        type="button"
                        onClick={() => retry(msg.id)}
                        className="min-h-8 px-1 text-[11px] font-semibold text-[var(--accent)] underline"
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        onClick={() => discard(msg.id)}
                        className="min-h-8 px-1 text-[11px] font-semibold text-[var(--text-2)] underline"
                      >
                        Discard
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-[var(--text-2)]">
                      {msg.status === 'sending'
                        ? 'Sending…'
                        : format(new Date(msg.created_at), 'h:mm a')}
                      {isMe && !msg.status && msg.read_at && ' · Read'}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            aria-label="Message"
            rows={1}
            enterKeyHint="send"
            className="max-h-32 min-h-[24px] min-w-0 flex-1 resize-none bg-transparent py-1.5 text-base text-[var(--text-1)] outline-none placeholder:text-[var(--text-2)] sm:text-sm"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--bubble-own)] text-[var(--bubble-own-text)] transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Booking Modal */}
      {otherUser && profile?.id && (
        <BookingModal
          isOpen={showBooking}
          onClose={() => setShowBooking(false)}
          cookId={otherUser.id}
          cookName={otherUser.full_name}
          cookAvatar={otherUser.avatar_url}
          priceMin={otherUser.price_min || 2500}
          matchId={matchId as string}
        />
      )}
      <ChefChiLauncher />
    </div>
  )
}
