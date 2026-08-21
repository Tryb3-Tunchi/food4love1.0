'use client'

import { useNotifications } from '@/hooks/useNotifications'
import { markAllAsRead } from '@/services/notifications'
import { useAuthStore } from '@/stores/useAuthStore'
import { Bell, Heart, MessageCircle, Calendar, Star, Check } from 'lucide-react'
import Link from 'next/link'

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
  const profile = useAuthStore((s) => s.profile)
  const { notifications, isLoading, refetch } = useNotifications()

  const handleMarkAllRead = async () => {
    if (!profile?.id) return
    await markAllAsRead(profile.id)
    refetch()
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    )
  }

  const hasUnread = notifications.some((n) => !n.read)

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24 pt-4">
      <div className="mx-auto max-w-lg px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          {/* <h1 className="text-2xl font-bold text-[var(--text)]">Notifications</h1> */}
          {hasUnread && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--border)] hover:text-[var(--text)]"
            >
              <Check className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* Empty State */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="mb-4 h-12 w-12 text-[var(--text-muted)] opacity-40" />
            <p className="text-lg font-medium text-[var(--text-muted)]">
              No notifications yet
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)] opacity-60">
              When someone likes, matches, or books you, it shows here
            </p>
          </div>
        ) : (
          /* Notification List */
          <div className="space-y-2">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type] ?? Bell
              const isUnread = !notification.read

              return (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 rounded-2xl p-4 transition-colors ${
                    isUnread ? 'bg-[var(--primary)]/10' : 'bg-[var(--surface)]'
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      isUnread ? 'bg-[var(--primary)]/20' : 'bg-[var(--border)]'
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${
                        isUnread
                          ? 'text-[var(--primary)]'
                          : 'text-[var(--text-muted)]'
                      }`}
                    />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-medium ${
                        isUnread
                          ? 'text-[var(--text)]'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {notification.title}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                      {notification.body}
                    </p>
                    <p className="mt-1.5 text-xs text-[var(--text-muted)] opacity-50">
                      {timeAgo(notification.created_at)}
                    </p>
                  </div>

                  {/* Unread Dot */}
                  {isUnread && (
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
