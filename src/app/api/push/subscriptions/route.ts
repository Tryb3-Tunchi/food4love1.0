import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLimiter } from '@/lib/rateLimit'
import { parseSubscriptionInput } from '@/lib/push/subscriptionInput'
import { isPushSchemaMissing } from '@/lib/push/server'

// This device's Web Push subscription.
//
//   GET   my connected devices (safe fields only: never endpoints or keys)
//   POST  register / refresh this browser, or swap a rotated subscription (oldEndpoint)
//
// Browsers never touch push_subscriptions directly (no RLS policy grants it). This route proves
// who is signed in, then calls a service-role-only database function with THAT user id, so a
// member can only ever register devices for themselves.

export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'no-store' }
const allow = createLimiter({ limit: 30, windowMs: 60 * 60 * 1000 })

async function currentUser() {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  return user
}

const unavailable = () =>
  NextResponse.json(
    { error: 'Push notifications are not available yet', code: 'unavailable' },
    { status: 503, headers: noStore },
  )

export async function GET() {
  const user = await currentUser()
  if (!user)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: noStore },
    )

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id, label, platform, installed, created_at, last_success_at')
    .eq('user_id', user.id) // own devices only
    .order('last_seen_at', { ascending: false })
    .limit(20)
  if (error) {
    if (isPushSchemaMissing(error))
      return NextResponse.json({ devices: [] }, { headers: noStore })
    return NextResponse.json(
      { error: 'Could not load devices' },
      { status: 500, headers: noStore },
    )
  }
  return NextResponse.json({ devices: data ?? [] }, { headers: noStore })
}

export async function POST(request: NextRequest) {
  const user = await currentUser()
  if (!user)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: noStore },
    )
  if (!allow(user.id))
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: noStore },
    )

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400, headers: noStore },
    )
  }
  const parsed = parseSubscriptionInput(body)
  if (!parsed.ok)
    return NextResponse.json(
      { error: 'Invalid subscription', code: parsed.error },
      { status: 400, headers: noStore },
    )

  const v = parsed.value
  const admin = createAdminClient()
  const common = {
    p_user_id: user.id,
    p_endpoint: v.endpoint,
    p_p256dh: v.p256dh,
    p_auth: v.auth,
    p_label: v.label,
    p_platform: v.platform,
    p_installed: v.installed,
  }
  const { data, error } = v.oldEndpoint
    ? await admin.rpc('food4love_push_replace', {
        ...common,
        p_old_endpoint: v.oldEndpoint,
      })
    : await admin.rpc('food4love_push_register', common)
  if (error) {
    if (isPushSchemaMissing(error)) return unavailable()
    console.error(`push registration failed (${error.code ?? 'no code'})`)
    return NextResponse.json(
      { error: 'Could not turn on notifications for this device' },
      { status: 500, headers: noStore },
    )
  }
  return NextResponse.json({ id: data }, { headers: noStore })
}
