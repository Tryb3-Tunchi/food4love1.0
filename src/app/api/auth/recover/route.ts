import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { clientKey, createLimiter } from '@/lib/rateLimit'
import { resolveTrustedAppUrl } from '@/lib/appUrl'
import { senderFor } from '@/lib/email/transactional'
import {
  GENERIC_RECOVERY_MESSAGE,
  MIN_RECOVERY_RESPONSE_MS,
  normalizeRecoveryEmail,
  withMinimumDuration,
} from '@/lib/auth/recovery'
import {
  recoveryAddressKey,
  requestPasswordRecovery,
} from '@/lib/auth/recoveryServer'

export const runtime = 'nodejs'

// Per server instance: brakes, not boundaries. The boundary is the database cooldown inside
// requestPasswordRecovery (one email per address per window, across instances).
const perVisitor = createLimiter({ limit: 5, windowMs: 10 * 60 * 1000 })
const perAddress = createLimiter({ limit: 3, windowMs: 60 * 60 * 1000 })
const headers = { 'Cache-Control': 'no-store' }

// "I forgot my password." There is no session here (the person cannot sign in), so the protections
// are different from the rest of the API:
//  * the request must come from this site (a form on another site cannot trigger mail to a member);
//  * the answer is IDENTICAL, and takes about as long, whether or not the address has an account;
//  * only the configured site address is ever put in the email, never the request's Host header;
//  * rate limited per visitor and per address, and one email per address per window in the database.
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin)
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403, headers },
    )
  if (!perVisitor(clientKey(request.headers)))
    return NextResponse.json(
      { error: 'Too many requests. Please wait a few minutes and try again.' },
      { status: 429, headers },
    )

  const body = (await request.json().catch(() => null)) as {
    email?: unknown
  } | null
  const email = normalizeRecoveryEmail(body?.email)
  if (!email)
    return NextResponse.json(
      { error: 'Enter a valid email address.' },
      { status: 400, headers },
    )
  if (!perAddress(recoveryAddressKey(email)))
    return NextResponse.json(
      { error: 'Too many requests. Please wait a few minutes and try again.' },
      { status: 429, headers },
    )

  // Configuration problems do not depend on the address, so reporting them reveals nothing.
  const appUrl = resolveTrustedAppUrl(request.nextUrl.origin)
  if (!appUrl || !process.env.RESEND_API_KEY || !senderFor('password_recovery'))
    return NextResponse.json(
      {
        error:
          'Password reset is temporarily unavailable. Please try again later.',
      },
      { status: 503, headers },
    )

  await withMinimumDuration(
    process.env.NODE_ENV === 'test' ? 0 : MIN_RECOVERY_RESPONSE_MS,
    async () => {
      try {
        await requestPasswordRecovery(createAdminClient(), { email, appUrl })
      } catch {
        // Never reveal (or log) which step failed for which address.
        console.error('Password recovery request failed')
      }
    },
  )
  return NextResponse.json(
    { ok: true, message: GENERIC_RECOVERY_MESSAGE },
    { headers },
  )
}
