import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const actor = await getAdminUser('messages:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const search =
    request.nextUrl.searchParams.get('search')?.trim().slice(0, 80) ?? ''
  const page = Math.min(
    1000,
    Math.max(
      1,
      Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10) || 1,
    ),
  )
  const group = request.nextUrl.searchParams.get('group') ?? 'selected'
  if (!['selected', 'buyers', 'cooks', 'testers', 'all'].includes(group))
    return NextResponse.json({ error: 'Invalid audience' }, { status: 400 })

  try {
    const admin = createAdminClient()
    let testerIds: string[] | null = null
    if (group === 'testers') {
      const { data, error } = await admin
        .from('tester_invitations')
        .select('auth_user_id')
        .eq('status', 'accepted')
        .not('auth_user_id', 'is', null)
        .limit(1000)
      if (error)
        return NextResponse.json(
          { error: 'Could not load tester audience' },
          { status: 500 },
        )
      testerIds = Array.from(
        new Set(
          (data ?? [])
            .map((item) => item.auth_user_id)
            .filter((id): id is string => Boolean(id)),
        ),
      )
      if (!testerIds.length)
        return NextResponse.json({
          recipients: [],
          total: 0,
          page,
          pageSize: 25,
        })
    }

    let query = admin
      .from('profiles')
      .select(
        'id, full_name, role, location, is_verified, suspended, email_updates_consent',
        { count: 'exact' },
      )
      .in('role', ['buyer', 'cook'])
      .or('suspended.is.null,suspended.eq.false')
      .order('full_name', { ascending: true })
      .range((page - 1) * 25, page * 25 - 1)
    if (group === 'buyers') query = query.eq('role', 'buyer')
    if (group === 'cooks') query = query.eq('role', 'cook')
    if (testerIds) query = query.in('id', testerIds)
    if (search)
      query = query.ilike('full_name', `%${search.replace(/[\\%_]/g, '\\$&')}%`)
    const { data, count, error } = await query
    if (error)
      return NextResponse.json(
        { error: 'Could not load campaign recipients' },
        { status: 500 },
      )
    return NextResponse.json({
      recipients: data ?? [],
      total: count ?? 0,
      page,
      pageSize: 25,
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not load campaign recipients' },
      { status: 500 },
    )
  }
}
