import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const reportSchema = z.object({
  target_type: z.enum(['profile', 'daily_special', 'post', 'story', 'message']),
  target_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
})

export async function POST(request: NextRequest) {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = reportSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid report details' },
      { status: 400 },
    )
  const report = parsed.data
  const admin = createAdminClient()

  if (report.target_type === 'profile' && report.target_id === user.id) {
    return NextResponse.json(
      { error: 'You cannot report your own profile' },
      { status: 400 },
    )
  }
  const table = {
    profile: 'profiles',
    daily_special: 'daily_specials',
    post: 'posts',
    story: 'stories',
    message: 'messages',
  }[report.target_type]
  const { data: target, error: targetError } = await admin
    .from(table)
    .select('id')
    .eq('id', report.target_id)
    .maybeSingle()
  if (targetError || !target)
    return NextResponse.json(
      { error: 'Reported item not found' },
      { status: 404 },
    )

  const { data, error } = await admin
    .from('reports')
    .insert({ ...report, reporter_id: user.id })
    .select('id, status, created_at')
    .single()
  if (error || !data)
    return NextResponse.json(
      { error: 'Could not submit report' },
      { status: 500 },
    )
  return NextResponse.json({ report: data }, { status: 201 })
}
