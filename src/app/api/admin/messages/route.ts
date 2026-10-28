import { getAdminUser } from '@/lib/admin/auth'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const sendSchema = z.object({
  user_id: z.string().uuid(),
  content: z.string().trim().min(1).max(4000),
  reason: z.string().trim().min(5).max(1000),
})

const uuidSchema = z.string().uuid()

export async function GET(request: NextRequest) {
  const actor = await getAdminUser('messages:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const admin = createAdminClient()
    const userId = request.nextUrl.searchParams.get('user_id')

    if (userId) {
      const parsedId = uuidSchema.safeParse(userId)
      if (!parsedId.success) {
        return NextResponse.json({ error: 'Invalid account' }, { status: 400 })
      }

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select(
          'id, full_name, role, avatar_url, location, is_verified, kyc_status, suspended',
        )
        .eq('id', parsedId.data)
        .maybeSingle()
      if (profileError) {
        return NextResponse.json(
          { error: 'Could not load account' },
          { status: 500 },
        )
      }
      if (!profile || !['buyer', 'cook'].includes(profile.role ?? '')) {
        return NextResponse.json(
          { error: 'Account not found' },
          { status: 404 },
        )
      }

      const { data: thread, error: threadError } = await admin
        .from('support_threads')
        .select('id, status, created_at, updated_at')
        .eq('user_id', parsedId.data)
        .eq('status', 'open')
        .maybeSingle()
      if (threadError) {
        return NextResponse.json(
          { error: 'Could not load support conversation' },
          { status: 500 },
        )
      }

      let messages: unknown[] = []
      if (thread) {
        const { data, error } = await admin
          .from('support_messages')
          .select(
            'id, thread_id, sender_id, staff_actor_id, sender_type, body, created_at',
          )
          .eq('thread_id', thread.id)
          .order('created_at', { ascending: true })
          .limit(500)
        if (error) {
          return NextResponse.json(
            { error: 'Could not load support conversation' },
            { status: 500 },
          )
        }
        messages = data ?? []
        const audit = await beginAdminAudit({
          actorId: actor.id,
          action: 'support.conversation_accessed',
          targetType: 'support_thread',
          targetId: thread.id,
          details: { message_count: messages.length },
        }).catch(() => null)
        if (!audit) {
          return NextResponse.json(
            { error: 'Admin audit logging is unavailable' },
            { status: 503 },
          )
        }
        await finishAdminAudit(audit.admin, audit.auditId, 'succeeded')
      }

      return NextResponse.json({ profile, thread, messages })
    }

    const search =
      request.nextUrl.searchParams.get('search')?.trim().slice(0, 100) ?? ''
    const requestedPage =
      Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10) || 1
    const page = Math.min(10000, Math.max(1, requestedPage))
    const pageSize = Math.min(
      50,
      Math.max(
        1,
        Number.parseInt(
          request.nextUrl.searchParams.get('page_size') ?? '25',
          10,
        ) || 25,
      ),
    )
    const start = (page - 1) * pageSize
    const {
      data: users,
      count,
      error,
    } = await admin
      .from('profiles')
      .select(
        'id, full_name, role, avatar_url, location, is_verified, kyc_status, suspended, created_at',
        { count: 'exact' },
      )
      .in('role', ['buyer', 'cook'])
      .ilike('full_name', `%${search.replace(/[\\%_]/g, '\\$&')}%`)
      .order('created_at', { ascending: false })
      .range(start, start + pageSize - 1)

    if (error) {
      return NextResponse.json(
        { error: 'Could not load accounts' },
        { status: 500 },
      )
    }

    const ids = (users ?? []).map((user) => user.id)
    const { data: threads, error: threadsError } = ids.length
      ? await admin
          .from('support_threads')
          .select('id, user_id, status, updated_at')
          .in('user_id', ids)
          .eq('status', 'open')
      : { data: [], error: null }
    if (threadsError) {
      return NextResponse.json(
        { error: 'Could not load conversation status' },
        { status: 500 },
      )
    }
    const threadByUser = new Map(
      (threads ?? []).map((thread) => [thread.user_id, thread]),
    )

    return NextResponse.json({
      users: (users ?? []).map((user) => ({
        ...user,
        thread: threadByUser.get(user.id) ?? null,
      })),
      page,
      pageSize,
      total: count ?? 0,
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not load support conversations' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const actor = await getAdminUser('messages:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = sendSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A valid account, message, and support reason are required' },
      { status: 400 },
    )
  }

  try {
    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, suspended')
      .eq('id', parsed.data.user_id)
      .maybeSingle()
    if (profileError) {
      return NextResponse.json(
        { error: 'Could not verify account' },
        { status: 500 },
      )
    }
    if (!profile || !['buyer', 'cook'].includes(profile.role ?? '')) {
      return NextResponse.json(
        { error: 'Account is unavailable' },
        { status: 404 },
      )
    }

    const { data: existingThread, error: threadError } = await admin
      .from('support_threads')
      .select('id, status, created_at, updated_at')
      .eq('user_id', profile.id)
      .eq('status', 'open')
      .maybeSingle()
    if (threadError) {
      return NextResponse.json(
        { error: 'Could not load support conversation' },
        { status: 500 },
      )
    }
    let thread = existingThread
    if (!thread) {
      const { data: created, error: createError } = await admin
        .from('support_threads')
        .insert({ user_id: profile.id, status: 'open' })
        .select('id, status, created_at, updated_at')
        .single()
      if (createError || !created) {
        // A concurrent first message may have created the single open thread.
        const { data: existing } = await admin
          .from('support_threads')
          .select('id, status, created_at, updated_at')
          .eq('user_id', profile.id)
          .eq('status', 'open')
          .maybeSingle()
        if (!existing) {
          return NextResponse.json(
            { error: 'Could not start support conversation' },
            { status: 500 },
          )
        }
        thread = existing
      } else {
        thread = created
      }
    }

    const audit = await beginAdminAudit({
      actorId: actor.id,
      action: 'support.staff_sent',
      targetType: 'support_thread',
      targetId: thread.id,
      details: {
        reason: parsed.data.reason,
        content_length: parsed.data.content.length,
        account_suspended: Boolean(profile.suspended),
      },
    }).catch(() => null)
    if (!audit) {
      return NextResponse.json(
        { error: 'Admin audit logging is unavailable' },
        { status: 503 },
      )
    }

    const { data: message, error: messageError } = await audit.admin
      .from('support_messages')
      .insert({
        thread_id: thread.id,
        sender_id: null,
        staff_actor_id: actor.id,
        sender_type: 'staff',
        body: parsed.data.content,
      })
      .select(
        'id, thread_id, sender_id, staff_actor_id, sender_type, body, created_at',
      )
      .single()

    if (messageError || !message) {
      await finishAdminAudit(
        audit.admin,
        audit.auditId,
        'failed',
        messageError?.message,
      )
      return NextResponse.json(
        { error: 'Could not send support message' },
        { status: 500 },
      )
    }

    const { data: updatedThread, error: updateError } = await audit.admin
      .from('support_threads')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', thread.id)
      .select('id, status, created_at, updated_at')
      .single()
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      updateError ? 'failed' : 'succeeded',
      updateError?.message,
    )
    if (updateError || !updatedThread) {
      return NextResponse.json(
        { error: 'Message sent, but the conversation needs a refresh' },
        { status: 500 },
      )
    }

    return NextResponse.json(
      { thread: updatedThread, message },
      { status: 201 },
    )
  } catch {
    return NextResponse.json(
      { error: 'Could not send support message' },
      { status: 500 },
    )
  }
}
