'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { format, isToday, isYesterday } from 'date-fns'
import toast from 'react-hot-toast'
import { Send, Trash2, X } from 'lucide-react'
import { askChi } from '@/services/chefChi'
import { ChefChiAvatar } from '@/components/chat/ChefChiAvatar'
import {
  CHI_MAX_MESSAGE,
  CHI_NAME,
  CHI_STORED_MESSAGES,
  chiSuggestions,
  chiWelcome,
  type ChiMessage,
} from '@/lib/chefChi'

const storageKey = (userId: string) => `chef-chi:${userId}`

// The chat lives in this browser only.
function loadChat(userId: string): ChiMessage[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]')
    return Array.isArray(parsed) ? parsed.slice(-CHI_STORED_MESSAGES) : []
  } catch {
    return []
  }
}

function saveChat(userId: string, messages: ChiMessage[]) {
  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify(messages.slice(-CHI_STORED_MESSAGES)),
    )
  } catch {
    // Storage can be full or blocked. The chat still works for this visit.
  }
}

function dayLabel(date: Date) {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMMM d, yyyy')
}

export function ChefChiPanel({
  userId,
  role,
  firstName,
  onClose,
}: {
  userId: string
  role?: string | null
  firstName: string
  onClose: () => void
}) {
  const [messages, setMessages] = useState<ChiMessage[]>(() => loadChat(userId))
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    saveChat(userId, messages)
  }, [userId, messages])

  // Follow the conversation, but leave the welcome screen at the top.
  useEffect(() => {
    if (messages.length === 0 && !sending) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const send = async (text: string) => {
    const message = text.trim()
    if (!message || sending) return

    const mine: ChiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    }
    setMessages((current) => [...current, mine])
    setInput('')
    setSending(true)

    try {
      const reply = await askChi([...messages, mine])
      setMessages((current) => [...current, reply])
    } catch (error) {
      // Take the unsent message back out of the chat and into the input box.
      setMessages((current) => current.filter((m) => m.id !== mine.id))
      setInput(message)
      toast.error(
        error instanceof Error ? error.message : 'Chef Chi could not reply',
      )
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send(input)
    }
  }

  const clearChat = () => {
    if (window.confirm('Clear your chat with Chef Chi?')) setMessages([])
  }

  return createPortal(
    <>
      <motion.div
        key="chi-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[64] bg-black/40 sm:hidden"
      />
      <motion.div
        key="chi-panel"
        role="dialog"
        aria-label="Chat with Chef Chi"
        initial={{ opacity: 0, y: 48, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 48, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="fixed inset-x-0 bottom-0 top-10 z-[65] flex flex-col overflow-hidden rounded-t-[1.75rem] border border-[var(--border)] bg-[var(--bg)] shadow-2xl sm:inset-auto sm:bottom-[6.5rem] sm:right-6 sm:h-[min(620px,calc(100dvh-8rem))] sm:w-[400px] sm:rounded-[1.75rem]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <span className="relative shrink-0">
            <ChefChiAvatar size={44} talking={sending} />
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
              {sending ? 'typing…' : 'online'}
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              aria-label="Clear chat"
              className="rounded-full p-2 transition-colors hover:bg-[var(--bg-2)]"
              style={{ color: 'var(--text-3)' }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 transition-colors hover:bg-[var(--bg-2)]"
            style={{ color: 'var(--text-2)' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div
          className="scrollbar-none min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4"
          style={{
            backgroundImage:
              'radial-gradient(color-mix(in srgb, var(--accent) 12%, transparent) 1.2px, transparent 1.2px)',
            backgroundSize: '22px 22px',
          }}
        >
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center px-3 pb-1 pt-3 text-center"
            >
              <motion.div
                initial={{ scale: 0.6, rotate: -8 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 12 }}
                className="rounded-full shadow-lift"
              >
                <ChefChiAvatar size={92} />
              </motion.div>
              <h3
                className="mt-2 font-heading text-xl font-bold"
                style={{ color: 'var(--text-1)' }}
              >
                {CHI_NAME}
              </h3>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-3)' }}>
                AI kitchen buddy · can make mistakes
              </p>
              <div
                className="mt-3 max-w-[19rem] rounded-2xl rounded-tl-md px-4 py-2.5 text-left text-sm leading-relaxed shadow-sm"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-1)',
                }}
              >
                {chiWelcome(firstName, role)}
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {chiSuggestions(role).map((suggestion, i) => (
                  <motion.button
                    key={suggestion}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + i * 0.08 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => void send(suggestion)}
                    className="rounded-full px-3.5 py-2 text-xs font-semibold"
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

          {sending && (
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
        <div className="shrink-0 border-t border-[var(--border)] px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5">
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
              onClick={() => void send(input)}
              disabled={!input.trim() || sending}
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
            Chef Chi is an AI. Double-check prices and anything important.
          </p>
        </div>
      </motion.div>
    </>,
    document.body,
  )
}
