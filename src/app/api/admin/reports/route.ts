import { getAdminUser } from '@/lib/admin/auth'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const reviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['reviewing', 'resolved', 'dismissed']),
  resolution: z.string().trim().min(5).max(2000),
})

export async function GET() {
  const actor = await getAdminUser('reports:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('reports')
    .select(
      'id, reporter_id, target_type, target_id, reason, description, status, resolution, reviewed_by, reviewed_at, created_at',
    )
    .order('created_at', { ascending: true })
    .limit(300)
  if (error)
    return NextResponse.json(
      { error: 'Could not load reports' },
      { status: 500 },
    )
  return NextResponse.json({ reports: data ?? [] })
}

export async function PATCH(request: NextRequest) {
  const actor = await getAdminUser('reports:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json(
      { error: 'A report status and resolution note are required' },
      { status: 400 },
    )

  const audit = await beginAdminAudit({
    actorId: actor.id,
    action: `report.${parsed.data.status}`,
    targetType: 'report',
    targetId: parsed.data.id,
    details: { resolution: parsed.data.resolution },
  }).catch(() => null)
  if (!audit)
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )

  const { data, error } = await audit.admin
    .from('reports')
    .update({
      status: parsed.data.status,
      resolution: parsed.data.resolution,
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.id)
    .in('status', ['open', 'reviewing'])
    .select('id, status, resolution, reviewed_by, reviewed_at')
    .maybeSingle()
  try {
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      error || !data ? 'failed' : 'succeeded',
      error?.message ??
        (!data ? 'Report is already closed or missing' : undefined),
    )
  } catch {
    return NextResponse.json(
      { error: 'Action processed, but its audit outcome needs review' },
      { status: 500 },
    )
  }
  if (error)
    return NextResponse.json(
      { error: 'Could not update report' },
      { status: 500 },
    )
  if (!data)
    return NextResponse.json(
      { error: 'Report is already closed or missing' },
      { status: 409 },
    )
  return NextResponse.json({ report: data })
}
