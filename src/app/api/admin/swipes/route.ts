import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  const actor = await getAdminUser('matches:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const filter = request.nextUrl.searchParams.get('action')
  if (
    filter &&
    !z.enum(['like', 'superlike', 'pass']).safeParse(filter).success
  ) {
    return NextResponse.json({ error: 'Invalid swipe filter' }, { status: 400 })
  }

  const admin = createAdminClient()
  let query = admin
    .from('swipes')
    .select(
      '*, swiper:profiles!swipes_swiper_id_fkey(full_name, avatar_url, role), swiped:profiles!swipes_swiped_id_fkey(full_name, avatar_url, role)',
    )
    .order('created_at', { ascending: false })
    .limit(100)
  if (filter) query = query.eq('action', filter)
  const { data, error } = await query
  if (error)
    return NextResponse.json(
      { error: 'Could not load swipe activity' },
      { status: 500 },
    )
  return NextResponse.json({ swipes: data ?? [] })
}
