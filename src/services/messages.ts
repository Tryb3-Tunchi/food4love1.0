import { createClient } from '@/lib/supabase/client'
import { Message } from '@/types/db'

const sb = () => createClient()

export async function getMessages(matchId: string): Promise<Message[]> {
  const { data } = await sb()
    .from('messages')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function sendMessage(
  matchId: string,
  senderId: string,
  content: string,
): Promise<Message> {
  const { data, error } = await sb()
    .from('messages')
    .insert({ match_id: matchId, sender_id: senderId, content })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markMessagesRead(matchId: string, userId: string) {
  await sb()
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .neq('sender_id', userId)
    .is('read_at', null)
}

// Marks the other person's messages as read. Prefers the `mark_messages_read`
// database function (see supabase-migration-chat-read-receipts.sql) because it
// can only touch read_at on messages the caller received. If that migration has
// not been applied yet it falls back to a direct update, which works only where
// the table already allows it. Returns false when nothing could be saved, so
// the caller never shows a "Read" state that is not stored.
export async function markConversationRead(
  matchId: string,
  userId: string,
): Promise<boolean> {
  const supabase = sb()
  const { error } = await supabase.rpc('mark_messages_read', {
    p_match_id: matchId,
  })
  if (!error) return true

  const { error: updateError } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('match_id', matchId)
    .neq('sender_id', userId)
    .is('read_at', null)
  return !updateError
}
