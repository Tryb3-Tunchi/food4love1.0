import type { PersonPreview } from '@/lib/matching/activity'

export type LikeState = 'pending' | 'passed' | 'matched' | 'waiting'

export interface LikePerson extends PersonPreview {
  is_verified: boolean | null
  bio: string | null
}

export interface LikeItem {
  created_at: string
  superlike: boolean
  state: LikeState
  match_id: string | null
  person: LikePerson
}

export interface LikesPage {
  items: LikeItem[]
  total: number
  next: string | null
}

export async function fetchLikes(
  type: 'received' | 'sent',
  before?: string | null,
): Promise<LikesPage> {
  const params = new URLSearchParams({ type, limit: '30' })
  if (before) params.set('before', before)
  const response = await fetch(`/api/likes?${params}`, { cache: 'no-store' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Could not load likes')
  return body as LikesPage
}
