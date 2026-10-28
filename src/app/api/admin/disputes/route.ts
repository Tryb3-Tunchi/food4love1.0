import { getAdminUser } from '@/lib/admin/auth'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const resolutionSchema = z.object({
  id: z.string().uuid(),
  outcome: z.enum(['buyer', 'cook', 'partial']),
  resolution: z.string().trim().min(10).max(3000),
  admin_notes: z.string().trim().max(3000).optional(),
})

export async function GET() {
  const actor = await getAdminUser('disputes:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('disputes')
    .select(
      'id, booking_id, raised_by, against, reason, description, evidence_urls, status, ai_recommendation, ai_reasoning, ai_confidence, admin_notes, resolution, created_at, updated_at, booking:bookings(id, status, payment_status, amount, total_amount, payment_reference, delivery_date, delivery_time, cook:profiles!bookings_cook_id_fkey(id, full_name), buyer:profiles!bookings_buyer_id_fkey(id, full_name))',
    )
    .order('created_at', { ascending: false })
    .limit(200)
  if (error)
    return NextResponse.json(
      { error: 'Could not load disputes' },
      { status: 500 },
    )
  return NextResponse.json({ disputes: data ?? [] })
}

export async function PATCH(request: NextRequest) {
  const actor = await getAdminUser('disputes:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = resolutionSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid dispute resolution' },
      { status: 400 },
    )

  const audit = await beginAdminAudit({
    actorId: actor.id,
    action: 'dispute.resolve',
    targetType: 'dispute',
    targetId: parsed.data.id,
    details: {
      outcome: parsed.data.outcome,
      resolution: parsed.data.resolution,
      admin_notes: parsed.data.admin_notes ?? null,
      payment_refund_processed: false,
    },
  }).catch(() => null)
  if (!audit)
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )

  const status = {
    buyer: 'resolved_buyer',
    cook: 'resolved_chef',
    partial: 'resolved_partial',
  }[parsed.data.outcome]
  const { data, error } = await audit.admin
    .from('disputes')
    .update({
      status,
      resolution: parsed.data.resolution,
      admin_notes: parsed.data.admin_notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .in('status', ['open', 'ai_reviewed', 'admin_review'])
    .select('id, status, resolution, admin_notes, updated_at')
    .maybeSingle()

  try {
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      error || !data ? 'failed' : 'succeeded',
      error?.message ??
        (!data ? 'Dispute is not open for resolution' : undefined),
    )
  } catch {
    return NextResponse.json(
      { error: 'Action processed, but its audit outcome needs review' },
      { status: 500 },
    )
  }
  if (error)
    return NextResponse.json(
      { error: 'Could not resolve dispute' },
      { status: 500 },
    )
  if (!data)
    return NextResponse.json(
      { error: 'Dispute is not open for resolution' },
      { status: 409 },
    )
  return NextResponse.json({ dispute: data, payment_refund_processed: false })
}
