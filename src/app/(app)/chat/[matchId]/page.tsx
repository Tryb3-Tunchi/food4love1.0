'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useMessages } from '@/hooks/useMessages'
import { useAuthStore } from '@/stores/useAuthStore'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, ArrowLeft, Calendar } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { BookingModal } from '@/components/booking/BookingModal'

interface Profile {
  id: string
  full_name: string
  avatar_url?: string | null
  role: 'cook' | 'buyer'
  bio?: string | null
  location?: string | null
  cuisines?: string[]
  photos?: string[]
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
    sendMessage,
  } = useMessages(matchId as string)
  const [input, setInput] = useState('')
  const [showBooking, setShowBooking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // FETCH REAL MATCH + OTHER USER PROFILE
  const { data: matchDetail, isLoading: matchLoading } = useQuery<MatchDetail>({
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
  })

  // otherUser = the person you're chatting with
  const otherUser: Profile | null = matchDetail
    ? matchDetail.user1_id === profile?.id
      ? matchDetail.user2
      : matchDetail.user1
    : null

  const isCook = otherUser?.role === 'cook'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return
    await sendMessage.mutateAsync(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isLoading = messagesLoading || matchLoading

  return (
    <div className="flex h-[100dvh] flex-col bg-[var(--bg)]">
      {/* Header */}
      <div className="bg-[var(--bg)]/90 sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-3 backdrop-blur-xl">
        <Link
          href="/chat"
          className="-ml-2 rounded-full p-2 transition-colors hover:bg-[var(--bg-2)]"
        >
          <ArrowLeft className="h-5 w-5 text-[var(--text)]" />
        </Link>

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
          <h2 className="truncate text-sm font-semibold text-[var(--text)]">
            {otherUser?.full_name || 'Loading...'}
          </h2>
          <p className="flex items-center gap-1 text-xs text-[var(--success)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" />
            {isCook ? 'Verified Home Chef' : 'Food Lover'}
          </p>
        </div>

        {isCook && (
          <button
            onClick={() => setShowBooking(true)}
            className="bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--primary)] transition-colors"
          >
            <Calendar className="h-3.5 w-3.5" />
            Book Meal
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
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
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center space-y-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-2)] text-3xl">
              💬
            </div>
            <h3 className="font-semibold text-[var(--text)]">Start chatting</h3>
            <p className="max-w-[200px] text-sm text-[var(--text-muted)]">
              Say hello to {otherUser?.full_name || 'your match'} and plan your
              meal!
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => {
              const isMe = msg.sender_id === profile?.id
              const showDate =
                idx === 0 ||
                format(new Date(msg.created_at), 'yyyy-MM-dd') !==
                  format(new Date(messages[idx - 1].created_at), 'yyyy-MM-dd')

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-1"
                >
                  {showDate && (
                    <div className="my-4 flex justify-center">
                      <span className="rounded-full bg-[var(--bg-2)] px-3 py-1 text-xs text-[var(--text-muted)]">
                        {format(new Date(msg.created_at), 'MMMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  <div
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[78%] break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isMe
                          ? 'rounded-br-md bg-[var(--primary)] text-white'
                          : 'rounded-bl-md border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text)]'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                  <div
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'} px-1`}
                  >
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {format(new Date(msg.created_at), 'h:mm a')}
                      {isMe && msg.read_at && ' · Read'}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-4 py-3">
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="max-h-32 min-h-[20px] flex-1 resize-none bg-transparent py-1.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className="shrink-0 rounded-xl bg-[var(--primary)] p-2.5 text-white transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Booking Modal */}
      {otherUser && profile?.id && (
        <BookingModal
          isOpen={showBooking}
          onClose={() => setShowBooking(false)}
          cook={{
            id: otherUser.id,
            full_name: otherUser.full_name,
            avatar_url: otherUser.avatar_url || undefined,
            daily_specials: [],
            price_min: otherUser.price_min || 2500,
          }}
          matchId={matchId as string}
          buyerId={profile.id}
        />
      )}
    </div>
  )
}
