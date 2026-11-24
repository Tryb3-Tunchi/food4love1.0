'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  LifeBuoy,
  LoaderCircle,
  MessageCircle,
  Minus,
  Send,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type SupportMessage = {
  id: string
  thread_id: string
  sender_type: 'user' | 'guest' | 'staff'
  body: string
  created_at: string
}
type SupportThread = { id: string; status: 'open' | 'in_progress' | 'resolved' }

const supportPaths = [
  '/waitlist',
  '/discover',
  '/swipe',
  '/matches',
  // '/chat',
  '/profile',
  '/bookings',
  '/stories',
  '/notifications',
  '/settings',
  '/',
]

export function FloatingSupportWidget() {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [thread, setThread] = useState<SupportThread | null>(null)
  const [viewer, setViewer] = useState<'guest' | 'account'>('guest')
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [guestEmail, setGuestEmail] = useState('')
  const [guestName, setGuestName] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [live, setLive] = useState(false)

  const visible =
    pathname === '/' ||
    supportPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )

  const loadConversation = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/support', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || 'Support chat could not be loaded')
      setViewer(data.mode === 'account' ? 'account' : 'guest')
      setThread(data.thread ?? null)
      setMessages(data.messages ?? [])
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Support chat could not be loaded',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || minimized) return
    void loadConversation()
  }, [loadConversation, minimized, open])

  useEffect(() => {
    if (!open || minimized || !thread || viewer !== 'account') {
      setLive(false)
      return
    }
    setLive(false)
    const channel = supabase
      .channel(`support-widget:${thread.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `thread_id=eq.${thread.id}`,
        },
        (event) => {
          const incoming = event.new as SupportMessage
          if (incoming.sender_type === 'staff')
            setMessages((current) =>
              current.some((item) => item.id === incoming.id)
                ? current
                : [...current, incoming].sort(
                    (a, b) =>
                      Date.parse(a.created_at) - Date.parse(b.created_at),
                  ),
            )
        },
      )
      .subscribe((status) => {
        const connected = status === 'SUBSCRIBED'
        setLive(connected)
        if (connected) void loadConversation()
      })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadConversation, minimized, open, supabase, thread, viewer])

  useEffect(() => {
    if (
      !open ||
      minimized ||
      (live && viewer === 'account') ||
      !thread ||
      thread.status === 'resolved'
    )
      return
    const interval = window.setInterval(() => void loadConversation(), 7000)
    return () => window.clearInterval(interval)
  }, [live, loadConversation, minimized, open, thread, viewer])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!body.trim() || sending) return
    setSending(true)
    setError('')
    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim(),
          ...(!thread
            ? { guest_email: guestEmail.trim(), guest_name: guestName.trim() }
            : {}),
        }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || 'Your message could not be sent')
      setViewer(data.mode === 'account' ? 'account' : 'guest')
      setThread(data.thread)
      setMessages((current) =>
        current.some((item) => item.id === data.message.id)
          ? current
          : [...current, data.message].sort(
              (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
            ),
      )
      setBody('')
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : 'Your message could not be sent',
      )
    } finally {
      setSending(false)
    }
  }

  if (!visible) return null
  return (
    <div className="fixed bottom-24 right-4 z-[70] sm:bottom-6 sm:right-6">
      {open && !minimized && (
        <section
          aria-label="Food4Love support chat"
          className="mb-3 flex h-[min(72dvh,560px)] w-[min(92vw,370px)] flex-col overflow-hidden rounded-2xl border border-emerald-900/10 bg-[var(--card,#fffdf8)] text-[var(--text-1,#2f211b)] shadow-[0_24px_80px_rgba(20,40,30,.24)] ring-1 ring-black/5"
        >
          <header className="flex items-center justify-between bg-[#0f3d24] px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">
                <LifeBuoy className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-bold">Food4Love Support</h2>
                <p className="text-[11px] text-white/75">
                  {thread?.status === 'resolved'
                    ? 'This conversation is resolved'
                    : live
                      ? 'Replies update live'
                      : 'We’ll reply here as soon as we can'}
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Minimize chat"
                onClick={() => setMinimized(true)}
                className="rounded-lg p-2 hover:bg-white/10"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Close chat"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>
          <div
            className="flex-1 space-y-3 overflow-y-auto bg-[#fbf7ed] p-3"
            aria-live="polite"
          >
            {loading && messages.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-stone-600">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading your conversation…
              </p>
            )}
            {messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-[88%] rounded-2xl px-3 py-2 ${message.sender_type === 'staff' ? 'ml-auto rounded-br-md bg-[#0f3d24] text-white' : 'rounded-bl-md border border-stone-200 bg-white text-stone-900'}`}
              >
                <p className="whitespace-pre-wrap break-words text-sm">
                  {message.body}
                </p>
                <time
                  className={`mt-1 block text-right text-[10px] ${message.sender_type === 'staff' ? 'text-white/65' : 'text-stone-500'}`}
                >
                  {new Date(message.created_at).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </time>
              </article>
            ))}
            {!loading && !thread && (
              <div className="rounded-xl border border-dashed border-stone-300 bg-white/70 p-3 text-center text-xs leading-5 text-stone-600">
                <MessageCircle className="mx-auto mb-2 h-5 w-5 text-emerald-800" />
                Ask us about your account, cooks, bookings or using Food4Love.
                For a guest conversation, we’ll ask for an email so we can
                follow up.
              </div>
            )}
            {thread?.status === 'resolved' && (
              <p className="rounded-lg bg-stone-200/70 p-2 text-center text-xs text-stone-600">
                This thread is resolved. Sending a new message will open a new
                conversation.
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-2 text-xs text-red-700"
              >
                {error}
              </p>
            )}
          </div>
          <form
            onSubmit={(event) => void sendMessage(event)}
            className="space-y-2 border-t border-stone-200 bg-white p-3"
          >
            {!thread && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label="Your name (optional)"
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  maxLength={80}
                  placeholder="Name (optional)"
                  className="min-h-9 min-w-0 rounded-lg border border-stone-200 px-2 text-xs text-stone-900 outline-none focus:border-emerald-800"
                />
                <input
                  aria-label="Your email"
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(event) => setGuestEmail(event.target.value)}
                  maxLength={254}
                  placeholder="Email for reply"
                  className="min-h-9 min-w-0 rounded-lg border border-stone-200 px-2 text-xs text-stone-900 outline-none focus:border-emerald-800"
                />
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                aria-label="Your support message"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                required
                maxLength={4000}
                rows={2}
                placeholder="Write a message…"
                className="min-h-10 min-w-0 flex-1 resize-none rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-900 outline-none placeholder:text-stone-500 focus:border-emerald-800"
              />
              <button
                type="submit"
                aria-label="Send support message"
                disabled={
                  sending || !body.trim() || (!thread && !guestEmail.trim())
                }
                className="grid min-h-10 w-11 shrink-0 place-items-center self-end rounded-xl bg-[#0f3d24] text-white transition hover:bg-[#185332] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-stone-500">
              Support is not monitored 24/7. Replies will appear here; guest
              visitors should keep this browser available.
            </p>
          </form>
        </section>
      )}
      <button
        type="button"
        aria-label={open ? 'Open support chat' : 'Contact Food4Love support'}
        aria-expanded={open && !minimized}
        onClick={() => {
          setOpen(true)
          setMinimized(false)
        }}
        className="group ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#0f3d24] text-white shadow-[0_12px_32px_rgba(15,61,36,.34)] transition duration-300 hover:-translate-y-1 hover:bg-[#185332] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
      >
        <MessageCircle className="h-6 w-6 transition group-hover:scale-110" />
        <span className="pointer-events-none absolute -top-1 right-0 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-[#f6b90b]" />
      </button>
      {minimized && (
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="sr-only"
        >
          Restore support chat
        </button>
      )}
    </div>
  )
}
