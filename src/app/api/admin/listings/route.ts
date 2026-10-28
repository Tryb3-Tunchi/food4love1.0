import { getAdminUser } from '@/lib/admin/auth'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const moderationSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['remove', 'restore']),
  reason: z.string().trim().min(5).max(1000),
})

export async function GET() {
  const actor = await getAdminUser('listings:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('daily_specials')
    .select(
      'id, cook_id, title, description, price, image_url, available_until, moderation_status, moderation_reason, moderated_by, moderated_at, created_at, cook:profiles(full_name, role, suspended)',
    )
    .order('created_at', { ascending: false })
    .limit(200)
  if (error)
    return NextResponse.json(
      { error: 'Could not load meal listings' },
      { status: 500 },
    )
  return NextResponse.json({ listings: data ?? [] })
}

export async function PATCH(request: NextRequest) {
  const actor = await getAdminUser('listings:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = moderationSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid listing moderation action' },
      { status: 400 },
    )

  const action =
    parsed.data.action === 'remove' ? 'listing.remove' : 'listing.restore'
  const audit = await beginAdminAudit({
    actorId: actor.id,
    action,
    targetType: 'daily_special',
    targetId: parsed.data.id,
    details: { reason: parsed.data.reason },
  }).catch(() => null)
  if (!audit)
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )

  const { data, error } = await audit.admin
    .from('daily_specials')
    .update({
      moderation_status: parsed.data.action === 'remove' ? 'removed' : 'active',
      moderation_reason: parsed.data.reason,
      moderated_by: actor.id,
      moderated_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .select(
      'id, moderation_status, moderation_reason, moderated_by, moderated_at',
    )
    .maybeSingle()

  try {
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      error || !data ? 'failed' : 'succeeded',
      error?.message ?? (!data ? 'Listing not found' : undefined),
    )
  } catch {
    return NextResponse.json(
      { error: 'Action processed, but its audit outcome needs review' },
      { status: 500 },
    )
  }
  if (error)
    return NextResponse.json(
      { error: 'Could not update listing' },
      { status: 500 },
    )
  if (!data)
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  return NextResponse.json({ listing: data })
}
