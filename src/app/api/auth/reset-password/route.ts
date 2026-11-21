import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { clientKey, createLimiter } from '@/lib/rateLimit'
import { completePasswordReset } from '@/lib/auth/recoveryServer'

export const runtime = 'nodejs'

// Per server instance: a noise brake. The one-time Supabase recovery token is what protects this
// route, and it can be used once.
const allow = createLimiter({ limit: 10, windowMs: 10 * 60 * 1000 })
const headers = { 'Cache-Control': 'no-store' }

// The person has opened their reset link and chosen a new password. The link's token is proved to
// Supabase, the password is set through Supabase Auth (never seen or stored here), every session of
// the account is ended, and the browser is left signed out so the person signs in with the new one.
export async function POST(request: NextRequest) {
  // Without this, another website could post here and use a victim's visit to burn their link.
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
    result = await completePasswordReset({
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
        { ok: true, redirectTo: '/login?reset=1' },
        { headers },
      )
    case 'weak_password':
      return NextResponse.json(
        { error: result.message, code: 'weak_password' },
        { status: 422, headers },
      )
    case 'invalid_link':
      return NextResponse.json(
        {
          error:
            'This reset link is not valid any more. Request a new one to continue.',
          code: 'invalid_link',
        },
        { status: 410, headers },
      )
    case 'failed':
      return NextResponse.json(
        {
          error:
            'We could not update your password. Request a new link and try again.',
          code: 'failed',
        },
        { status: 502, headers },
      )
  }
}
