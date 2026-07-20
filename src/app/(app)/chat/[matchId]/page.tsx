'use client'
import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Send, Sparkles } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMatches } from '@/hooks/useMatches'
import { useMessages } from '@/hooks/useMessages'
import { useAuthStore } from '@/stores/useAuthStore'

const AI_SUGGESTIONS = [
  "What's your specialty today?",
  'Are you available this weekend?',
  'Can you cater for 6 people?',
]

export default function ChatPage() {
  const router = useRouter()
  const params = useParams()
  const matchId = params.matchId as string
  const { data: matches } = useMatches()
  const { data: messages, isLoading, send } = useMessages(matchId)
  const profile = useAuthStore((s) => s.profile)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const match = matches?.find((m) => m.id === matchId)
  const otherUser = match?.other_user

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || !profile?.id) return
    send.mutate(input.trim())
    setInput('')
  }

  if (isLoading) {
    return (
      <div
        className="flex h-[100dvh] flex-col"
        style={{ background: 'var(--bg)' }}
      >
        <div
          className="flex shrink-0 items-center gap-3 px-4 py-4"
          style={{
            background: 'var(--card)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-6 w-32" />
        </div>
      </div>
    )
  }

  if (!otherUser) {
    return (
      <div
        className="flex h-[100dvh] items-center justify-center"
        style={{ background: 'var(--bg)' }}
      >
        <EmptyState
          icon="💬"
          title="Conversation not found"
          description="This conversation may have been deleted"
          action={
            <button
              onClick={() => router.back()}
              className="rounded-full px-6 py-3 text-sm font-bold text-white"
              style={{ background: 'var(--accent)' }}
            >
              Go back
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div
      className="flex h-[100dvh] flex-col"
      style={{ background: 'var(--bg)' }}
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-3 border-b px-4 py-3"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-all active:scale-90"
          style={{ background: 'var(--bg-2)' }}
        >
          <ArrowLeft className="h-4 w-4" style={{ color: 'var(--text-2)' }} />
        </button>

        <Avatar
          src={otherUser.avatar_url}
          name={otherUser.full_name}
          size="md"
          verified={otherUser.is_verified}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="truncate font-heading text-sm font-semibold"
              style={{ color: 'var(--text-1)' }}
            >
              {otherUser.full_name}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="scrollbar-none flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {!messages?.length ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 py-8"
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-3xl"
              style={{ background: 'var(--bg-2)' }}
            >
              <Avatar
                src={otherUser.avatar_url}
                name={otherUser.full_name}
                size="lg"
              />
            </div>
            <div className="text-center">
              <p
                className="font-heading text-base font-bold"
                style={{ color: 'var(--text-1)' }}
              >
                {otherUser.full_name}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
                You matched! Say hello 👋
              </p>
            </div>

            <div
              className="w-full rounded-2xl p-3"
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="mb-2 flex items-center gap-1.5">
                <Sparkles
                  className="h-3.5 w-3.5"
                  style={{ color: 'var(--accent)' }}
                />
                <span
                  className="text-xs font-bold"
                  style={{ color: 'var(--accent)' }}
                >
                  Quick messages
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {AI_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s)
                    }}
                    className="rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all active:scale-[0.98]"
                    style={{
                      background: 'var(--card)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-2)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          messages.map((msg, i) => {
            const isOwn = msg.sender_id === profile?.id
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i < 3 ? 0 : 0.05 }}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                {!isOwn && (
                  <div className="mr-2 mt-auto">
                    <Avatar
                      src={otherUser.avatar_url}
                      name={otherUser.full_name}
                      size="sm"
                    />
                  </div>
                )}
                <div className="max-w-[72%]">
                  <div
                    className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                    style={{
                      background: isOwn ? 'var(--accent)' : 'var(--card)',
                      color: isOwn ? 'white' : 'var(--text-1)',
                      border: isOwn ? 'none' : '1px solid var(--border)',
                      borderBottomRightRadius: isOwn ? '4px' : undefined,
                      borderBottomLeftRadius: !isOwn ? '4px' : undefined,
                    }}
                  >
                    {msg.content}
                  </div>
                  <p
                    className="mt-1 px-1 text-[10px]"
                    style={{
                      color: 'var(--text-3)',
                      textAlign: isOwn ? 'right' : 'left',
                    }}
                  >
                    {new Date(msg.created_at).toLocaleTimeString('en-NG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </motion.div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="safe-bottom shrink-0 border-t px-4 py-3"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-end gap-2">
          <div
            className="flex-1 overflow-hidden rounded-2xl"
            style={{
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Write a message..."
              className="w-full bg-transparent px-4 py-3 text-sm outline-none"
              style={{ color: 'var(--text-1)' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || send.isPending || !profile?.id}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-90 disabled:opacity-40"
            style={{
              background: input.trim() ? 'var(--accent)' : 'var(--bg-2)',
              boxShadow: input.trim()
                ? '0 4px 16px rgba(232,116,40,0.3)'
                : 'none',
            }}
          >
            <Send
              className="h-4 w-4"
              style={{ color: input.trim() ? 'white' : 'var(--text-3)' }}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
