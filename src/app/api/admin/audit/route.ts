import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const actor = await getAdminUser('audit:view')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const targetType = request.nextUrl.searchParams.get('target_type')
  let query = admin
    .from('admin_audit_log')
    .select(
      'id, actor_id, action, target_type, target_id, details, outcome, error_message, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(200)
  if (targetType) query = query.eq('target_type', targetType)

  const { data, error } = await query
  if (error)
    return NextResponse.json(
      { error: 'Could not load audit log' },
      { status: 500 },
    )
  return NextResponse.json({ events: data ?? [] })
}
