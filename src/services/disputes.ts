import { createClient } from '@/lib/supabase/client'
const sb = () => createClient()

export interface Dispute {
  id: string
  booking_id: string
  raised_by: string
  against: string
  reason: string
  description: string
  evidence_urls?: string[]
  status:
    | 'open'
    | 'ai_reviewed'
    | 'admin_review'
    | 'resolved_buyer'
    | 'resolved_chef'
    | 'resolved_partial'
  ai_recommendation?: string
  ai_reasoning?: string
  ai_confidence?: number
  admin_notes?: string
  resolution?: string
  refund_amount?: number
  created_at: string
  updated_at: string
}

export async function raiseDispute(
  data: Pick<
    Dispute,
    | 'booking_id'
    | 'raised_by'
    | 'against'
    | 'reason'
    | 'description'
    | 'evidence_urls'
  >,
): Promise<Dispute> {
  const { data: dispute, error } = await sb()
    .from('disputes')
    .insert({ ...data, status: 'open' })
    .select()
    .single()
  if (error) throw error
  // Trigger AI analysis
  fetch('/api/ai/dispute-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dispute: data }),
  })
    .then(async (res) => {
      const ai = await res.json()
      await sb()
        .from('disputes')
        .update({
          status: 'ai_reviewed',
          ai_recommendation: ai.recommendation,
          ai_reasoning: ai.reasoning,
          ai_confidence: ai.confidence,
        })
        .eq('id', dispute.id)
    })
    .catch(() => {})
  return dispute
}

export async function getDisputes(adminMode = false): Promise<Dispute[]> {
  if (adminMode) {
    const response = await fetch('/api/admin/disputes', { cache: 'no-store' })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || 'Could not load disputes')
    return result.disputes ?? []
  }

  const q = sb()
    .from('disputes')
    .select(
      '*, booking:bookings(*, cook:profiles!bookings_cook_id_fkey(*), buyer:profiles!bookings_buyer_id_fkey(*))',
    )
    .order('created_at', { ascending: false })
  const { data } = adminMode ? await q : await q.limit(20)
  return data ?? []
}

export async function resolveDispute(
  id: string,
  resolution: string,
  outcome: 'buyer' | 'cook' | 'partial',
  adminNotes: string,
) {
  const response = await fetch('/api/admin/disputes', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, outcome, resolution, admin_notes: adminNotes }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'Could not resolve dispute')
  return result.dispute
}
