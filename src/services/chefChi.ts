import { createClient } from '@/lib/supabase/client'
import type { ChiMessage } from '@/lib/chefChi'

export async function getChiMessages(userId: string): Promise<ChiMessage[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('id, role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return ((data ?? []) as ChiMessage[]).reverse()
}

export async function sendToChi(message: string): Promise<ChiMessage> {
  const res = await fetch('/api/ai/chef-chi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? 'Chef Chi could not reply')
  return body.message as ChiMessage
}

export async function clearChi() {
  const res = await fetch('/api/ai/chef-chi', { method: 'DELETE' })
  if (!res.ok) throw new Error('Could not clear the chat')
}
