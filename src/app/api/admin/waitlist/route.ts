import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  filtersFromParams,
  getWaitlist,
} from '@/lib/admin/intelligence/server/waitlist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const actor = await getAdminUser('waitlist:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const search = request.nextUrl.searchParams
  const page = Math.max(1, Number(search.get('page')) || 1)
  const pageSize = Math.min(
    100,
    Math.max(10, Number(search.get('page_size')) || 25),
  )

  try {
    const body = await getWaitlist(
      createAdminClient(),
      filtersFromParams(search),
      page,
      pageSize,
    )
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json(
      { error: 'Could not load the waitlist right now.' },
      { status: 500 },
    )
  }
}
