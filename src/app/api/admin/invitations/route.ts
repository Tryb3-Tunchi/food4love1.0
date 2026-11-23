import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createInvitation,
  hasInviteBudget,
  listInvitations,
  resolveAppUrl,
} from '@/lib/invitations/server'
import {
  validateInviteInput,
  type InvitationStatus,
} from '@/lib/invitations/rules'
import { isMissingSchema } from '@/lib/booking/server'

export const runtime = 'nodejs'

const STATUSES: InvitationStatus[] = [
  'pending',
  'accepted',
  'expired',
  'revoked',
  'failed',
]

const SCHEMA_MISSING = {
  error:
    'Tester invitations are not set up in the database yet. Run supabase-migration-tester-invitations.sql in the Supabase SQL editor.',
  code: 'schema_missing',
}

const noStore = { 'Cache-Control': 'no-store' }

// Invitation records contain email addresses, so listing them needs the same permission
// as managing users.
export async function GET(request: NextRequest) {
  const actor = await getAdminUser('users:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const params = request.nextUrl.searchParams
  const requestedStatus = params.get('status')
  if (
    requestedStatus &&
    !STATUSES.includes(requestedStatus as InvitationStatus)
  )
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  const page = Math.min(
    10000,
    Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1),
  )
  const pageSize = Math.min(
    50,
    Math.max(1, Number.parseInt(params.get('page_size') ?? '25', 10) || 25),
  )

  const result = await listInvitations(createAdminClient(), {
    status: (requestedStatus as InvitationStatus | null) ?? undefined,
    search: params.get('search')?.trim().slice(0, 100) || undefined,
    page,
    pageSize,
  })
  if ('error' in result && result.error) {
    if (isMissingSchema(result.error))
      return NextResponse.json(SCHEMA_MISSING, {
        status: 503,
        headers: noStore,
      })
    return NextResponse.json(
      { error: 'Could not load invitations' },
      { status: 500 },
    )
  }
  return NextResponse.json(
    { invitations: result.invitations, page, pageSize, total: result.total },
    { headers: noStore },
  )
}

export async function POST(request: NextRequest) {
  const actor = await getAdminUser('users:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (request.headers.get('origin') !== request.nextUrl.origin)
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 },
    )

  const parsed = validateInviteInput(await request.json().catch(() => null))
  if (!parsed.ok)
    return NextResponse.json(
      {
        error: 'Check the highlighted fields.',
        code: 'invalid',
        fields: parsed.errors,
      },
      { status: 400 },
    )

  const admin = createAdminClient()
  if (!(await hasInviteBudget(admin, actor.id)))
    return NextResponse.json(
      {
        error:
          'Too many invitations in the last hour. Please wait before sending more.',
        code: 'rate_limited',
      },
      { status: 429 },
    )

  const result = await createInvitation(admin, {
    value: parsed.value,
    actorId: actor.id,
    appUrl: resolveAppUrl(request.nextUrl.origin),
  })

  switch (result.kind) {
    case 'unavailable':
      return NextResponse.json(SCHEMA_MISSING, { status: 503 })
    case 'blocked':
      return NextResponse.json(
        {
          error: result.message,
          code: result.code,
          invitation_id: result.invitationId,
        },
        { status: 409 },
      )
    case 'failed':
      return NextResponse.json(
        {
          error: result.message,
          code: result.code,
          invitation: result.invitation,
        },
        { status: result.httpStatus },
      )
    case 'created': {
      const message =
        result.delivery === 'accepted'
          ? `Invitation sent to ${result.invitation.email}.`
          : result.delivery === 'not_configured'
            ? 'The invitation was saved, but email sending is not configured (RESEND_API_KEY or a sender address is missing). Nothing was sent.'
            : 'The invitation was saved, but the email could not be sent. Use Resend to try again.'
      return NextResponse.json(
        {
          invitation: result.invitation,
          delivery: result.delivery,
          note: result.note,
          message,
        },
        { status: 201 },
      )
    }
  }
}
