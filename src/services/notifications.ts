import { createClient } from '@/lib/supabase/client'
import type { NotificationPreferences } from '@/types/db'

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  messages: true,
  swipeActivity: true,
  bookings: true,
  reviews: true,
}

export interface Notification {
  id: string
  user_id: string
  type:
    'match' | 'like' | 'message' | 'booking' | 'request' | 'review' | 'system'
  title: string
  body: string
  data: Record<string, unknown>
  read: boolean
  created_at: string
}

function getVisibleTypes(preferences: NotificationPreferences): string[] {
  const types = ['system']
  if (preferences.messages) types.push('message')
  if (preferences.swipeActivity) types.push('match', 'like', 'request')
  if (preferences.bookings) types.push('booking')
  if (preferences.reviews) types.push('review')
  return types
}

export async function getUnreadCount(
  userId: string,
  preferences = DEFAULT_NOTIFICATION_PREFERENCES,
): Promise<number> {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
    .in('type', getVisibleTypes(preferences))

  if (error) {
    console.error('Unread count error:', error)
    return 0
  }
  return count ?? 0
}

export async function getNotifications(
  userId: string,
  limit = 20,
  preferences = DEFAULT_NOTIFICATION_PREFERENCES,
): Promise<Notification[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .in('type', getVisibleTypes(preferences))
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function markAsRead(notificationId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)

  if (error) throw error
}

export async function markAllAsRead(userId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) throw error
}
