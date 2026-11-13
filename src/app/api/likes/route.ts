import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Browsers may only read their OWN swipes (row-level security), so "who liked me"
// can only be answered here, on the server, for the signed-in member and nobody else.
// Only a few safe profile fields are returned; never email, exact location or KYC data.

const querySchema = z.object({
  type: z.enum(['received', 'sent']),
  limit: z.coerce.number().int().min(1).max(50).default(30),
  before: z.string().datetime({ offset: true }).optional(),
})

const PERSON_FIELDS = 'id, full_name, avatar_url, role, is_verified, bio'
type Person = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string | null
  is_verified: boolean | null
  bio: string | null
}

export async function GET(request: NextRequest) {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { type, limit, before } = parsed.data

  try {
    const admin = createAdminClient()
    const mine = type === 'received' ? 'swiped_id' : 'swiper_id'
    const theirs = type === 'received' ? 'swiper_id' : 'swiped_id'

    let query = admin
      .from('swipes')
      .select('swiper_id, swiped_id, action, created_at', { count: 'exact' })
      .eq(mine, user.id)
      .in('action', ['like', 'superlike'])
      .order('created_at', { ascending: false })
      .limit(limit)
    if (before) query = query.lt('created_at', before)
    const { data: swipes, error, count } = await query
    if (error)
      return NextResponse.json(
        { error: 'Could not load likes' },
        { status: 500 },
      )

    const rows = swipes ?? []
    const otherIds = rows.map(
      (row) => row[theirs as keyof typeof row] as string,
    )
    if (otherIds.length === 0) {
      return NextResponse.json({ items: [], total: count ?? 0, next: null })
    }

    const [people, matches, answers] = await Promise.all([
      admin
        .from('profiles')
        .select(PERSON_FIELDS)
        .in('id', otherIds)
        .eq('suspended', false)
        .eq('onboarding_complete', true),
      admin
        .from('matches')
        .select('id, user1_id, user2_id, created_at')
        .eq('status', 'matched')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .limit(1000),
      // What I did about the people who liked me (like back / pass).
      type === 'received'
        ? admin
            .from('swipes')
            .select('swiped_id, action')
            .eq('swiper_id', user.id)
            .in('swiped_id', otherIds)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (people.error || matches.error || answers.error)
      return NextResponse.json(
        { error: 'Could not load likes' },
        { status: 500 },
      )

    const otherSet = new Set(otherIds)
    const personById = new Map<string, Person>(
      ((people.data ?? []) as Person[]).map((p) => [p.id, p]),
    )
    const matchByPerson = new Map<string, string>()
    for (const m of matches.data ?? []) {
      const other = m.user1_id === user.id ? m.user2_id : m.user1_id
      if (otherSet.has(other) && !matchByPerson.has(other))
        matchByPerson.set(other, m.id)
    }
    const myAnswer = new Map<string, string>(
      (answers.data ?? []).map((a: { swiped_id: string; action: string }) => [
        a.swiped_id,
        a.action,
      ]),
    )

    const items = rows.flatMap((row) => {
      const otherId = row[theirs as keyof typeof row] as string
      const person = personById.get(otherId)
      if (!person) return [] // suspended, unfinished or deleted: never shown
      const matchId = matchByPerson.get(otherId) ?? null
      const answer = myAnswer.get(otherId)
      const state = matchId
        ? 'matched'
        : type === 'received'
          ? answer === 'pass'
            ? 'passed'
            : 'pending'
          : 'waiting'
      return [
        {
          created_at: row.created_at as string,
          superlike: row.action === 'superlike',
          state,
          match_id: matchId,
          person,
        },
      ]
    })

    const last = rows[rows.length - 1]
    return NextResponse.json({
      items,
      total: count ?? items.length,
      next: rows.length === limit ? (last.created_at as string) : null,
    })
  } catch {
    return NextResponse.json({ error: 'Could not load likes' }, { status: 500 })
  }
}
