import { randomUUID } from 'node:crypto'
import { getAdminUser } from '@/lib/admin/auth'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    user1_id: z.string().uuid(),
    user2_id: z.string().uuid(),
    reason: z.string().trim().min(3).max(1000),
  }),
  z.object({
    action: z.literal('unmatch'),
    match_id: z.string().uuid(),
    reason: z.string().trim().min(3).max(1000),
  }),
])

export async function GET() {
  const actor = await getAdminUser('matches:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('matches')
    .select(
      '*, user1:profiles!matches_user1_id_fkey(full_name, avatar_url, role), user2:profiles!matches_user2_id_fkey(full_name, avatar_url, role)',
    )
    .order('created_at', { ascending: false })
    .limit(500)
  if (error)
    return NextResponse.json(
      { error: 'Could not load matches' },
      { status: 500 },
    )
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, full_name, role, suspended')
    .eq('suspended', false)
    .order('full_name')
  if (profilesError)
    return NextResponse.json(
      { error: 'Could not load match candidates' },
      { status: 500 },
    )
  return NextResponse.json({ matches: data ?? [], profiles: profiles ?? [] })
}

export async function POST(request: NextRequest) {
  const actor = await getAdminUser('matches:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid match action' }, { status: 400 })
  }

  const admin = createAdminClient()
  const matchId =
    parsed.data.action === 'create' ? randomUUID() : parsed.data.match_id
  const targetId = matchId
  const audit = await beginAdminAudit({
    actorId: actor.id,
    action: parsed.data.action === 'create' ? 'match.create' : 'match.unmatch',
    targetType: parsed.data.action === 'create' ? 'match' : 'match',
    targetId,
    details:
      parsed.data.action === 'create'
        ? {
            match_id: matchId,
            user1_id: parsed.data.user1_id,
            user2_id: parsed.data.user2_id,
            reason: parsed.data.reason,
          }
        : { reason: parsed.data.reason },
  }).catch(() => null)
  if (!audit)
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )

  let resultError: { message: string } | null = null
  if (parsed.data.action === 'create') {
    if (parsed.data.user1_id === parsed.data.user2_id) {
      resultError = { message: 'A user cannot be matched with themselves' }
    } else {
      const { data: profiles, error: profileError } = await admin
        .from('profiles')
        .select('id, role, suspended, kyc_status')
        .in('id', [parsed.data.user1_id, parsed.data.user2_id])
      const cook = profiles?.find((profile) => profile.role === 'cook')
      const buyer = profiles?.find((profile) => profile.role === 'buyer')
      if (
        profileError ||
        profiles?.length !== 2 ||
        !cook ||
        !buyer ||
        profiles?.some((profile) => profile.suspended) ||
        cook.kyc_status !== 'verified'
      ) {
        resultError = {
          message:
            'An active buyer and verified, active cook account are required',
        }
      } else {
        const { data: existing, error: existingError } = await admin
          .from('matches')
          .select('id')
          .eq('status', 'matched')
          .or(
            `and(user1_id.eq.${parsed.data.user1_id},user2_id.eq.${parsed.data.user2_id}),and(user1_id.eq.${parsed.data.user2_id},user2_id.eq.${parsed.data.user1_id})`,
          )
          .maybeSingle()
        if (existingError || existing) {
          resultError = {
            message: existingError?.message ?? 'An active match already exists',
          }
        } else {
          const { error } = await admin.from('matches').insert({
            id: matchId,
            user1_id: parsed.data.user1_id,
            user2_id: parsed.data.user2_id,
            status: 'matched',
            expires_at: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          })
          if (error) resultError = { message: error.message }
        }
      }
    }
  } else {
    const { data, error } = await admin
      .from('matches')
      .update({ status: 'blocked' })
      .eq('id', parsed.data.match_id)
      .eq('status', 'matched')
      .select('id')
      .maybeSingle()
    if (error || !data)
      resultError = { message: error?.message ?? 'Active match not found' }
  }

  try {
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      resultError ? 'failed' : 'succeeded',
      resultError?.message,
    )
  } catch {
    return NextResponse.json(
      { error: 'Action processed, but its audit outcome needs review' },
      { status: 500 },
    )
  }

  if (resultError) {
    return NextResponse.json({ error: resultError.message }, { status: 400 })
  }
  return NextResponse.json({ success: true, match_id: matchId })
}
