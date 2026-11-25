import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLimiter } from '@/lib/rateLimit'
import { parseSubscriptionInput } from '@/lib/push/subscriptionInput'
import { pushPublicKeyFor } from '@/lib/push/publicKeys'
import {
  isNotEnrolledError,
  isPushSchemaMissing,
  pushEnrollmentFor,
} from '@/lib/push/server'

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
      return NextResponse.json(
        {
          devices: [],
          enrolled: false,
          server: { publicKeyConfigured: serverHasPublicKey() },
        },
        { headers: noStore },
      )
    return NextResponse.json(
      { error: 'Could not load devices' },
      { status: 500, headers: noStore },
    )
  }
  // Latest delivery outcome per device, for the settings diagnostics. Own rows only; codes and
  // times only (no payload, no endpoint, no notification text).
  const latest = new Map<string, Record<string, unknown>>()
  const devices = data ?? []
  if (devices.length > 0) {
    const { data: deliveries } = await admin
      .from('notification_push_deliveries')
      .select(
        'subscription_id, status, http_status, error_code, created_at, sent_at',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    for (const d of deliveries ?? [])
      if (d.subscription_id && !latest.has(d.subscription_id))
        latest.set(d.subscription_id, {
          status: d.status,
          http_status: d.http_status,
          error_code: d.error_code,
          created_at: d.created_at,
          sent_at: d.sent_at,
        })
  }
  // enrolled: may this member turn push on (pilot gate). Never says who else is enrolled.
  return NextResponse.json(
    {
      devices: devices.map((device) => ({
        ...device,
        latest_delivery: latest.get(device.id) ?? null,
      })),
      enrolled: (await pushEnrollmentFor(admin, user.id)) === 'enrolled',
      server: { publicKeyConfigured: serverHasPublicKey() },
    },
    { headers: noStore },
  )
}

// Runtime view of the key, chosen the same way as in the browser (by Supabase project).
function serverHasPublicKey() {
  return pushPublicKeyFor(process.env.NEXT_PUBLIC_SUPABASE_URL) !== null
}

export async function POST(request: NextRequest) {
  const user = await currentUser()
  if (!user)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: noStore },
    )
  // Pilot gate (server-side, fails closed): push_pilot_members, see pushEnrollmentFor()
  const enrollment = await pushEnrollmentFor(createAdminClient(), user.id)
  if (enrollment === 'unavailable')
    return NextResponse.json(
      {
        error: 'Could not check notification access. Please try again.',
        code: 'enrollment_unavailable',
      },
      { status: 503, headers: noStore },
    )
  if (enrollment !== 'enrolled')
    return NextResponse.json(
      {
        error: 'Push notifications are being tested with a small group first',
        code: 'not_enrolled',
      },
      { status: 403, headers: noStore },
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
    if (isNotEnrolledError(error))
      return NextResponse.json(
        {
          error: 'Push notifications are being tested with a small group first',
          code: 'not_enrolled',
        },
        { status: 403, headers: noStore },
      )
    if (isPushSchemaMissing(error)) return unavailable()
    console.error(`push registration failed (${error.code ?? 'no code'})`)
    return NextResponse.json(
      { error: 'Could not turn on notifications for this device' },
      { status: 500, headers: noStore },
    )
  }
  return NextResponse.json({ id: data }, { headers: noStore })
}
