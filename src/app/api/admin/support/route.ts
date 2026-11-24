import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const statusSchema = z.enum(['open', 'in_progress', 'resolved'])
const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  internal_note: z.boolean().default(false),
  reason: z.string().trim().min(5).max(1000),
})

function unreadForAdmin(thread: Record<string, unknown>) {
  if (
    !['user', 'guest'].includes(String(thread.last_message_sender_type ?? ''))
  )
    return false
  const last = Date.parse(String(thread.last_message_at ?? ''))
  const read = thread.last_admin_read_at
    ? Date.parse(String(thread.last_admin_read_at))
    : 0
  return Number.isFinite(last) && last > read
}

export async function GET(request: NextRequest) {
  const actor = await getAdminUser('messages:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const threadId = request.nextUrl.searchParams.get('thread_id')
  try {
    if (threadId) {
      const validId = z.string().uuid().safeParse(threadId)
      if (!validId.success)
        return NextResponse.json(
          { error: 'Invalid conversation' },
          { status: 400 },
        )
      const { data: thread, error } = await admin
        .from('support_threads')
        .select(
          'id, user_id, guest_name, guest_email, status, assigned_to, created_at, updated_at, last_message_at, last_message_sender_type, last_admin_read_at, last_user_read_at',
        )
        .eq('id', threadId)
        .maybeSingle()
      if (error || !thread)
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: error ? 500 : 404 },
        )

      const audit = await beginAdminAudit({
        actorId: actor.id,
        action: 'support.conversation_accessed',
        targetType: 'support_thread',
        targetId: thread.id,
        details: { status: thread.status },
      }).catch(() => null)
      if (!audit)
        return NextResponse.json(
          { error: 'Admin audit logging is unavailable' },
          { status: 503 },
        )
      await admin
        .from('support_threads')
        .update({ last_admin_read_at: new Date().toISOString() })
        .eq('id', thread.id)
      const [{ data: messages, error: messageError }, profileResult] =
        await Promise.all([
          admin
            .from('support_messages')
            .select(
              'id, thread_id, sender_id, staff_actor_id, sender_type, body, created_at, is_internal_note',
            )
            .eq('thread_id', thread.id)
            .order('created_at', { ascending: true })
            .limit(500),
          thread.user_id
            ? admin
                .from('profiles')
                .select(
                  'id, full_name, role, avatar_url, location, is_verified, kyc_status, suspended',
                )
                .eq('id', thread.user_id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ])
      await finishAdminAudit(
        audit.admin,
        audit.auditId,
        messageError ? 'failed' : 'succeeded',
        messageError?.message,
      )
      if (messageError)
        return NextResponse.json(
          { error: 'Could not load support conversation' },
          { status: 500 },
        )
      return NextResponse.json({
        thread,
        profile: profileResult.data,
        messages: messages ?? [],
      })
    }

    const search =
      request.nextUrl.searchParams.get('search')?.trim().slice(0, 100) ?? ''
    const requestedPage =
      Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10) || 1
    const page = Math.min(10000, Math.max(1, requestedPage))
    const pageSize = 25
    const requestedStatus = request.nextUrl.searchParams.get('status') ?? 'all'
    const parsedStatus =
      requestedStatus === 'all' ? null : statusSchema.safeParse(requestedStatus)
    if (parsedStatus && !parsedStatus.success)
      return NextResponse.json(
        { error: 'Invalid conversation status' },
        { status: 400 },
      )
    const status = parsedStatus?.success ? parsedStatus.data : null

    const query = () => {
      let q = admin
        .from('support_threads')
        .select(
          'id, user_id, guest_name, guest_email, status, assigned_to, created_at, updated_at, last_message_at, last_message_sender_type, last_admin_read_at',
          { count: 'exact' },
        )
      if (status) q = q.eq('status', status)
      return q
    }

    let rows: Record<string, unknown>[] = []
    let total = 0
    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`
      const [guestResult, profileResult] = await Promise.all([
        query()
          .or(`guest_name.ilike.${pattern},guest_email.ilike.${pattern}`)
          .order('updated_at', { ascending: false })
          .limit(100),
        admin
          .from('profiles')
          .select('id')
          .ilike('full_name', pattern)
          .limit(100),
      ])
      if (guestResult.error || profileResult.error)
        return NextResponse.json(
          { error: 'Could not search support inbox' },
          { status: 500 },
        )
      rows = (guestResult.data ?? []) as Record<string, unknown>[]
      total += guestResult.count ?? rows.length
      const profileIds = (profileResult.data ?? []).map((profile) => profile.id)
      if (profileIds.length) {
        const accountResult = await query()
          .in('user_id', profileIds)
          .order('updated_at', { ascending: false })
          .limit(100)
        if (accountResult.error)
          return NextResponse.json(
            { error: 'Could not search support inbox' },
            { status: 500 },
          )
        const unique = new Set(rows.map((row) => row.id))
        for (const row of accountResult.data ?? []) {
          if (!unique.has(row.id)) rows.push(row as Record<string, unknown>)
        }
        total += accountResult.count ?? accountResult.data?.length ?? 0
      }
      rows.sort(
        (a, b) =>
          Date.parse(String(b.updated_at)) - Date.parse(String(a.updated_at)),
      )
      rows = rows.slice((page - 1) * pageSize, page * pageSize)
    } else {
      const { data, count, error } = await query()
        .order('updated_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)
      if (error)
        return NextResponse.json(
          { error: 'Could not load support inbox' },
          { status: 500 },
        )
      rows = (data ?? []) as Record<string, unknown>[]
      total = count ?? 0
    }

    const userIds = rows
      .map((row) => row.user_id)
      .filter((id): id is string => typeof id === 'string')
    const [{ data: profiles }, { data: staffUsers }] = await Promise.all([
      userIds.length
        ? admin
            .from('profiles')
            .select(
              'id, full_name, role, location, is_verified, kyc_status, suspended',
            )
            .in('id', userIds)
        : Promise.resolve({ data: [], error: null }),
      admin.auth.admin.listUsers({ page: 1, perPage: 100 }),
    ])
    const profileById = new Map(
      (profiles ?? []).map((profile) => [profile.id, profile]),
    )
    const assignees = (staffUsers?.users ?? [])
      .filter(
        (user) =>
          user.app_metadata?.role === 'admin' &&
          Array.isArray(user.app_metadata?.admin_permissions) &&
          user.app_metadata.admin_permissions.includes('messages:manage'),
      )
      .map((user) => ({
        id: user.id,
        name: String(
          user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            'Food4Love admin',
        ),
      }))

    return NextResponse.json({
      threads: rows.map((thread) => ({
        ...thread,
        profile: profileById.get(String(thread.user_id)) ?? null,
        unread: unreadForAdmin(thread),
      })),
      assignees,
      page,
      pageSize,
      total,
      email_alert_configured: Boolean(
        process.env.SUPPORT_EMAIL && process.env.RESEND_API_KEY,
      ),
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not load support inbox' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const actor = await getAdminUser('messages:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 },
    )
  const body = await request.json().catch(() => null)
  const threadId = z.string().uuid().safeParse(body?.thread_id)
  if (!threadId.success)
    return NextResponse.json({ error: 'Invalid conversation' }, { status: 400 })
  const parsed = messageSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Enter a message and a support reason' },
      { status: 400 },
    )

  const admin = createAdminClient()
  const { data: thread, error: threadError } = await admin
    .from('support_threads')
    .select('id, user_id, guest_email, status')
    .eq('id', threadId.data)
    .maybeSingle()
  if (threadError || !thread)
    return NextResponse.json(
      { error: 'Conversation not found' },
      { status: threadError ? 500 : 404 },
    )
  const audit = await beginAdminAudit({
    actorId: actor.id,
    action: parsed.data.internal_note
      ? 'support.staff_note_added'
      : 'support.staff_sent',
    targetType: 'support_thread',
    targetId: thread.id,
    details: {
      reason: parsed.data.reason,
      content_length: parsed.data.body.length,
      internal_note: parsed.data.internal_note,
    },
  }).catch(() => null)
  if (!audit)
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )

  const { data: message, error } = await audit.admin
    .from('support_messages')
    .insert({
      thread_id: thread.id,
      sender_id: null,
      staff_actor_id: actor.id,
      sender_type: 'staff',
      body: parsed.data.body,
      is_internal_note: parsed.data.internal_note,
    })
    .select(
      'id, thread_id, sender_id, staff_actor_id, sender_type, body, created_at, is_internal_note',
    )
    .single()
  if (error || !message) {
    await finishAdminAudit(audit.admin, audit.auditId, 'failed', error?.message)
    return NextResponse.json(
      { error: 'Could not send support reply' },
      { status: 500 },
    )
  }

  const now = new Date().toISOString()
  const { error: updateError } = await audit.admin
    .from('support_threads')
    .update({
      updated_at: now,
      ...(!parsed.data.internal_note
        ? {
            last_message_at: now,
            last_message_sender_type: 'staff',
            last_user_read_at: now,
          }
        : {}),
    })
    .eq('id', thread.id)
  let notificationError: { message?: string } | null = null
  if (!parsed.data.internal_note && thread.user_id) {
    const result = await audit.admin.from('notifications').insert({
      user_id: thread.user_id,
      type: 'message',
      title: 'New reply from Food4Love Support',
      body: 'A support agent replied to your conversation.',
      data: { support_thread_id: thread.id },
    })
    notificationError = result.error
  }
  await finishAdminAudit(
    audit.admin,
    audit.auditId,
    updateError ? 'failed' : 'succeeded',
    updateError?.message,
  )
  if (updateError)
    return NextResponse.json(
      { error: 'Reply was saved, but the inbox needs a refresh' },
      { status: 500 },
    )
  return NextResponse.json({ message, notification_sent: !notificationError })
}
