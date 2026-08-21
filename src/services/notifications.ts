import { createClient } from '@/lib/supabase/client'

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

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)

  if (error) {
    console.error('Unread count error:', error)
    return 0
  }
  return count ?? 0
}

export async function getNotifications(
  userId: string,
  limit = 20,
): Promise<Notification[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
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
