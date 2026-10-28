import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
})

async function getSessionUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: thread, error: threadError } = await admin
    .from('support_threads')
    .select('id, status, created_at, updated_at')
    .eq('user_id', user.id)
    .eq('status', 'open')
    .maybeSingle()
  if (threadError)
    return NextResponse.json(
      { error: 'Could not load support conversation' },
      { status: 500 },
    )
  if (!thread) return NextResponse.json({ thread: null, messages: [] })

  const { data: messages, error } = await admin
    .from('support_messages')
    .select('id, thread_id, sender_id, sender_type, body, created_at')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })
    .limit(500)
  if (error)
    return NextResponse.json(
      { error: 'Could not load support messages' },
      { status: 500 },
    )
  return NextResponse.json({ thread, messages: messages ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = messageSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Enter a message up to 4,000 characters' },
      { status: 400 },
    )

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, suspended')
    .eq('id', user.id)
    .maybeSingle()
  if (
    !profile ||
    !['buyer', 'cook'].includes(profile.role) ||
    profile.suspended
  ) {
    return NextResponse.json(
      { error: 'This account cannot contact support' },
      { status: 403 },
    )
  }

  let { data: thread } = await admin
    .from('support_threads')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('status', 'open')
    .maybeSingle()
  if (!thread) {
    const { data: created, error } = await admin
      .from('support_threads')
      .insert({ user_id: user.id, status: 'open' })
      .select('id, status')
      .single()
    if (error || !created) {
      const { data: concurrent } = await admin
        .from('support_threads')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle()
      if (!concurrent)
        return NextResponse.json(
          { error: 'Could not start support conversation' },
          { status: 500 },
        )
      thread = concurrent
    } else {
      thread = created
    }
  }

  const { data: message, error } = await admin
    .from('support_messages')
    .insert({
      thread_id: thread.id,
      sender_id: user.id,
      sender_type: 'user',
      body: parsed.data.body,
    })
    .select('id, thread_id, sender_id, sender_type, body, created_at')
    .single()
  if (error || !message)
    return NextResponse.json(
      { error: 'Could not send support message' },
      { status: 500 },
    )

  await admin
    .from('support_threads')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', thread.id)
  return NextResponse.json({ thread, message }, { status: 201 })
}
