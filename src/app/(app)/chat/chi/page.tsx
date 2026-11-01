'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { format, isToday, isYesterday } from 'date-fns'
import toast from 'react-hot-toast'
import { ArrowLeft, Send, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { clearChi, getChiMessages, sendToChi } from '@/services/chefChi'
import { ChefChiAvatar } from '@/components/chat/ChefChiAvatar'
import {
  CHI_MAX_MESSAGE,
  CHI_NAME,
  chiSuggestions,
  chiWelcome,
  type ChiMessage,
} from '@/lib/chefChi'

function dayLabel(date: Date) {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMMM d, yyyy')
}

export default function ChefChiPage() {
  const profile = useAuthStore((s) => s.profile)
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const queryKey = ['chef-chi', profile?.id]

  const { data: messages = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getChiMessages(profile!.id),
    enabled: !!profile?.id,
    retry: false,
  })

  const send = useMutation({
    mutationFn: sendToChi,
    onMutate: async (text: string) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<ChiMessage[]>(queryKey)
      queryClient.setQueryData<ChiMessage[]>(queryKey, (old = []) => [
        ...old,
        {
          id: `pending-${Date.now()}`,
          role: 'user',
          content: text,
          created_at: new Date().toISOString(),
        },
      ])
      return { previous }
    },
    onError: (error: Error, text, context) => {
      // Take the unsent message back out of the chat and into the input box.
      queryClient.setQueryData(queryKey, context?.previous ?? [])
      toast.error(error.message)
      setInput((current) => current || text)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  const clear = useMutation({
    mutationFn: clearChi,
    onSuccess: () => queryClient.setQueryData(queryKey, []),
    onError: (error: Error) => toast.error(error.message),
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, send.isPending])

  const submit = (text: string) => {
    const message = text.trim()
    if (!message || send.isPending) return
    setInput('')
    send.mutate(message)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit(input)
    }
  }

  const firstName = profile?.full_name?.trim().split(' ')[0] ?? ''
  const showWelcome = !isLoading && messages.length === 0

  return (
    <div className="flex h-[100dvh] flex-col bg-[var(--bg)] pb-[5.5rem]">
      {/* Header */}
      <div className="bg-[var(--bg)]/90 sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-3 py-2.5 backdrop-blur-xl">
        <Link
          href="/chat"
          aria-label="Back to chats"
          className="rounded-full p-2 transition-colors hover:bg-[var(--bg-2)]"
        >
          <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text-1)' }} />
        </Link>
        <span className="relative shrink-0">
          <ChefChiAvatar size={44} talking={send.isPending} />
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--bg)] bg-[var(--success)]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            className="flex items-center gap-2 truncate text-sm font-semibold"
            style={{ color: 'var(--text-1)' }}
          >
            {CHI_NAME}
            <span className="f4l-badge f4l-badge-accent">AI</span>
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            {send.isPending ? 'typing…' : 'online'}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm('Clear your chat with Chef Chi?'))
                clear.mutate()
            }}
            disabled={clear.isPending}
            aria-label="Clear chat"
            className="rounded-full p-2 transition-colors hover:bg-[var(--bg-2)]"
            style={{ color: 'var(--text-3)' }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4"
        style={{
          backgroundImage:
            'radial-gradient(color-mix(in srgb, var(--accent) 12%, transparent) 1.2px, transparent 1.2px)',
          backgroundSize: '22px 22px',
        }}
      >
        {isLoading && (
          <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-[var(--bg-2)]" />
        )}

        {showWelcome && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center px-4 pb-2 pt-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.6, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 12 }}
              className="rounded-full shadow-lift"
            >
              <ChefChiAvatar size={132} />
            </motion.div>
            <h3
              className="mt-4 font-heading text-2xl font-bold"
              style={{ color: 'var(--text-1)' }}
            >
              {CHI_NAME}
            </h3>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
              AI kitchen buddy · can make mistakes
            </p>
            <div
              className="relative mt-5 max-w-[19rem] rounded-2xl rounded-tl-md px-4 py-3 text-left text-sm leading-relaxed shadow-sm"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--text-1)',
              }}
            >
              {chiWelcome(firstName, profile?.role)}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {chiSuggestions(profile?.role).map((suggestion, i) => (
                <motion.button
                  key={suggestion}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.08 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => submit(suggestion)}
                  className="rounded-full px-3.5 py-2 text-xs font-semibold transition-colors"
                  style={{
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    border:
                      '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
                  }}
                >
                  {suggestion}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isMe = msg.role === 'user'
            const date = new Date(msg.created_at)
            const showDay =
              idx === 0 ||
              format(date, 'yyyy-MM-dd') !==
                format(new Date(messages[idx - 1].created_at), 'yyyy-MM-dd')
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              >
                {showDay && (
                  <div className="my-3 flex justify-center">
                    <span
                      className="rounded-full px-3 py-1 text-[11px] font-semibold"
                      style={{
                        background: 'var(--card)',
                        color: 'var(--text-3)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {dayLabel(date)}
                    </span>
                  </div>
                )}
                <div
                  className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMe && <ChefChiAvatar size={28} animated={false} />}
                  <div
                    className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                      isMe ? 'rounded-br-md text-white' : 'rounded-bl-md'
                    }`}
                    style={
                      isMe
                        ? {
                            background:
                              'linear-gradient(135deg, #ff9a52, var(--accent))',
                          }
                        : {
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-1)',
                          }
                    }
                  >
                    {msg.content}
                    <span
                      className={`ml-2 inline-block translate-y-1 text-[10px] ${
                        isMe ? 'text-white/70' : ''
                      }`}
                      style={isMe ? undefined : { color: 'var(--text-3)' }}
                    >
                      {format(date, 'h:mm a')}
                    </span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {send.isPending && (
          <div className="flex items-end gap-2">
            <ChefChiAvatar size={28} talking />
            <div
              className="flex items-center gap-1 rounded-2xl rounded-bl-md px-4 py-3"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full"
                  style={{
                    background: 'var(--text-3)',
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-3 pb-2 pt-2.5">
        <div className="flex items-end gap-2">
          <div
            className="flex flex-1 items-end rounded-3xl px-4 py-2"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={CHI_MAX_MESSAGE}
              placeholder="Message Chef Chi"
              rows={1}
              className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent py-1 text-sm outline-none"
              style={{ color: 'var(--text-1)' }}
            />
          </div>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => submit(input)}
            disabled={!input.trim() || send.isPending}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #ff9a52, var(--accent))',
              boxShadow: 'var(--shadow-warm)',
            }}
          >
            <Send className="h-[18px] w-[18px]" />
          </motion.button>
        </div>
        <p
          className="pt-1.5 text-center text-[10px]"
          style={{ color: 'var(--text-3)' }}
        >
          Chef Chi is an AI. Check allergies and prices with your chef.
        </p>
      </div>
    </div>
  )
}
