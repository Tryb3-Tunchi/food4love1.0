import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { completeInvitation } from '@/lib/invitations/accept'
import { clientKey, createLimiter } from '@/lib/rateLimit'

export const runtime = 'nodejs'

// Per server instance: a noise brake. The secret in the link is what protects this route.
const allow = createLimiter({ limit: 15, windowMs: 10 * 60 * 1000 })
const headers = { 'Cache-Control': 'no-store' }

// The person has chosen a password. Validates the link again (never trust an earlier
// check), signs them in, sets THEIR password through Supabase Auth and finishes their
// account. The password is passed straight to Supabase and is never logged or stored here.
export async function POST(request: NextRequest) {
  // Without this, another website could post to this route and sign a visitor in to an
  // account the attacker controls.
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
    password?: unknown
  } | null
  if (!body)
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400, headers },
    )

  let result
  try {
    result = await completeInvitation({
      admin: createAdminClient(),
      session: await createClient(),
      rawToken: body.token,
      password: body.password,
    })
  } catch {
    return NextResponse.json(
      { error: 'Temporarily unavailable' },
      { status: 503, headers },
    )
  }

  switch (result.kind) {
    case 'ok':
      return NextResponse.json(
        { ok: true, redirectTo: result.redirectTo },
        { headers },
      )
    case 'weak_password':
      return NextResponse.json(
        { error: result.message, code: 'weak_password' },
        { status: 422, headers },
      )
    case 'in_progress':
      return NextResponse.json(
        {
          error:
            'This invitation is already being completed. Give it a moment, then try again.',
          code: 'in_progress',
        },
        { status: 409, headers },
      )
    case 'token':
      return NextResponse.json(
        {
          error: 'This invitation can no longer be used.',
          code: result.reason,
        },
        { status: 410, headers },
      )
    case 'failed':
      return NextResponse.json(
        { error: result.message, code: 'failed' },
        { status: 502, headers },
      )
  }
}
