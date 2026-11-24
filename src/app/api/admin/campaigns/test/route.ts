import { getAdminUser } from '@/lib/admin/auth'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTransactionalEmail } from '@/lib/email/transactional'
import { adminCampaignEmail } from '@/lib/email/templates'
import { createLimiter } from '@/lib/rateLimit'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'
const testLimit = createLimiter({ limit: 3, windowMs: 5 * 60 * 1000 })
const schema = z.object({
  campaignKey: z.string().uuid(),
  subject: z.string().trim().min(2).max(120),
  previewText: z.string().max(180).default(''),
  heading: z.string().max(140).default(''),
  message: z.string().trim().min(1).max(5000),
  ctaLabel: z.string().max(40).default(''),
  ctaUrl: z.string().max(500).default(''),
})

export async function POST(request: NextRequest) {
  const actor = await getAdminUser('messages:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 },
    )
  if (!testLimit(actor.id))
    return NextResponse.json(
      { error: 'Please wait before sending another test email' },
      { status: 429 },
    )
  const input = schema.safeParse(await request.json().catch(() => null))
  if (!input.success)
    return NextResponse.json(
      { error: 'Invalid test email content' },
      { status: 400 },
    )
  if (input.data.ctaUrl) {
    try {
      if (new URL(input.data.ctaUrl).protocol !== 'https:') throw new Error()
    } catch {
      return NextResponse.json(
        { error: 'CTA link must use HTTPS' },
        { status: 400 },
      )
    }
  }

  const admin = createAdminClient()
  const { data: authResult, error: userError } =
    await admin.auth.admin.getUserById(actor.id)
  const to = authResult.user?.email
  if (userError || !to || !authResult.user?.email_confirmed_at)
    return NextResponse.json(
      {
        error:
          'A confirmed email address is required on your admin account to receive a test',
      },
      { status: 409 },
    )
  const audit = await beginAdminAudit({
    actorId: actor.id,
    action: 'email.campaign_test_sent',
    targetType: 'email_campaign',
    targetId: input.data.campaignKey,
    details: { recipient_is_actor: true },
  }).catch(() => null)
  if (!audit)
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )
  const result = await sendTransactionalEmail({
    admin,
    kind: 'campaign_test',
    recipientKey: `${input.data.campaignKey}:${actor.id}:${randomUUID()}`,
    to,
    email: adminCampaignEmail({
      subject: `[TEST] ${input.data.subject}`,
      previewText: input.data.previewText,
      heading: input.data.heading,
      message: input.data.message,
      name: String(
        actor.user_metadata?.full_name ??
          actor.user_metadata?.name ??
          'Food4Love admin',
      ),
      accountType: 'team member',
      email: to,
      unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/admin/messages/campaigns`,
      ctaLabel: input.data.ctaLabel,
      ctaUrl: input.data.ctaUrl,
      testMode: true,
    }),
  })
  const success = result === 'accepted' || result === 'already_accepted'
  await finishAdminAudit(
    audit.admin,
    audit.auditId,
    success ? 'succeeded' : 'failed',
    success ? undefined : result,
  )
  if (!success)
    return NextResponse.json(
      {
        error:
          result === 'unavailable'
            ? 'Email sender is not configured'
            : 'Test email could not be accepted by the email provider',
      },
      { status: result === 'unavailable' ? 503 : 502 },
    )
  return NextResponse.json({
    ok: true,
    alreadySent: result === 'already_accepted',
  })
}
