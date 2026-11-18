import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// RETIRED: POST used to invite a user with Supabase's own invitation email and answered
// every failure with "The email may already be registered", whatever the real cause was
// (a duplicate, an email rate limit, an SMTP error, a failing signup trigger). That hid the
// real problem, and Supabase's email would also have doubled up with Food4Love's own.
// Invitations now go through /api/admin/invitations (Admin → Users → Invite testers), which
// reports the specific cause and sends one branded email through Resend.
export async function POST() {
  const actor = await getAdminUser('users:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json(
    {
      error:
        'This endpoint has been replaced. Use Admin → Users → Invite testers to invite someone.',
      code: 'moved',
    },
    { status: 410 },
  )
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
