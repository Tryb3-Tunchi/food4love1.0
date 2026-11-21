import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { productionForbiddenHere } from '@/lib/env/supabaseGuard'

export async function middleware(request: NextRequest) {
  // A Vercel preview (every pull request gets one) or a local process that points at the PRODUCTION
  // database serves nothing: no page, no sign-in, no query. The live deployment is unaffected
  // (VERCEL_ENV=production). Runs before anything else so no request can reach the real data.
  if (productionForbiddenHere(process.env)) {
    return new NextResponse(
      'This deployment is disabled: it is configured to use the production database but is not the production deployment. Point its environment at the staging Supabase project.',
      {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Robots-Tag': 'noindex',
        },
      },
    )
  }

  if (
    request.nextUrl.pathname === '/' ||
    request.nextUrl.pathname.startsWith('/signup')
  ) {
    // Keep the query string: campaign links such as /?utm_source=instagram or
    // /signup?ref=CODE would otherwise lose their tracking tags in this redirect.
    const destination = new URL('/waitlist', request.url)
    destination.search = request.nextUrl.search
    return NextResponse.redirect(destination)
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
    // api/analytics/collect and the api/webhooks/* routes are skipped: this middleware
    // makes a session check plus a profile query for every request, which the
    // analytics beacon (a heartbeat every 45 s per signed-in visitor) and the
    // payment and email webhooks (each authenticated by its own signature) do not need.
    // api/cron/* is called by a scheduler with a bearer secret and has no user session.
    '/((?!_next/static|_next/image|favicon.ico|api/analytics/collect|api/webhooks/resend|api/webhooks/paystack|api/cron/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
