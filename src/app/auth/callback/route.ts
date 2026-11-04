import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const requestedNext = requestUrl.searchParams.get('next') ?? '/swipe'
  const next =
    requestedNext.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : '/swipe'

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

  return NextResponse.redirect(new URL(next, request.url))
}
