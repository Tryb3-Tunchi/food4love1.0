'use client'

import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useNotifications } from '@/hooks/useNotifications'
import { notificationHref } from '@/lib/notificationRoutes'
import type { Notification } from '@/services/notifications'
import { useAuthStore } from '@/stores/useAuthStore'
import { Bell, Heart, MessageCircle, Calendar, Star, Check } from 'lucide-react'

const typeIcons = {
  match: Heart,
  like: Heart,
  message: MessageCircle,
  booking: Calendar,
  request: Bell,
  review: Star,
  system: Bell,
}

// Simple relative time formatter (no date-fns needed, keeps bundle light)
function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export default function NotificationsPage() {
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const {
    notifications,
    isLoading,
    error,
    refetch,
    markRead,
    markEverythingRead,
  } = useNotifications()

  const handleMarkAllRead = async () => {
    if (!profile?.id) return
    const saved = await markEverythingRead()
    if (!saved) toast.error('Could not update notifications')
  }

  const handleOpen = (notification: Notification) => {
    const href = notificationHref(notification, profile?.role)
    void markRead(notification.id).then((saved) => {
      if (!saved) toast.error('Could not save that this was read')
    })
    if (href) router.push(href)
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent"
          role="status"
        >
          <span className="sr-only">Loading notifications</span>
        </div>
      </div>
    )
  }

  const hasUnread = notifications.some((n) => !n.read)

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24 pt-4">
      <div className="mx-auto max-w-lg px-4">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--text-1)]">
            Notifications
          </h1>
          {hasUnread && (
            <button
              onClick={handleMarkAllRead}
              className="flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--bg-2)] hover:text-[var(--text-1)]"
            >
              <Check className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {error ? (
          <div className="py-16 text-center">
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
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="mb-4 h-12 w-12 text-[var(--text-3)] opacity-60" />
            <p className="text-lg font-medium text-[var(--text-1)]">
              No notifications yet
            </p>
            <p className="mt-1 text-sm text-[var(--text-2)]">
              When someone likes, matches, or books you, it shows here
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type] ?? Bell
              const isUnread = !notification.read

              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => handleOpen(notification)}
                    className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                      isUnread
                        ? 'border-[var(--accent)]/30 bg-[var(--accent-soft)]'
                        : 'border-[var(--border)] bg-[var(--card)]'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        isUnread
                          ? 'bg-[var(--accent-soft)]'
                          : 'bg-[var(--bg-2)]'
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          isUnread
                            ? 'text-[var(--accent)]'
                            : 'text-[var(--text-3)]'
                        }`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`break-words font-semibold ${
                          isUnread
                            ? 'text-[var(--text-1)]'
                            : 'text-[var(--text-2)]'
                        }`}
                      >
                        {notification.title}
                      </p>
                      <p className="mt-0.5 break-words text-sm text-[var(--text-2)]">
                        {notification.body}
                      </p>
                      <p className="mt-1.5 text-xs text-[var(--text-2)]">
                        {timeAgo(notification.created_at)}
                      </p>
                    </div>

                    {isUnread && (
                      <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]">
                        <span className="sr-only">Unread</span>
                      </div>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
