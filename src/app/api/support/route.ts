import { createHash, randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { clientKey, createLimiter } from '@/lib/rateLimit'
import { processSupportAlerts } from '@/lib/email/supportAlerts'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const guestCookie = 'f4l_support_session'
const supportRateLimit = createLimiter({ limit: 8, windowMs: 10 * 60 * 1000 })
const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  guest_email: z.string().trim().email().max(254).optional(),
  guest_name: z.string().trim().max(80).optional(),
})
const activeStatuses = ['open', 'in_progress'] as const

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

async function allowMessage(
  admin: ReturnType<typeof createAdminClient>,
  identity: string,
) {
  const bucketHash = hashToken(identity.slice(0, 300))
  const { data, error } = await admin.rpc(
    'food4love_allow_support_message' as never,
    {
      p_bucket_hash: bucketHash,
      p_limit: 8,
      p_window_seconds: 600,
    } as never,
  )
  return !error && data === true
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  return !origin || origin === new URL(request.url).origin
}

async function getSessionUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  const guestToken = request.cookies.get(guestCookie)?.value
  if (!user && !guestToken)
    return NextResponse.json({ mode: 'guest', thread: null, messages: [] })

  const admin = createAdminClient()
  let query = admin
    .from('support_threads')
    .select('id, user_id, status, guest_name, guest_email, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
  query = user
    ? query.eq('user_id', user.id)
    : query.eq('guest_token_hash', hashToken(guestToken!))

  const { data: thread, error: threadError } = await query.maybeSingle()
  if (threadError)
    return NextResponse.json(
      { error: 'Could not load support conversation' },
      { status: 500 },
    )
  if (!thread)
    return NextResponse.json({
      mode: user ? 'account' : 'guest',
      thread: null,
      messages: [],
    })

  const now = new Date().toISOString()
  await admin
    .from('support_threads')
    .update(user ? { last_user_read_at: now } : { last_user_read_at: now })
    .eq('id', thread.id)

  const { data: messages, error } = await admin
    .from('support_messages')
    .select(
      'id, thread_id, sender_id, staff_actor_id, sender_type, body, created_at, is_internal_note',
    )
    .eq('thread_id', thread.id)
    .eq('is_internal_note', false)
    .order('created_at', { ascending: true })
    .limit(500)
  if (error)
    return NextResponse.json(
      { error: 'Could not load support messages' },
      { status: 500 },
    )
  return NextResponse.json({
    mode: user ? 'account' : 'guest',
    thread,
    messages: messages ?? [],
  })
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request))
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 },
    )
  const clientAddress =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-vercel-forwarded-for') ??
    clientKey(request.headers)
  if (!supportRateLimit(`ip:${clientAddress}`))
    return NextResponse.json(
      { error: 'Too many messages. Please wait before trying again.' },
      { status: 429 },
    )

  const parsed = messageSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          'Enter a valid message (up to 4,000 characters) and a valid email to start guest support.',
      },
      { status: 400 },
    )

  const user = await getSessionUser()
  const admin = createAdminClient()
  if (
    !(await allowMessage(admin, `ip:${clientAddress}`)) ||
    (user && !(await allowMessage(admin, `user:${user.id}`)))
  )
    return NextResponse.json(
      { error: 'Too many messages. Please wait before trying again.' },
      { status: 429 },
    )
  let guestToken = request.cookies.get(guestCookie)?.value
  let newGuestToken: string | null = null
  let thread: { id: string; status: string; user_id: string | null } | null =
    null

  if (user) {
    const { data: profile } = await admin
      .from('profiles')
      .select('role, suspended')
      .eq('id', user.id)
      .maybeSingle()
    if (
      !profile ||
      !['buyer', 'cook'].includes(profile.role) ||
      profile.suspended
    )
      return NextResponse.json(
        { error: 'This account cannot contact support' },
        { status: 403 },
      )

    const { data, error } = await admin
      .from('support_threads')
      .select('id, status, user_id')
      .eq('user_id', user.id)
      .in('status', [...activeStatuses])
      .maybeSingle()
    if (error)
      return NextResponse.json(
        { error: 'Could not load support conversation' },
        { status: 500 },
      )
    thread = data
  } else if (guestToken) {
    const tokenHash = hashToken(guestToken)
    const { data, error } = await admin
      .from('support_threads')
      .select('id, status, user_id')
      .eq('guest_token_hash', tokenHash)
      .maybeSingle()
    if (error)
      return NextResponse.json(
        { error: 'Could not load support conversation' },
        { status: 500 },
      )
    thread = data
    if (thread?.status === 'resolved') {
      const { error: reopenError } = await admin
        .from('support_threads')
        .update({ status: 'open' })
        .eq('id', thread.id)
        .eq('status', 'resolved')
      if (reopenError)
        return NextResponse.json(
          { error: 'Could not reopen support conversation' },
          { status: 500 },
        )
      thread.status = 'open'
    }
  }

  if (!thread) {
    if (!user && !parsed.data.guest_email)
      return NextResponse.json(
        { error: 'Add an email address so the support team can follow up.' },
        { status: 400 },
      )
    const guestHash = user ? null : guestToken ? hashToken(guestToken) : null
    if (!user && !guestToken) {
      newGuestToken = randomBytes(32).toString('base64url')
      guestToken = newGuestToken
    }
    const { data, error } = await admin
      .from('support_threads')
      .insert({
        user_id: user?.id ?? null,
        guest_name: user ? null : parsed.data.guest_name?.slice(0, 80) || null,
        guest_email: user ? null : parsed.data.guest_email?.toLowerCase(),
        guest_token_hash: user ? null : (guestHash ?? hashToken(guestToken!)),
        status: 'open',
      })
      .select('id, status, user_id')
      .single()
    if (error || !data)
      return NextResponse.json(
        { error: 'Could not start support conversation' },
        { status: 500 },
      )
    thread = data
  }

  const senderType = user ? 'user' : 'guest'
  const { data: message, error: messageError } = await admin
    .from('support_messages')
    .insert({
      thread_id: thread.id,
      sender_id: user?.id ?? null,
      sender_type: senderType,
      body: parsed.data.body,
      is_internal_note: false,
    })
    .select(
      'id, thread_id, sender_id, staff_actor_id, sender_type, body, created_at, is_internal_note',
    )
    .single()
  if (messageError || !message)
    return NextResponse.json(
      { error: 'Could not send support message' },
      { status: 500 },
    )

  const now = new Date().toISOString()
  const { error: updateError } = await admin
    .from('support_threads')
    .update({
      updated_at: now,
      last_message_at: now,
      last_message_sender_type: senderType,
    })
    .eq('id', thread.id)
  if (updateError)
    return NextResponse.json(
      { error: 'Message sent, but the conversation needs a refresh' },
      { status: 500 },
    )

  // The durable outbox worker uses the existing email_deliveries table. Alerts
  // contain a dashboard link only; message text and guest contact details stay out.
  if (process.env.SUPPORT_EMAIL) {
    await admin
      .from('email_deliveries')
      .upsert(
        { kind: 'support_alert', recipient_key: message.id, status: 'queued' },
        { onConflict: 'kind,recipient_key', ignoreDuplicates: true },
      )
    await processSupportAlerts(admin, {
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      immediateMessageId: message.id,
    }).catch(() => undefined)
  }

  const response = NextResponse.json(
    { mode: user ? 'account' : 'guest', thread, message },
    { status: 201 },
  )
  if (newGuestToken) {
    response.cookies.set(guestCookie, newGuestToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/support',
      maxAge: 60 * 60 * 24 * 90,
    })
  }
  return response
}
