import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWelcomeEmailAfterVerification } from '@/lib/email/welcome'
import { safeNextPath } from '@/lib/safeRedirect'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = safeNextPath(requestUrl.searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(
      new URL('/verify?error=confirmation', request.url),
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(
      new URL('/verify?error=confirmation', request.url),
    )
  }

  // The email address is now confirmed. Sending the welcome email must never
  // block or break the sign-in, so failures are swallowed inside the helper.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await sendWelcomeEmailAfterVerification(user, requestUrl.origin)

  return NextResponse.redirect(new URL(next, request.url))
}
