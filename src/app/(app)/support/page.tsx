'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { LoaderCircle, MessageCircle, RefreshCw, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface SupportMessage {
  id: string
  thread_id: string
  sender_type: 'user' | 'staff'
  body: string
  created_at: string
}

function appendMessage(
  current: SupportMessage[],
  incoming: SupportMessage,
): SupportMessage[] {
  if (current.some((message) => message.id === incoming.id)) return current
  return [...current, incoming].sort(
    (left, right) =>
      new Date(left.created_at).getTime() -
      new Date(right.created_at).getTime(),
  )
}

function mergeMessages(
  current: SupportMessage[],
  history: SupportMessage[],
  activeThreadId: string | undefined,
): SupportMessage[] {
  const byId = new Map<string, SupportMessage>()
  for (const message of history) byId.set(message.id, message)
  for (const message of current) {
    if (activeThreadId && message.thread_id === activeThreadId) {
      byId.set(message.id, message)
    }
  }
  return Array.from(byId.values()).sort(
    (left, right) =>
      new Date(left.created_at).getTime() -
      new Date(right.created_at).getTime(),
  )
}

export default function SupportPage() {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [threadId, setThreadId] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [realtimeReady, setRealtimeReady] = useState(false)

  const loadMessages = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/support', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not load support messages')
      setMessages((current) =>
        mergeMessages(current, result.messages ?? [], result.thread?.id),
      )
      setThreadId(result.thread?.id ?? '')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not load support messages',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (!threadId) {
      setRealtimeReady(false)
      return
    }

    setRealtimeReady(false)
    const channel = supabase
      .channel(`member-support-messages:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          setMessages((current) =>
            appendMessage(current, payload.new as SupportMessage),
          )
        },
      )
      .subscribe((status) => {
        const connected = status === 'SUBSCRIBED'
        setRealtimeReady(connected)
        // Reload history after joining so messages sent during setup aren't missed.
        if (connected) void loadMessages()
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadMessages, supabase, threadId])

  useEffect(() => {
    if (!threadId || realtimeReady) return
    const interval = window.setInterval(() => void loadMessages(), 15000)
    return () => window.clearInterval(interval)
  }, [loadMessages, realtimeReady, threadId])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = body.trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not send support message')
      setThreadId(result.thread.id)
      setMessages((current) => appendMessage(current, result.message))
      setBody('')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not send support message',
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-3xl flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-1)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div>
          <h1 className="text-lg font-bold">Food4Love Support</h1>
          <p className="mt-1 text-sm text-[var(--text-3)]">
            Send a message to the support team. Replies appear in this
            conversation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {threadId && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-3)]">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${realtimeReady ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
              {realtimeReady ? 'Live' : 'Auto-refresh'}
            </span>
          )}
          <button
            type="button"
            aria-label="Refresh support conversation"
            onClick={() => void loadMessages()}
            disabled={loading}
            className="rounded-lg p-2 text-[var(--text-3)] hover:bg-[var(--bg-2)] hover:text-[var(--text-1)] disabled:opacity-50"
          >
            <RefreshCw
              aria-hidden="true"
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </header>
      <div
        className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5"
        aria-live="polite"
      >
        {loading && messages.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-[var(--text-3)]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading conversation…
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadMessages()}
              className="font-semibold underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}
        {messages.map((message) => {
          const isStaff = message.sender_type === 'staff'
          return (
            <article
              key={message.id}
              className={`max-w-[85%] rounded-lg border p-3 ${isStaff ? 'border-[var(--accent)]/20 bg-[var(--accent-soft)]' : 'ml-auto border-[var(--border)] bg-[var(--bg-2)]'}`}
            >
              <p className="mb-1 text-[10px] font-semibold uppercase text-[var(--text-3)]">
                {isStaff ? 'Food4Love Support' : 'You'}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">
                {message.body}
              </p>
              <time className="mt-2 block text-right text-[10px] text-[var(--text-3)]">
                {new Date(message.created_at).toLocaleString()}
              </time>
            </article>
          )
        })}
        {!loading && !error && messages.length === 0 && (
          <div className="flex min-h-48 flex-col items-center justify-center text-center text-[var(--text-3)]">
            <MessageCircle className="mb-2 h-7 w-7 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="mt-1 text-xs">
              Send a message to start a conversation.
            </p>
          </div>
        )}
      </div>
      <form
        onSubmit={sendMessage}
        className="flex gap-2 border-t border-[var(--border)] p-3 sm:p-4"
      >
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={sending}
          maxLength={4000}
          placeholder="Write to Food4Love Support..."
          aria-label="Support message"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!body.trim() || sending}
          aria-label="Send support message"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-white disabled:opacity-50"
        >
          {sending ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Send aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </form>
    </section>
  )
}
