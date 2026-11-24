import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLimiter } from '@/lib/rateLimit'
import { isPushSchemaMissing, pushTestEventKey } from '@/lib/push/server'

// "Send a test notification" for the signed-in member's OWN devices.
//
// It goes through the real pipeline: it writes an ordinary notification (kind push_test) for this
// member, and the database queues it for their devices like any other event. So a test that
// arrives proves the whole chain (queue, Edge Function, encryption, push service, service worker).
// The member chooses nothing about the text or the recipient.

export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'no-store' }
const allow = createLimiter({ limit: 5, windowMs: 60 * 60 * 1000 })

export async function POST() {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: noStore },
    )
  if (!allow(user.id))
    return NextResponse.json(
      { error: 'Too many test notifications. Try again later.' },
      { status: 429, headers: noStore },
    )

  const admin = createAdminClient()
  const { count, error: countError } = await admin
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if (countError) {
    if (isPushSchemaMissing(countError))
      return NextResponse.json(
        { error: 'Push notifications are not available yet' },
        { status: 503, headers: noStore },
      )
    return NextResponse.json(
      { error: 'Could not send a test' },
      { status: 500, headers: noStore },
    )
  }
  if (!count)
    return NextResponse.json(
      { error: 'Turn on notifications on this device first' },
      { status: 409, headers: noStore },
    )

  const { error } = await admin.from('notifications').insert({
    user_id: user.id,
    type: 'system',
    title: 'Test notification',
    body: 'Push notifications are working on your devices.',
    data: { kind: 'push_test', event_key: pushTestEventKey(user.id) },
  })
  // 23505: a test was already sent this minute; that one is on its way.
  if (error && error.code !== '23505')
    return NextResponse.json(
      { error: 'Could not send a test' },
      { status: 500, headers: noStore },
    )
  return NextResponse.json(
    { queued: true, devices: count },
    { headers: noStore },
  )
}
