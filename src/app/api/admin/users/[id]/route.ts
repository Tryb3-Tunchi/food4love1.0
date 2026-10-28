import { getAdminUser } from '@/lib/admin/auth'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const actionSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().trim().min(3).max(1000),
})

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const actor = await getAdminUser('users:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsedId = z.string().uuid().safeParse(context.params.id)
  const parsedBody = actionSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsedId.success || !parsedBody.success) {
    return NextResponse.json(
      { error: 'A valid user, suspension state, and reason are required' },
      { status: 400 },
    )
  }
  if (parsedId.data === actor.id) {
    return NextResponse.json(
      { error: 'You cannot suspend your own account' },
      { status: 400 },
    )
  }

  const audit = await beginAdminAudit({
    actorId: actor.id,
    action: parsedBody.data.suspended ? 'user.suspend' : 'user.reactivate',
    targetType: 'profile',
    targetId: parsedId.data,
    details: { reason: parsedBody.data.reason },
  }).catch(() => null)
  if (!audit) {
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )
  }

  const { data, error } = await audit.admin
    .from('profiles')
    .update({ suspended: parsedBody.data.suspended })
    .eq('id', parsedId.data)
    .select('id, suspended')
    .maybeSingle()

  try {
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      error || !data ? 'failed' : 'succeeded',
      error?.message ?? (!data ? 'User not found' : undefined),
    )
  } catch {
    return NextResponse.json(
      { error: 'Action processed, but its audit outcome needs review' },
      { status: 500 },
    )
  }

  if (error)
    return NextResponse.json(
      { error: 'Could not update user' },
      { status: 500 },
    )
  if (!data)
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json({ user: data })
}
