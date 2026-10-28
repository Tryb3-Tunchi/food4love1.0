'use client'

import { FormEvent, useEffect, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import toast from 'react-hot-toast'

interface SupportMessage {
  id: string
  sender_type: 'user' | 'staff'
  body: string
  created_at: string
}

export default function SupportPage() {
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  async function loadMessages() {
    setLoading(true)
    try {
      const response = await fetch('/api/support', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not load support messages')
      setMessages(result.messages ?? [])
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not load support messages',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMessages()
  }, [])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = body.trim()
    if (!text) return
    setSending(true)
    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not send support message')
      setMessages((current) => [...current, result.message])
      setBody('')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not send support message',
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-3xl flex-col rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <header className="border-b border-[var(--border)] px-5 py-4">
        <h1 className="text-lg font-bold text-[var(--text-1)]">
          Food4Love Support
        </h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Send a message to the support team. Replies will appear here.
        </p>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        {loading ? (
          <p className="text-sm text-[var(--text-3)]">
            Loading conversation...
          </p>
        ) : messages.length ? (
          messages.map((message) => {
            const isStaff = message.sender_type === 'staff'
            return (
              <article
                key={message.id}
                className={`max-w-[85%] rounded-lg border p-3 ${isStaff ? 'border-[var(--accent)]/20 bg-[var(--accent-soft)]' : 'ml-auto border-[var(--border)] bg-[var(--bg-2)]'}`}
              >
                <p className="mb-1 text-[10px] font-semibold uppercase text-[var(--text-3)]">
                  {isStaff ? 'Food4Love Support' : 'You'}
                </p>
                <p className="whitespace-pre-wrap break-words text-sm text-[var(--text-1)]">
                  {message.body}
                </p>
                <time className="mt-2 block text-right text-[10px] text-[var(--text-3)]">
                  {new Date(message.created_at).toLocaleString()}
                </time>
              </article>
            )
          })
        ) : (
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
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!body.trim() || sending}
          aria-label="Send support message"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  )
}
