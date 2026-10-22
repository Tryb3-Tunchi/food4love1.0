'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  Bell,
  CalendarDays,
  Check,
  Heart,
  MessageCircle,
  Settings,
  Star,
} from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { markAllAsRead } from '@/services/notifications'
import { useAuthStore } from '@/stores/useAuthStore'
import { Sheet } from '@/components/ui/Sheet'

const notificationIcons = {
  match: Heart,
  like: Heart,
  message: MessageCircle,
  booking: CalendarDays,
  request: Bell,
  review: Star,
  system: Bell,
}

function formatTime(date: string) {
  const elapsed = Math.max(0, Date.now() - new Date(date).getTime())
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const profile = useAuthStore((state) => state.profile)
  const { notifications, unreadCount, isLoading, error, refetch } =
    useNotifications()
  const hasUnread = notifications.some((notification) => !notification.read)

  const handleMarkAllRead = async () => {
    if (!profile?.id || !hasUnread) return
    try {
      await markAllAsRead(profile.id)
      refetch()
      toast.success('Notifications marked as read')
    } catch {
      toast.error('Could not update notifications')
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          unreadCount > 0
            ? `Open notifications, ${unreadCount} unread`
            : 'Open notifications'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-2)] transition hover:bg-[var(--bg-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        returnFocusRef={triggerRef}
        title="Notifications"
      >
        <section aria-label="Notification inbox">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 pb-4">
            <p className="text-sm text-[var(--text-2)]">
              Your latest Food4Love updates
            </p>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={!hasUnread}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" />
              Mark all read
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-3 px-5 py-5" role="status">
              <span className="sr-only">Loading notifications</span>
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex animate-pulse gap-3">
                  <div className="h-10 w-10 rounded-full bg-[var(--bg-2)]" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 w-2/3 rounded bg-[var(--bg-2)]" />
                    <div className="h-3 w-full rounded bg-[var(--bg-2)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-semibold text-[var(--text-1)]">
                Notifications could not load
              </p>
              <button
                type="button"
                onClick={refetch}
                className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                Try again
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Bell className="h-5 w-5" />
              </span>
              <p className="mt-4 text-sm font-semibold text-[var(--text-1)]">
                You’re all caught up
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[var(--text-3)]">
                Updates about your conversations, matches and bookings will
                appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type] ?? Bell
                const unread = !notification.read
                return (
                  <li
                    key={notification.id}
                    className={`flex items-start gap-3 px-5 py-4 ${unread ? 'bg-[var(--accent-soft)]/40' : ''}`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${unread ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--bg-2)] text-[var(--text-3)]'}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-[var(--text-1)]">
                          {notification.title}
                        </p>
                        <time
                          dateTime={notification.created_at}
                          className="shrink-0 pt-0.5 text-[10px] text-[var(--text-3)]"
                        >
                          {formatTime(notification.created_at)}
                        </time>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-2)]">
                        {notification.body}
                      </p>
                    </div>
                    {unread && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]">
                        <span className="sr-only">Unread</span>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <footer className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-[var(--text-2)] hover:text-[var(--accent)]"
            >
              View notification history
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              <Settings className="h-3.5 w-3.5" />
              Preferences
            </Link>
          </footer>
        </section>
      </Sheet>
    </>
  )
}
