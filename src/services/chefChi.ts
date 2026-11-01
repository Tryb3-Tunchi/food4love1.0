import { CHI_HISTORY_LIMIT, type ChiMessage } from '@/lib/chefChi'

// Sends the recent chat to the server and returns Chef Chi's reply. Nothing
// is stored on the server.
export async function askChi(messages: ChiMessage[]): Promise<ChiMessage> {
  const res = await fetch('/api/ai/chef-chi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages
        .slice(-CHI_HISTORY_LIMIT)
        .map(({ role, content }) => ({ role, content })),
    }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error ?? 'Chef Chi could not reply')

  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: body.reply as string,
    created_at: new Date().toISOString(),
  }
}
