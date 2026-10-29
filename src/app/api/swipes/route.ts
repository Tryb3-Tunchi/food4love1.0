import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const swipeSchema = z.object({
  target_id: z.string().uuid(),
  action: z.enum(['like', 'pass', 'superlike']),
})

function stableMatchId(userIds: string[]) {
  const digest = createHash('sha256').update(userIds.sort().join(':')).digest()
  const bytes = Buffer.from(digest.subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const value = bytes.toString('hex')
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

export async function POST(request: NextRequest) {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = swipeSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || parsed.data.target_id === user.id) {
    return NextResponse.json({ error: 'Invalid swipe' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const [actorResult, targetResult] = await Promise.all([
      admin
        .from('profiles')
        .select('id, role, suspended, onboarding_complete')
        .eq('id', user.id)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('id, role, suspended, onboarding_complete')
        .eq('id', parsed.data.target_id)
        .maybeSingle(),
    ])

    const actor = actorResult.data
    const target = targetResult.data
    if (
      actorResult.error ||
      targetResult.error ||
      !actor ||
      !target ||
      actor.suspended ||
      target.suspended ||
      !actor.onboarding_complete ||
      !target.onboarding_complete ||
      actor.role === target.role
    ) {
      return NextResponse.json(
        { error: 'These accounts are not eligible to match' },
        { status: 403 },
      )
    }

    const { error: swipeError } = await admin.from('swipes').upsert(
      {
        swiper_id: user.id,
        swiped_id: target.id,
        action: parsed.data.action,
      },
      { onConflict: 'swiper_id,swiped_id' },
    )
    if (swipeError) {
      return NextResponse.json(
        { error: 'Could not save this swipe' },
        { status: 500 },
      )
    }

    if (!['like', 'superlike'].includes(parsed.data.action)) {
      return NextResponse.json({ match: false })
    }

    const { data: reverseSwipe, error: reverseError } = await admin
      .from('swipes')
      .select('action')
      .eq('swiper_id', target.id)
      .eq('swiped_id', user.id)
      .maybeSingle()
    if (reverseError) {
      return NextResponse.json(
        { error: 'Could not check for a mutual like' },
        { status: 500 },
      )
    }
    if (!reverseSwipe || !['like', 'superlike'].includes(reverseSwipe.action)) {
      return NextResponse.json({ match: false })
    }

    const pair = [user.id, target.id].sort()
    const { data: existingMatch, error: existingError } = await admin
      .from('matches')
      .select('id')
      .eq('status', 'matched')
      .or(
        `and(user1_id.eq.${user.id},user2_id.eq.${target.id}),and(user1_id.eq.${target.id},user2_id.eq.${user.id})`,
      )
      .maybeSingle()
    if (existingError) {
      return NextResponse.json(
        { error: 'Could not check the existing match' },
        { status: 500 },
      )
    }
    if (existingMatch) {
      return NextResponse.json({ match: true, match_id: existingMatch.id })
    }

    const matchId = stableMatchId(pair)
    const { error: matchError } = await admin.from('matches').insert({
      id: matchId,
      user1_id: pair[0],
      user2_id: pair[1],
      status: 'matched',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    if (matchError && matchError.code !== '23505') {
      return NextResponse.json(
        { error: 'The mutual match could not be created' },
        { status: 500 },
      )
    }

    return NextResponse.json({ match: true, match_id: matchId })
  } catch {
    return NextResponse.json(
      { error: 'Could not process this swipe' },
      { status: 500 },
    )
  }
}
