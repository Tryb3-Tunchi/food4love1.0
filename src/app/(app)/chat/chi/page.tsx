'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { ArrowLeft, Send, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { clearChi, getChiMessages, sendToChi } from '@/services/chefChi'
import { ChefChiAvatar } from '@/components/chat/ChefChiCard'
import {
  CHI_MAX_MESSAGE,
  CHI_NAME,
  chiSuggestions,
  chiWelcome,
  type ChiMessage,
} from '@/lib/chefChi'

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
      queryClient.setQueryData<ChiMessage[]>(queryKey, (old = []) => [
        ...old,
        {
          id: `pending-${Date.now()}`,
          role: 'user',
          content: text,
          created_at: new Date().toISOString(),
        },
      ])
    },
    onError: (error: Error, text) => {
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
    <div className="flex h-[100dvh] flex-col bg-[var(--bg)] pb-[4.25rem]">
      {/* Header */}
      <div className="bg-[var(--bg)]/90 sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-3 backdrop-blur-xl">
        <Link
          href="/chat"
          className="-ml-2 rounded-full p-2 transition-colors hover:bg-[var(--bg-2)]"
        >
          <ArrowLeft className="h-5 w-5 text-[var(--text)]" />
        </Link>
        <ChefChiAvatar size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 truncate text-sm font-semibold text-[var(--text)]">
            {CHI_NAME}
            <span className="f4l-badge f4l-badge-accent">AI</span>
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Your food buddy, always online
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
            className="rounded-full p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-2)]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {isLoading && (
          <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-[var(--bg-2)]" />
        )}

        {showWelcome && (
          <>
            <div className="flex justify-start">
              <div className="max-w-[78%] rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--bg-2)] px-4 py-2.5 text-sm leading-relaxed text-[var(--text)]">
                {chiWelcome(firstName, profile?.role)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {chiSuggestions(profile?.role).map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => submit(suggestion)}
                  className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg-2)]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMe = msg.role === 'user'
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="space-y-1"
              >
                <div
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
                  </span>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {send.isPending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--bg-2)] px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-muted)]"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg)] px-4 pb-2 pt-3">
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={CHI_MAX_MESSAGE}
            placeholder="Ask Chef Chi anything..."
            rows={1}
            className="max-h-32 min-h-[20px] flex-1 resize-none bg-transparent py-1.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <button
            onClick={() => submit(input)}
            disabled={!input.trim() || send.isPending}
            aria-label="Send"
            className="shrink-0 rounded-xl bg-[var(--primary)] p-2.5 text-white transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="pt-1.5 text-center text-[10px] text-[var(--text-muted)]">
          Chef Chi is an AI and can make mistakes. Check allergies and prices
          with your chef.
        </p>
      </div>
    </div>
  )
}
