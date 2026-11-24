import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return 'Hidden address'
  return `${name.slice(0, 1)}${name.length > 1 ? '•••' : '••'}@${domain}`
}

export async function GET(request: NextRequest) {
  const actor = await getAdminUser('messages:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const search =
    request.nextUrl.searchParams.get('search')?.trim().slice(0, 100) ?? ''
  const page = Math.min(
    1000,
    Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10) || 1,
    ),
  )
  try {
    const admin = createAdminClient()
    let query = admin
      .from('waitlist_subscribers')
      .select('id, email, audience', { count: 'exact' })
      .eq('updates_consent', true)
      .is('unsubscribed_at', null)
      .order('id', { ascending: true })
      .range((page - 1) * 25, page * 25 - 1)
    if (search)
      query = query.ilike('email', `%${search.replace(/[\\%_]/g, '\\$&')}%`)
    const { data, count, error } = await query
    if (error)
      return NextResponse.json(
        { error: 'Could not search waitlist recipients' },
        { status: 500 },
      )
    return NextResponse.json({
      recipients: (data ?? []).map((item) => ({
        id: item.id,
        email_label: maskEmail(item.email),
        audience: item.audience,
      })),
      total: count ?? 0,
      page,
      pageSize: 25,
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not search waitlist recipients' },
      { status: 500 },
    )
  }
}
