import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  CHI_HISTORY_LIMIT,
  CHI_HOURLY_LIMIT,
  CHI_MAX_MESSAGE,
  CHI_ROLES,
  buildSystemPrompt,
} from '@/lib/chefChi'
import { generateChiReply, isAiConfigured } from '@/lib/ai/providers'

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(CHI_HISTORY_LIMIT),
})

// Chef Chi keeps no chat on the server. The browser sends the recent
// messages each time, so there is no database to set up. This counter is a
// best-effort limit per server instance, to stop one account from running up
// the AI bill.
const recentRequests = new Map<string, number[]>()

function withinLimit(userId: string) {
  const now = Date.now()
  const hourAgo = now - 60 * 60 * 1000
  const recent = (recentRequests.get(userId) ?? []).filter((t) => t > hourAgo)
  if (recent.length >= CHI_HOURLY_LIMIT) {
    recentRequests.set(userId, recent)
    return false
  }
  recent.push(now)
  recentRequests.set(userId, recent)
  return true
}

export async function POST(request: NextRequest) {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
  const { messages } = parsed.data

  const last = messages[messages.length - 1]
  if (last.role !== 'user')
    return NextResponse.json(
      { error: 'Send a message to Chef Chi first' },
      { status: 400 },
    )
  if (last.content.length > CHI_MAX_MESSAGE)
    return NextResponse.json(
      { error: `Messages can be up to ${CHI_MAX_MESSAGE} characters` },
      { status: 400 },
    )

  const { data: profile } = await session
    .from('profiles')
    .select('full_name, role, location, cuisines')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !(CHI_ROLES as readonly string[]).includes(profile.role))
    return NextResponse.json(
      { error: 'Chef Chi is not available for your account yet' },
      { status: 403 },
    )

  if (!isAiConfigured())
    return NextResponse.json(
      {
        error:
          'Chef Chi is not switched on yet. The team still needs to add the AI key.',
      },
      { status: 503 },
    )

  if (!withinLimit(user.id))
    return NextResponse.json(
      { error: 'Chef Chi needs a short break. Try again in a little while.' },
      { status: 429 },
    )

  try {
    const reply = await generateChiReply({
      system: buildSystemPrompt(profile),
      history: messages,
    })
    return NextResponse.json({ reply: reply.text })
  } catch {
    return NextResponse.json(
      { error: 'Chef Chi is resting right now. Try again in a moment.' },
      { status: 503 },
    )
  }
}
