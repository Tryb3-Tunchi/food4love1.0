import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

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
