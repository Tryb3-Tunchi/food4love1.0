import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { actionForExistingPair } from '@/lib/matchRules'
import { adultStates } from '@/lib/adultCheck'
import { AGE_REQUIRED_CODE, AGE_REQUIRED_MESSAGE } from '@/lib/ageGate'
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

    // Matching is for confirmed adults only, on both sides.
    const adults = await adultStates(admin, [user.id, target.id])
    if (
      adults.get(user.id) === 'required' ||
      adults.get(target.id) === 'required'
    ) {
      return NextResponse.json(
        {
          error:
            adults.get(user.id) === 'required'
              ? AGE_REQUIRED_MESSAGE
              : 'These accounts are not eligible to match',
          code: AGE_REQUIRED_CODE,
        },
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
    // Older client-side code could leave more than one row for the same pair, so
    // take the oldest instead of asking for exactly one (which would error).
    const { data: existingMatches, error: existingError } = await admin
      .from('matches')
      .select('id')
      .eq('status', 'matched')
      .or(
        `and(user1_id.eq.${user.id},user2_id.eq.${target.id}),and(user1_id.eq.${target.id},user2_id.eq.${user.id})`,
      )
      .order('created_at', { ascending: true })
      .limit(1)
    if (existingError) {
      return NextResponse.json(
        { error: 'Could not check the existing match' },
        { status: 500 },
      )
    }
    if (existingMatches && existingMatches.length > 0) {
      return NextResponse.json({
        match: true,
        match_id: existingMatches[0].id,
      })
    }

    const matchId = stableMatchId(pair)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { error: matchError } = await admin.from('matches').insert({
      id: matchId,
      user1_id: pair[0],
      user2_id: pair[1],
      status: 'matched',
      expires_at: expiresAt,
    })

    if (matchError && matchError.code === '23505') {
      // The id for this pair is fixed, so a row already exists but it is not an
      // active match (the lookup above only finds 'matched' rows). Before this
      // check the conflict was ignored and both people were told "It's a match!"
      // while the Matches page, which lists only 'matched' rows, stayed empty.
      // Look the earlier row up by the PAIR, not by id: a legacy row for this pair
      // may carry a different id, and the database now allows only one per pair.
      const { data: previousRows, error: previousError } = await admin
        .from('matches')
        .select('id, status')
        .or(
          `and(user1_id.eq.${user.id},user2_id.eq.${target.id}),and(user1_id.eq.${target.id},user2_id.eq.${user.id})`,
        )
        .order('created_at', { ascending: true })
        .limit(1)
      const previous = previousRows?.[0]
      if (previousError || !previous) {
        return NextResponse.json(
          { error: 'The mutual match could not be created' },
          { status: 500 },
        )
      }
      const action = actionForExistingPair(previous.status)
      // A moderator blocked this pair on purpose: respect it, no false match.
      if (action === 'blocked') {
        return NextResponse.json({ match: false })
      }
      if (action === 'reopen') {
        const { error: reopenError } = await admin
          .from('matches')
          .update({ status: 'matched', expires_at: expiresAt })
          .eq('id', previous.id)
          .in('status', ['expired', 'pending'])
        if (reopenError) {
          return NextResponse.json(
            { error: 'The mutual match could not be created' },
            { status: 500 },
          )
        }
      }
      return NextResponse.json({ match: true, match_id: previous.id })
    }

    if (matchError) {
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
