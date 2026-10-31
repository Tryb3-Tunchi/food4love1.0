import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  CHI_HISTORY_LIMIT,
  CHI_HOURLY_LIMIT,
  CHI_MAX_MESSAGE,
  buildSystemPrompt,
} from '@/lib/chefChi'
import { generateChiReply } from '@/lib/ai/providers'

const bodySchema = z.object({
  message: z.string().trim().min(1).max(CHI_MAX_MESSAGE),
})

export async function POST(request: NextRequest) {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json(
      { error: `Messages can be up to ${CHI_MAX_MESSAGE} characters` },
      { status: 400 },
    )
  const { message } = parsed.data

  // Every reply costs money, so each account gets a fair hourly allowance.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await session
    .from('ai_chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'user')
    .gte('created_at', since)
  if (countError)
    return NextResponse.json(
      { error: 'Chef Chi is not set up yet' },
      { status: 500 },
    )
  if ((count ?? 0) >= CHI_HOURLY_LIMIT)
    return NextResponse.json(
      { error: 'Chef Chi needs a short break. Try again in a little while.' },
      { status: 429 },
    )

  const [{ data: profile }, { data: recent }] = await Promise.all([
    session
      .from('profiles')
      .select('full_name, role, location, cuisines')
      .eq('id', user.id)
      .maybeSingle(),
    session
      .from('ai_chat_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(CHI_HISTORY_LIMIT),
  ])

  const { error: saveError } = await session
    .from('ai_chat_messages')
    .insert({ user_id: user.id, role: 'user', content: message })
  if (saveError)
    return NextResponse.json(
      { error: 'Could not send your message' },
      { status: 500 },
    )

  const history = [...(recent ?? [])].reverse() as {
    role: 'user' | 'assistant'
    content: string
  }[]

  let reply
  try {
    reply = await generateChiReply({
      system: buildSystemPrompt(profile),
      history: [...history, { role: 'user', content: message }],
    })
  } catch {
    return NextResponse.json(
      { error: 'Chef Chi is resting right now. Try again in a moment.' },
      { status: 503 },
    )
  }

  // Replies are written with the service role so users cannot forge them.
  const { data: saved, error: replyError } = await createAdminClient()
    .from('ai_chat_messages')
    .insert({
      user_id: user.id,
      role: 'assistant',
      content: reply.text.slice(0, 4000),
      provider: reply.provider,
    })
    .select('id, role, content, created_at')
    .single()
  if (replyError || !saved)
    return NextResponse.json(
      { error: 'Could not save the reply' },
      { status: 500 },
    )

  return NextResponse.json({ message: saved }, { status: 201 })
}

export async function DELETE() {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await session
    .from('ai_chat_messages')
    .delete()
    .eq('user_id', user.id)
  if (error)
    return NextResponse.json(
      { error: 'Could not clear the chat' },
      { status: 500 },
    )
  return NextResponse.json({ ok: true })
}
