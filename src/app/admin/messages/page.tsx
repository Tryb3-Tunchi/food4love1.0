'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react'

interface SupportThread {
  id: string
  status: 'open' | 'closed'
  updated_at: string
}

interface SupportUser {
  id: string
  full_name: string | null
  role: 'buyer' | 'cook'
  avatar_url: string | null
  location: string | null
  is_verified: boolean | null
  kyc_status: string | null
  suspended: boolean | null
  thread: SupportThread | null
}

interface SupportMessage {
  id: string
  sender_id: string | null
  staff_actor_id: string | null
  sender_type: 'user' | 'staff'
  body: string
  created_at: string
}

const PAGE_SIZE = 25

export default function AdminMessagesPage() {
  const [users, setUsers] = useState<SupportUser[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [content, setContent] = useState('')
  const [reason, setReason] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [messagesError, setMessagesError] = useState('')
  const [sentNotice, setSentNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const selected = users.find((user) => user.id === selectedId)

  const loadUsers = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingUsers(true)
      setUsersError('')
      try {
        const params = new URLSearchParams({
          search,
          page: String(page),
          page_size: String(PAGE_SIZE),
        })
        const response = await fetch(`/api/admin/messages?${params}`, {
          cache: 'no-store',
          signal,
        })
        const result = await response.json()
        if (!response.ok)
          throw new Error(result.error || 'Could not load accounts')
        setUsers(result.users ?? [])
        setTotal(result.total ?? 0)
        setSelectedId((current) =>
          result.users?.some((user: SupportUser) => user.id === current)
            ? current
            : '',
        )
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setUsersError(
          error instanceof Error ? error.message : 'Could not load accounts',
        )
      } finally {
        if (!signal?.aborted) setLoadingUsers(false)
      }
    },
    [page, search],
  )

  const loadMessages = useCallback(
    async (userId: string, signal?: AbortSignal) => {
      if (!userId) {
        setMessages([])
        setMessagesError('')
        setLoadingMessages(false)
        return
      }
      setLoadingMessages(true)
      setMessagesError('')
      try {
        const response = await fetch(
          `/api/admin/messages?user_id=${encodeURIComponent(userId)}`,
          {
            cache: 'no-store',
            signal,
          },
        )
        const result = await response.json()
        if (!response.ok)
          throw new Error(result.error || 'Could not load conversation')
        setMessages(result.messages ?? [])
        setUsers((current) =>
          current.map((user) =>
            user.id === userId
              ? { ...user, ...result.profile, thread: result.thread }
              : user,
          ),
        )
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setMessagesError(
          error instanceof Error
            ? error.message
            : 'Could not load conversation',
        )
      } finally {
        if (!signal?.aborted) setLoadingMessages(false)
      }
    },
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(
      () => void loadUsers(controller.signal),
      search ? 250 : 0,
    )
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [loadUsers, refreshKey, search])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      setMessagesError('')
      return
    }
    const controller = new AbortController()
    void loadMessages(selectedId, controller.signal)
    // Poll the scoped support thread so replies appear without a broad realtime
    // subscription or relying on support_messages being in the Realtime publication.
    const interval = window.setInterval(
      () => void loadMessages(selectedId),
      15000,
    )
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [loadMessages, selectedId])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = content.trim()
    const contactReason = reason.trim()
    if (!selected || !text || contactReason.length < 5 || sending) return

    setSending(true)
    setMessagesError('')
    setSentNotice('')
    try {
      const response = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selected.id,
          content: text,
          reason: contactReason,
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not send message')
      setMessages((current) => [...current, result.message])
      setUsers((current) =>
        current.map((user) =>
          user.id === selected.id ? { ...user, thread: result.thread } : user,
        ),
      )
      setContent('')
      setReason('')
      setSentNotice('Reply sent as Food4Love Support.')
    } catch (error) {
      setMessagesError(
        error instanceof Error ? error.message : 'Could not send message',
      )
    } finally {
      setSending(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-7xl flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--text-1)] sm:p-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Support conversations</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-3)]">
            Contact buyers and cooks as Food4Love Support. Conversation access
            and staff replies are audited.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loadingUsers}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-medium hover:bg-[var(--bg-2)] disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${loadingUsers ? 'animate-spin' : ''}`}
          />{' '}
          Refresh
        </button>
      </header>

      <div className="grid min-h-[560px] flex-1 grid-cols-1 overflow-hidden rounded-lg border border-[var(--border)] md:grid-cols-[310px_1fr]">
        <aside className="flex max-h-[420px] flex-col border-b border-[var(--border)] md:max-h-none md:border-b-0 md:border-r">
          <label className="relative border-b border-[var(--border)]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-3)]" />
            <input
              aria-label="Search buyers and cooks"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search people"
              className="w-full bg-transparent py-3 pl-10 pr-3 text-sm outline-none placeholder:text-[var(--text-3)]"
            />
          </label>
          {usersError && (
            <div
              role="alert"
              className="border-b border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
            >
              {usersError}
            </div>
          )}
          <div className="flex-1 overflow-y-auto" aria-live="polite">
            {loadingUsers && users.length === 0 ? (
              <p className="flex items-center gap-2 p-4 text-sm text-[var(--text-3)]">
                <LoaderCircle className="h-4 w-4 animate-spin" /> Loading
                accounts…
              </p>
            ) : (
              users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedId(user.id)}
                  aria-current={selectedId === user.id ? 'true' : undefined}
                  className={`block w-full border-b border-[var(--border)] px-4 py-3 text-left transition ${selectedId === user.id ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--bg-2)]'}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">
                      {user.full_name || 'Food4Love member'}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${user.suspended ? 'bg-red-500/10 text-red-600 dark:text-red-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}
                    >
                      {user.suspended ? 'Suspended' : 'Active'}
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-xs capitalize text-[var(--text-3)]">
                    {user.role}
                    {user.location ? ` · ${user.location}` : ''}
                    {user.role === 'cook' && user.is_verified
                      ? ' · verified cook'
                      : ''}
                  </span>
                  <span className="mt-1 block text-[10px] text-[var(--text-3)]">
                    {user.thread
                      ? 'Support conversation open'
                      : 'No support conversation'}
                  </span>
                </button>
              ))
            )}
            {!loadingUsers && !usersError && users.length === 0 && (
              <p className="p-4 text-sm text-[var(--text-3)]">
                No buyers or cooks found.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--text-3)]">
            <span>
              {total
                ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`
                : 'No accounts'}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={page <= 1 || loadingUsers}
                onClick={() => setPage((value) => value - 1)}
                className="rounded p-1.5 hover:bg-[var(--bg-2)] disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next page"
                disabled={page >= pageCount || loadingUsers}
                onClick={() => setPage((value) => value + 1)}
                className="rounded p-1.5 hover:bg-[var(--bg-2)] disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        <section className="flex min-h-[500px] min-w-0 flex-col">
          <div className="border-b border-[var(--border)] px-4 py-3">
            <p className="text-sm font-semibold">
              {selected
                ? `${selected.full_name || 'Member'} · ${selected.role}`
                : 'Select a buyer or cook'}
            </p>
            {selected && (
              <p className="mt-1 text-xs text-[var(--text-3)]">
                {selected.suspended
                  ? 'Suspended account · support contact remains available'
                  : 'Account active'}
                {selected.kyc_status ? ` · KYC ${selected.kyc_status}` : ''}
              </p>
            )}
          </div>
          {messagesError && (
            <div
              role="alert"
              className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-300"
            >
              {messagesError}
            </div>
          )}
          {sentNotice && (
            <p
              role="status"
              className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300"
            >
              {sentNotice}
            </p>
          )}
          <div
            className="flex-1 space-y-3 overflow-y-auto p-4"
            aria-live="polite"
          >
            {loadingMessages && messages.length === 0 && selected && (
              <p className="flex items-center gap-2 text-sm text-[var(--text-3)]">
                <LoaderCircle className="h-4 w-4 animate-spin" /> Loading
                conversation…
              </p>
            )}
            {messages.map((message) => {
              const isStaff = message.sender_type === 'staff'
              return (
                <article
                  key={message.id}
                  className={`max-w-[85%] rounded-lg border p-3 ${isStaff ? 'border-[var(--accent)]/25 ml-auto bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--bg-2)]'}`}
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase text-[var(--text-3)]">
                    {isStaff
                      ? 'Food4Love Support'
                      : selected?.full_name || 'Member'}
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
            {selected &&
              !loadingMessages &&
              messages.length === 0 &&
              !messagesError && (
                <div className="flex min-h-48 flex-col items-center justify-center text-[var(--text-3)]">
                  <MessageCircle className="mb-2 h-7 w-7 opacity-50" />
                  <p className="text-sm">No conversation yet</p>
                  <p className="mt-1 text-xs">
                    Your first message opens a support thread.
                  </p>
                </div>
              )}
            {!selected && (
              <div className="flex min-h-48 flex-col items-center justify-center text-[var(--text-3)]">
                <MessageCircle className="mb-2 h-7 w-7 opacity-50" />
                <p className="text-sm">
                  Choose an account to view support history
                </p>
              </div>
            )}
          </div>

          <form
            onSubmit={sendMessage}
            className="space-y-2 border-t border-[var(--border)] p-3"
          >
            <label className="block">
              <span className="sr-only">Support reason for audit</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={!selected || sending}
                maxLength={1000}
                placeholder="Support reason (recorded in the admin audit log)"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)] disabled:opacity-50"
              />
            </label>
            <div className="flex gap-2">
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                disabled={!selected || sending}
                maxLength={4000}
                rows={2}
                placeholder="Send as Food4Love Support…"
                aria-label="Support message"
                className="min-w-0 flex-1 resize-y rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--text-3)] focus:border-[var(--accent)] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={
                  !selected ||
                  !content.trim() ||
                  reason.trim().length < 5 ||
                  sending
                }
                aria-label="Send support message"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center self-end rounded-lg bg-[var(--accent)] text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-3)]">
              Messages are sent as Food4Love Support. A reason of at least five
              characters is required.
            </p>
          </form>
        </section>
      </div>
    </div>
  )
}
