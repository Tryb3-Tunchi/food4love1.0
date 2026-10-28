import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const user = await getAdminUser('users:manage')
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const search = request.nextUrl.searchParams.get('search')?.trim()
  const admin = createAdminClient()
  let query = admin
    .from('profiles')
    .select(
      'id, full_name, avatar_url, role, location, is_verified, kyc_status, suspended, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(100)
  if (search) query = query.ilike('full_name', `%${search}%`)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Could not load users' }, { status: 500 })
  }
  return NextResponse.json({ users: data ?? [] })
}
