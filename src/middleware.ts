import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname.startsWith('/signup')
  ) {
    return NextResponse.redirect(new URL('/waitlist', request.url))
  }

  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(
          cookiesToSet: Array<{
            name: string
            value: string
            options?: Record<string, unknown>
          }>,
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user && !request.nextUrl.pathname.startsWith('/account-suspended')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('suspended')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.suspended) {
      if (request.nextUrl.pathname.startsWith('/api/')) {
        const response = NextResponse.json(
          { error: 'Account suspended' },
          { status: 403 },
        )
        supabaseResponse.cookies
          .getAll()
          .forEach((cookie) => response.cookies.set(cookie))
        return response
      }
      const response = NextResponse.redirect(
        new URL('/account-suspended', request.url),
      )
      supabaseResponse.cookies
        .getAll()
        .forEach((cookie) => response.cookies.set(cookie))
      return response
    }
  }
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
