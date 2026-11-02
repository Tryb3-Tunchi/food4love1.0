import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'

const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  full_name: z.string().trim().min(2).max(100),
  role: z.enum(['buyer', 'cook']),
})

export async function POST(request: NextRequest) {
  const actor = await getAdminUser('users:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 },
    )
  }

  const parsed = inviteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Enter a valid name, email, and account type' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  const { data, error } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: { full_name: parsed.data.full_name, role: parsed.data.role },
      ...(appUrl ? { redirectTo: `${appUrl}/login` } : {}),
    },
  )
  if (error || !data.user) {
    return NextResponse.json(
      {
        error:
          'Could not send the account invitation. The email may already be registered.',
      },
      { status: error?.status === 422 ? 409 : 502 },
    )
  }

  let auditWarning: string | undefined
  try {
    const audit = await beginAdminAudit({
      actorId: actor.id,
      action: 'user.invite',
      targetType: 'auth_user',
      targetId: data.user.id,
      details: { email: parsed.data.email, role: parsed.data.role },
    })
    await finishAdminAudit(audit.admin, audit.auditId, 'succeeded')
  } catch {
    auditWarning = 'Invitation sent, but its audit record could not be saved.'
  }

  return NextResponse.json({
    success: true,
    user_id: data.user.id,
    audit_warning: auditWarning,
  })
}

export async function GET(request: NextRequest) {
  const user = await getAdminUser('users:manage')
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const search = request.nextUrl.searchParams
    .get('search')
    ?.trim()
    .slice(0, 100)
  const requestedRole = request.nextUrl.searchParams.get('role')
  const requestedStatus = request.nextUrl.searchParams.get('status')
  if (requestedRole && !['buyer', 'cook'].includes(requestedRole)) {
    return NextResponse.json({ error: 'Invalid account role' }, { status: 400 })
  }
  if (requestedStatus && requestedStatus !== 'suspended') {
    return NextResponse.json(
      { error: 'Invalid account status' },
      { status: 400 },
    )
  }
  const role = requestedRole as 'buyer' | 'cook' | null
  const requestedPage = Number.parseInt(
    request.nextUrl.searchParams.get('page') ?? '1',
    10,
  )
  const requestedPageSize = Number.parseInt(
    request.nextUrl.searchParams.get('page_size') ?? '25',
    10,
  )
  const page = Math.min(10000, Math.max(1, requestedPage || 1))
  const pageSize = Math.min(50, Math.max(1, requestedPageSize || 25))
  const admin = createAdminClient()
  let query = admin
    .from('profiles')
    .select(
      'id, full_name, avatar_url, role, location, is_verified, kyc_status, suspended, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (search) {
    const escapedSearch = search.replace(/[\\%_]/g, '\\$&')
    query = query.ilike('full_name', `%${escapedSearch}%`)
  }
  if (role) query = query.eq('role', role)
  if (requestedStatus === 'suspended') query = query.eq('suspended', true)

  const { data, count, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Could not load users' }, { status: 500 })
  }
  return NextResponse.json({
    users: data ?? [],
    page,
    pageSize,
    total: count ?? 0,
  })
}
