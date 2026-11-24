'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CircleUserRound,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type ThreadStatus = 'open' | 'in_progress' | 'resolved'
type SupportMessage = {
  id: string
  thread_id: string
  sender_id: string | null
  staff_actor_id: string | null
  sender_type: 'user' | 'guest' | 'staff'
  body: string
  created_at: string
  is_internal_note: boolean
}
type SupportThread = {
  id: string
  user_id: string | null
  guest_name: string | null
  guest_email: string | null
  status: ThreadStatus
  assigned_to: string | null
  updated_at: string
  last_message_at: string | null
  unread: boolean
  profile: null | {
    full_name: string | null
    role: string | null
    location: string | null
    is_verified: boolean | null
    kyc_status: string | null
    suspended: boolean | null
  }
}
type Assignee = { id: string; name: string }

const statusLabel: Record<ThreadStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
}

export default function AdminLiveSupportPage() {
  const supabase = useMemo(() => createClient(), [])
  const [threads, setThreads] = useState<SupportThread[]>([])
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ThreadStatus>('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingConversation, setLoadingConversation] = useState(false)
  const [error, setError] = useState('')
  const [live, setLive] = useState(false)
  const [alertConfigured, setAlertConfigured] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [reason, setReason] = useState('')
  const [internalNote, setInternalNote] = useState(false)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  const loadThreads = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams({
          search,
          status: statusFilter,
          page: String(page),
        })
        const response = await fetch(`/api/admin/support?${params}`, {
          cache: 'no-store',
          signal,
        })
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error || 'Could not load support inbox')
        setThreads(data.threads ?? [])
        setAssignees(data.assignees ?? [])
        setTotal(data.total ?? 0)
        setAlertConfigured(Boolean(data.email_alert_configured))
        setSelectedId((current) =>
          data.threads?.some((item: SupportThread) => item.id === current)
            ? current
            : '',
        )
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === 'AbortError'
        )
          return
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load support inbox',
        )
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [page, search, statusFilter],
  )

  const loadConversation = useCallback(
    async (threadId: string, signal?: AbortSignal) => {
      if (!threadId) return
      setLoadingConversation(true)
      try {
        const response = await fetch(
          `/api/admin/support?thread_id=${encodeURIComponent(threadId)}`,
          { cache: 'no-store', signal },
        )
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error || 'Could not load conversation')
        if (!signal?.aborted) {
          setMessages(data.messages ?? [])
          setThreads((current) =>
            current.map((thread) =>
              thread.id === threadId
                ? {
                    ...thread,
                    ...data.thread,
                    profile: data.profile ?? thread.profile,
                    unread: false,
                  }
                : thread,
            ),
          )
        }
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === 'AbortError'
        )
          return
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Could not load conversation',
        )
      } finally {
        if (!signal?.aborted) setLoadingConversation(false)
      }
    },
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(
      () => void loadThreads(controller.signal),
      search ? 250 : 0,
    )
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [loadThreads, search])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    const controller = new AbortController()
    void loadConversation(selectedId, controller.signal)
    return () => controller.abort()
  }, [loadConversation, selectedId])

  useEffect(() => {
    const channel = supabase
      .channel('admin-live-support-inbox')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_threads' },
        () => void loadThreads(),
      )
      .subscribe((state) => {
        const connected = state === 'SUBSCRIBED'
        setLive(connected)
        // Load the inbox only after the channel is active to avoid a missed event gap.
        if (connected) void loadThreads()
      })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadThreads, supabase])

  useEffect(() => {
    if (!selectedId) return
    const channel = supabase
      .channel(`admin-live-support:${selectedId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `thread_id=eq.${selectedId}`,
        },
        (event) => {
          const incoming = event.new as SupportMessage
          setMessages((current) =>
            current.some((message) => message.id === incoming.id)
              ? current
              : [...current, incoming].sort(
                  (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
                ),
          )
        },
      )
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') void loadConversation(selectedId)
      })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadConversation, selectedId, supabase])

  useEffect(() => {
    if (live) return
    const timer = window.setInterval(() => {
      void loadThreads()
      if (selectedId) void loadConversation(selectedId)
    }, 12000)
    return () => window.clearInterval(timer)
  }, [live, loadConversation, loadThreads, selectedId])

  async function updateThread(input: {
    status?: ThreadStatus
    assigned_to?: string | null
  }) {
    if (!selectedId || saving) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/admin/support/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || 'Could not update conversation')
      setThreads((current) =>
        current.map((thread) =>
          thread.id === selectedId ? { ...thread, ...data.thread } : thread,
        ),
      )
      setNotice('Conversation updated.')
      await loadThreads()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not update conversation',
      )
    } finally {
      setSaving(false)
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !selectedId ||
      !messageText.trim() ||
      reason.trim().length < 5 ||
      sending
    )
      return
    setSending(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/admin/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: selectedId,
          body: messageText.trim(),
          reason: reason.trim(),
          internal_note: internalNote,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save message')
      setMessages((current) =>
        current.some((message) => message.id === data.message.id)
          ? current
          : [...current, data.message],
      )
      setMessageText('')
      setReason('')
      setNotice(internalNote ? 'Internal note saved.' : 'Reply sent.')
      await loadThreads()
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : 'Could not send reply',
      )
    } finally {
      setSending(false)
    }
  }

  const selected = threads.find((thread) => thread.id === selectedId)
  const pageCount = Math.max(1, Math.ceil(total / 25))

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-7xl flex-col p-3 text-[var(--admin-text)] sm:p-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--admin-accent)]">
            Support operations
          </p>
          <h1 className="mt-1 text-2xl font-bold">Live support</h1>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            Guest, customer, and cook conversations. Internal notes are
            staff-only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${live ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-500' : 'bg-amber-500'}`}
            />
            {live ? 'Live updates' : 'Auto-refresh'}
          </span>
          <button
            type="button"
            aria-label="Refresh inbox"
            onClick={() => void loadThreads()}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--admin-border)] px-3 text-sm font-medium hover:bg-[var(--admin-hover)]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>
      {!alertConfigured && (
        <p className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
          Support email alerts are disabled until SUPPORT_EMAIL and
          RESEND_API_KEY are configured on the server.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mb-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-700"
        >
          {notice}
        </p>
      )}

      <div className="grid min-h-[620px] flex-1 overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] md:grid-cols-[330px_minmax(0,1fr)]">
        <aside
          className={`${selectedId ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-b border-[var(--admin-border)] md:border-b-0 md:border-r`}
        >
          <div className="space-y-2 border-b border-[var(--admin-border)] p-3">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted)]" />
              <input
                aria-label="Search support conversations"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search name or guest email"
                className="min-h-10 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] pl-9 pr-3 text-sm outline-none focus:border-[var(--admin-accent)]"
              />
            </label>
            <select
              aria-label="Filter support status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as typeof statusFilter)
                setPage(1)
              }}
              className="min-h-10 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
            {loading && threads.length === 0 ? (
              <p className="flex items-center gap-2 p-4 text-sm text-[var(--admin-muted)]">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading conversations…
              </p>
            ) : (
              threads.map((thread) => {
                const name =
                  thread.profile?.full_name ||
                  thread.guest_name ||
                  'Food4Love visitor'
                const label = thread.profile?.role || 'Guest'
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedId(thread.id)}
                    aria-current={selectedId === thread.id ? 'true' : undefined}
                    className={`w-full border-b border-[var(--admin-border)] px-4 py-3 text-left transition ${selectedId === thread.id ? 'bg-[var(--admin-accent-soft)]' : 'hover:bg-[var(--admin-hover)]'}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">
                        {name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${thread.status === 'resolved' ? 'bg-slate-500/10 text-slate-600' : thread.status === 'in_progress' ? 'bg-blue-500/10 text-blue-700' : 'bg-emerald-500/10 text-emerald-700'}`}
                      >
                        {statusLabel[thread.status]}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs capitalize text-[var(--admin-muted)]">
                      {label}
                      {thread.profile?.location
                        ? ` · ${thread.profile.location}`
                        : ''}
                      {thread.profile?.is_verified ? ' · verified cook' : ''}
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[var(--admin-muted)]">
                      <span>
                        {thread.assigned_to
                          ? `Assigned · ${assignees.find((person) => person.id === thread.assigned_to)?.name ?? 'Admin'}`
                          : 'Unassigned'}
                      </span>
                      <span>
                        {thread.unread && (
                          <span className="mr-1 rounded-full bg-red-500 px-1.5 py-0.5 text-white">
                            New
                          </span>
                        )}
                        {new Date(thread.updated_at).toLocaleDateString()}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
            {!loading && threads.length === 0 && (
              <div className="p-5 text-center text-sm text-[var(--admin-muted)]">
                <MessageCircle className="mx-auto mb-2 h-6 w-6 opacity-60" />
                No support conversations found.
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-3 py-2 text-xs text-[var(--admin-muted)]">
            <span>
              {total
                ? `${Math.min((page - 1) * 25 + 1, total)}–${Math.min(page * 25, total)} of ${total}`
                : 'No conversations'}
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => value - 1)}
                className="rounded px-2 py-1 hover:bg-[var(--admin-hover)] disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= pageCount || loading}
                onClick={() => setPage((value) => value + 1)}
                className="rounded px-2 py-1 hover:bg-[var(--admin-hover)] disabled:opacity-40"
              >
                Next
              </button>
            </span>
          </div>
        </aside>

        <section
          className={`${selectedId ? 'flex' : 'hidden md:flex'} min-h-[600px] min-w-0 flex-col`}
        >
          {selected ? (
            <>
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId('')}
                    aria-label="Back to conversations"
                    className="rounded-lg p-2 hover:bg-[var(--admin-hover)] md:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <CircleUserRound className="h-8 w-8 shrink-0 text-[var(--admin-muted)]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {selected.profile?.full_name ||
                        selected.guest_name ||
                        'Food4Love visitor'}
                    </p>
                    <p className="truncate text-xs text-[var(--admin-muted)]">
                      {selected.profile
                        ? `${selected.profile.role ?? 'Member'}${selected.profile.location ? ` · ${selected.profile.location}` : ''}${selected.profile.suspended ? ' · suspended' : ''}`
                        : selected.guest_email}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label="Conversation status"
                    value={selected.status}
                    disabled={saving}
                    onChange={(event) =>
                      void updateThread({
                        status: event.target.value as ThreadStatus,
                      })
                    }
                    className="min-h-9 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] px-2 text-xs"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <select
                    aria-label="Assign conversation"
                    value={selected.assigned_to ?? ''}
                    disabled={saving}
                    onChange={(event) =>
                      void updateThread({
                        assigned_to: event.target.value || null,
                      })
                    }
                    className="min-h-9 max-w-40 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] px-2 text-xs"
                  >
                    <option value="">Unassigned</option>
                    {assignees.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </div>
              </header>
              {selected.profile?.role === 'cook' &&
                selected.profile.kyc_status && (
                  <p className="border-b border-[var(--admin-border)] px-4 py-2 text-xs text-[var(--admin-muted)]">
                    Cook verification: {selected.profile.kyc_status}
                  </p>
                )}
              <div
                className="bg-[var(--admin-bg)]/50 flex-1 space-y-3 overflow-y-auto p-4"
                aria-live="polite"
              >
                {loadingConversation && messages.length === 0 && (
                  <p className="flex items-center gap-2 text-sm text-[var(--admin-muted)]">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Loading history…
                  </p>
                )}
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`max-w-[90%] rounded-xl border p-3 ${message.is_internal_note ? 'border-amber-400/40 bg-amber-500/10' : message.sender_type === 'staff' ? 'border-[var(--admin-accent)]/25 ml-auto bg-[var(--admin-accent-soft)]' : 'border-[var(--admin-border)] bg-[var(--admin-surface)]'}`}
                  >
                    <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--admin-muted)]">
                      {message.is_internal_note && (
                        <ShieldCheck className="h-3 w-3" />
                      )}
                      {message.is_internal_note
                        ? 'Internal note · staff only'
                        : message.sender_type === 'staff'
                          ? 'Food4Love Support'
                          : message.sender_type === 'guest'
                            ? 'Guest'
                            : selected.profile?.full_name || 'Member'}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {message.body}
                    </p>
                    <time className="mt-2 block text-right text-[10px] text-[var(--admin-muted)]">
                      {new Date(message.created_at).toLocaleString()}
                    </time>
                  </article>
                ))}
                {!loadingConversation && messages.length === 0 && (
                  <p className="py-12 text-center text-sm text-[var(--admin-muted)]">
                    No messages yet. Send the first support reply.
                  </p>
                )}
              </div>
              <form
                onSubmit={(event) => void sendMessage(event)}
                className="space-y-2 border-t border-[var(--admin-border)] p-3"
              >
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={internalNote}
                    onChange={(event) => setInternalNote(event.target.checked)}
                  />
                  Add internal note (not visible to customer)
                </label>
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={1000}
                  required
                  placeholder="Reason for this support action (audit log)"
                  className="min-h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-xs"
                />
                <div className="flex gap-2">
                  <textarea
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    disabled={sending}
                    rows={2}
                    maxLength={4000}
                    required
                    placeholder={
                      internalNote
                        ? 'Staff-only note…'
                        : 'Reply to the customer or cook…'
                    }
                    className="min-w-0 flex-1 resize-y rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--admin-accent)] disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={
                      sending || !messageText.trim() || reason.trim().length < 5
                    }
                    className="inline-flex min-h-10 shrink-0 items-center gap-2 self-end rounded-lg bg-[var(--admin-accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {sending ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {internalNote ? 'Save note' : 'Reply'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-[var(--admin-muted)]">
              <MessageCircle className="mb-3 h-8 w-8 opacity-50" />
              <p className="font-semibold">Select a conversation</p>
              <p className="mt-1 text-sm">
                New guest, customer and cook messages appear in this inbox.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
