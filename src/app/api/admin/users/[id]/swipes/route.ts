import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const paramsSchema = z.object({ id: z.string().uuid() })

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const actor = await getAdminUser('users:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 },
    )
  }

  const parsed = paramsSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid account' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', parsed.data.id)
      .maybeSingle()
    if (profileError) {
      return NextResponse.json(
        { error: 'Could not verify account' },
        { status: 500 },
      )
    }
    if (!profile || !['buyer', 'cook'].includes(profile.role ?? '')) {
      return NextResponse.json(
        { error: 'Account is unavailable' },
        { status: 404 },
      )
    }

    const { data: swipes, error: swipeError } = await admin
      .from('swipes')
      .select('id, swiped_id')
      .eq('swiper_id', profile.id)
    if (swipeError) {
      return NextResponse.json(
        { error: 'Could not load swipe history' },
        { status: 500 },
      )
    }

    const targetIds = Array.from(
      new Set((swipes ?? []).map((swipe) => swipe.swiped_id)),
    )
    const matchedIds = new Set<string>()
    if (targetIds.length > 0) {
      const { data: matches, error: matchError } = await admin
        .from('matches')
        .select('user1_id, user2_id')
        .in('status', ['matched', 'blocked'])
        .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
      if (matchError) {
        return NextResponse.json(
          { error: 'Could not protect existing matches' },
          { status: 500 },
        )
      }
      for (const match of matches ?? []) {
        const otherId =
          match.user1_id === profile.id ? match.user2_id : match.user1_id
        if (targetIds.includes(otherId)) matchedIds.add(otherId)
      }
    }

    const removable = (swipes ?? []).filter(
      (swipe) => !matchedIds.has(swipe.swiped_id),
    )
    const audit = await beginAdminAudit({
      actorId: actor.id,
      action: 'user.unmatched_swipes_reset',
      targetType: 'profile',
      targetId: profile.id,
      details: {
        candidate_count: removable.length,
        preserved_match_count: matchedIds.size,
      },
    })

    let deletedCount = 0
    for (let offset = 0; offset < removable.length; offset += 500) {
      const ids = removable.slice(offset, offset + 500).map((swipe) => swipe.id)
      const { data: deleted, error: deleteError } = await audit.admin
        .from('swipes')
        .delete()
        .in('id', ids)
        .select('id')
      if (deleteError) {
        await finishAdminAudit(
          audit.admin,
          audit.auditId,
          'failed',
          deleteError.message,
        )
        return NextResponse.json(
          { error: 'Could not reset swipe history' },
          { status: 500 },
        )
      }
      deletedCount += deleted?.length ?? 0
    }

    await finishAdminAudit(audit.admin, audit.auditId, 'succeeded')
    return NextResponse.json({
      reset_count: deletedCount,
      preserved_match_swipes: matchedIds.size,
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not reset swipe history' },
      { status: 500 },
    )
  }
}
