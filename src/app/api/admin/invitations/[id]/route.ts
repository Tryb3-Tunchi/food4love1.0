import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  hasInviteBudget,
  resendInvitation,
  resolveAppUrl,
  revokeInvitation,
} from '@/lib/invitations/server'

export const runtime = 'nodejs'

const bodySchema = z.object({ action: z.enum(['resend', 'revoke']) })
const idSchema = z.string().uuid()

// Resend and revoke are the only things an admin can do to an existing invitation. Both are
// audited (before anything happens) and both change the server-held secret or status, so a
// dashboard label is never the only thing that changed.
export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  const actor = await getAdminUser('users:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (request.headers.get('origin') !== request.nextUrl.origin)
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 },
    )

  const id = idSchema.safeParse(context.params.id)
  const body = bodySchema.safeParse(await request.json().catch(() => null))
  if (!id.success || !body.success)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const admin = createAdminClient()

  if (body.data.action === 'resend') {
    if (!(await hasInviteBudget(admin, actor.id)))
      return NextResponse.json(
        {
          error:
            'Too many invitations in the last hour. Please wait before sending more.',
          code: 'rate_limited',
        },
        { status: 429 },
      )
    const result = await resendInvitation(admin, {
      id: id.data,
      actorId: actor.id,
      appUrl: resolveAppUrl(request.nextUrl.origin),
    })
    if (result.kind === 'not_found')
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 },
      )
    if (result.kind === 'blocked' || result.kind === 'failed')
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.httpStatus },
      )
    const message =
      result.delivery === 'accepted'
        ? `A new invitation was sent to ${result.invitation.email}. The previous link no longer works.`
        : result.delivery === 'not_configured'
          ? 'The invitation was refreshed, but email sending is not configured. Nothing was sent.'
          : 'The invitation was refreshed, but the email could not be sent. Try again.'
    return NextResponse.json({
      invitation: result.invitation,
      delivery: result.delivery,
      message,
    })
  }

  const result = await revokeInvitation(admin, {
    id: id.data,
    actorId: actor.id,
  })
  if (result.kind === 'not_found')
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  if (result.kind === 'blocked' || result.kind === 'failed')
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: result.httpStatus },
    )
  return NextResponse.json({
    invitation: result.invitation,
    message: 'Invitation revoked. The emailed link can no longer be used.',
  })
}
