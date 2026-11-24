import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const updateSchema = z
  .object({
    status: z.enum(['open', 'in_progress', 'resolved']).optional(),
    assigned_to: z.string().uuid().nullable().optional(),
  })
  .refine(
    (value) => value.status !== undefined || value.assigned_to !== undefined,
  )

export async function PATCH(
  request: NextRequest,
  context: { params: { threadId: string } },
) {
  const actor = await getAdminUser('messages:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 },
    )
  const id = z.string().uuid().safeParse(context.params.threadId)
  const input = updateSchema.safeParse(await request.json().catch(() => null))
  if (!id.success || !input.success)
    return NextResponse.json(
      { error: 'Invalid conversation update' },
      { status: 400 },
    )

  const admin = createAdminClient()
  if (input.data.assigned_to) {
    const { data: listed, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 100,
    })
    if (error)
      return NextResponse.json(
        { error: 'Could not verify assignee' },
        { status: 500 },
      )
    const assignee = listed.users.find(
      (user) => user.id === input.data.assigned_to,
    )
    if (
      assignee?.app_metadata?.role !== 'admin' ||
      !Array.isArray(assignee.app_metadata?.admin_permissions) ||
      !assignee.app_metadata.admin_permissions.includes('messages:manage')
    )
      return NextResponse.json(
        { error: 'Assignee must have support inbox access' },
        { status: 400 },
      )
  }

  const audit = await beginAdminAudit({
    actorId: actor.id,
    action:
      input.data.assigned_to !== undefined
        ? 'support.assignment_changed'
        : 'support.status_changed',
    targetType: 'support_thread',
    targetId: id.data,
    details: {
      status: input.data.status,
      assignment_changed: input.data.assigned_to !== undefined,
      assigned_to:
        input.data.assigned_to === undefined
          ? undefined
          : input.data.assigned_to,
    },
  }).catch(() => null)
  if (!audit)
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )

  const { data: thread, error } = await audit.admin
    .from('support_threads')
    .update({ ...input.data, updated_at: new Date().toISOString() })
    .eq('id', id.data)
    .select(
      'id, user_id, guest_name, guest_email, status, assigned_to, updated_at',
    )
    .maybeSingle()
  await finishAdminAudit(
    audit.admin,
    audit.auditId,
    error || !thread ? 'failed' : 'succeeded',
    error?.message,
  )
  if (error || !thread)
    return NextResponse.json(
      { error: 'Could not update conversation' },
      { status: error ? 500 : 404 },
    )
  return NextResponse.json({ thread })
}
