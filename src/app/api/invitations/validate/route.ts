import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkInvitationToken } from '@/lib/invitations/accept'
import { accessTypeLabel } from '@/lib/invitations/rules'
import { clientKey, createLimiter } from '@/lib/rateLimit'

export const runtime = 'nodejs'

// Per server instance, so a noise brake rather than a security boundary. The real
// protection is the secret itself: 256 random bits cannot be guessed.
const allow = createLimiter({ limit: 40, windowMs: 10 * 60 * 1000 })
const headers = { 'Cache-Control': 'no-store' }

// "Is this invitation link still good?" Called by the welcome page with the secret from the
// link's fragment. It reveals nothing unless the secret is real, and then only what the
// holder was already emailed: their first name and what they were invited as.
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin)
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403, headers },
    )
  if (!allow(clientKey(request.headers)))
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes.' },
      { status: 429, headers },
    )

  const body = (await request.json().catch(() => null)) as {
    token?: unknown
  } | null
  let checked
  try {
    checked = await checkInvitationToken(createAdminClient(), body?.token)
  } catch {
    return NextResponse.json(
      { error: 'Temporarily unavailable' },
      { status: 503, headers },
    )
  }

  if (!checked.ok)
    return NextResponse.json(
      { valid: false, reason: checked.reason },
      { headers },
    )

  const { invitation } = checked
  return NextResponse.json(
    {
      valid: true,
      first_name: invitation.full_name.split(/\s+/)[0] ?? '',
      access_label: accessTypeLabel(invitation.access_type),
      profile_role: invitation.profile_role,
      expires_at: invitation.expires_at,
    },
    { headers },
  )
}
