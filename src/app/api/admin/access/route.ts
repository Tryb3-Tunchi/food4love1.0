import { getAdminUser, type AdminPermission } from '@/lib/admin/auth'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const permissions: AdminPermission[] = [
  'kyc:review',
  'users:manage',
  'matches:manage',
  'disputes:manage',
  'audit:view',
  'bookings:manage',
  'finance:refund',
  'listings:manage',
  'messages:manage',
  'reports:manage',
  'admin:manage',
]

const updateSchema = z.object({
  user_id: z.string().uuid(),
  is_admin: z.boolean(),
  admin_permissions: z
    .array(z.enum(permissions as [AdminPermission, ...AdminPermission[]]))
    .max(permissions.length),
})

export async function GET(request: NextRequest) {
  const actor = await getAdminUser('admin:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const search = request.nextUrl.searchParams
    .get('search')
    ?.trim()
    .toLowerCase()
  const [
    { data: authData, error: authError },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name')
      .limit(1000),
  ])

  if (authError || profilesError) {
    return NextResponse.json(
      { error: 'Could not load staff access records' },
      { status: 500 },
    )
  }

  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  )
  const users = (authData.users ?? [])
    .map((user) => {
      const profile = profilesById.get(user.id)
      const appMetadata = user.app_metadata ?? {}
      return {
        id: user.id,
        email: user.email ?? '',
        full_name: profile?.full_name ?? user.user_metadata?.full_name ?? '',
        role: profile?.role ?? 'unknown',
        is_admin: appMetadata.role === 'admin',
        admin_permissions: Array.isArray(appMetadata.admin_permissions)
          ? appMetadata.admin_permissions.filter(
              (value): value is AdminPermission =>
                permissions.includes(value as AdminPermission),
            )
          : [],
      }
    })
    .filter(
      (user) =>
        !search ||
        `${user.email} ${user.full_name}`.toLowerCase().includes(search),
    )

  return NextResponse.json({ users })
}

export async function PATCH(request: NextRequest) {
  const actor = await getAdminUser('admin:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid staff access update' },
      { status: 400 },
    )
  if (parsed.data.is_admin && parsed.data.admin_permissions.length === 0) {
    return NextResponse.json(
      { error: 'An administrator must have at least one scoped permission' },
      { status: 400 },
    )
  }
  if (parsed.data.user_id === actor.id) {
    return NextResponse.json(
      {
        error: 'Ask another authorized administrator to change your own access',
      },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const { data: targetData, error: targetError } =
    await admin.auth.admin.getUserById(parsed.data.user_id)
  const target = targetData.user
  if (targetError || !target)
    return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (!parsed.data.is_admin && target.app_metadata?.role === 'admin') {
    const { data: authData, error: listError } =
      await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listError)
      return NextResponse.json(
        { error: 'Could not verify remaining administrators' },
        { status: 500 },
      )
    const adminCount = (authData.users ?? []).filter(
      (user) => user.app_metadata?.role === 'admin',
    ).length
    if (adminCount <= 1)
      return NextResponse.json(
        { error: 'The last administrator cannot be removed' },
        { status: 409 },
      )
  }

  const nextMetadata = { ...(target.app_metadata ?? {}) }
  if (parsed.data.is_admin) {
    nextMetadata.role = 'admin'
    nextMetadata.admin_permissions = parsed.data.admin_permissions
  } else {
    delete nextMetadata.role
    delete nextMetadata.admin_permissions
  }

  const audit = await beginAdminAudit({
    actorId: actor.id,
    action: parsed.data.is_admin ? 'admin.access.grant' : 'admin.access.revoke',
    targetType: 'auth_user',
    targetId: target.id,
    details: {
      email: target.email ?? null,
      admin_permissions: parsed.data.is_admin
        ? parsed.data.admin_permissions
        : [],
    },
  }).catch(() => null)
  if (!audit)
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )

  const { data: updated, error } = await admin.auth.admin.updateUserById(
    target.id,
    {
      app_metadata: nextMetadata,
    },
  )
  try {
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      error || !updated.user ? 'failed' : 'succeeded',
      error?.message,
    )
  } catch {
    return NextResponse.json(
      { error: 'Access changed, but the audit outcome needs review' },
      { status: 500 },
    )
  }
  if (error || !updated.user)
    return NextResponse.json(
      { error: 'Could not update staff access' },
      { status: 500 },
    )
  return NextResponse.json({ success: true })
}
