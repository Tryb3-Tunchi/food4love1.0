import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminUser } from '@/lib/admin/auth'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import {
  marketingFooterHtml,
  marketingFooterText,
  marketingSenderIdentity,
} from '@/lib/email/waitlistRules'

export const runtime = 'nodejs'

const campaignSchema = z.object({
  campaignKey: z.string().uuid(),
  kind: z.enum(['launch', 'newsletter', 'offer']),
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(5000),
  afterId: z.string().uuid().optional(),
})

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })
}

export async function GET() {
  const actor = await getAdminUser('messages:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const supabase = createAdminClient()
    const [{ count, error }, { data: latestCampaign, error: campaignError }] =
      await Promise.all([
        supabase
          .from('waitlist_subscribers')
          .select('id', { count: 'exact', head: true })
          .eq('updates_consent', true)
          .is('unsubscribed_at', null),
        supabase
          .from('waitlist_email_campaigns')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
    if (error || campaignError) {
      return NextResponse.json(
        { error: 'Could not load email campaign status' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      eligible_count: count ?? 0,
      email_configured: Boolean(
        process.env.RESEND_API_KEY && process.env.WAITLIST_FROM_EMAIL,
      ),
      email_sender: process.env.WAITLIST_FROM_EMAIL ?? null,
      latest_campaign_at: latestCampaign?.created_at ?? null,
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not load email campaign status' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const actor = await getAdminUser('messages:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 },
    )
  }

  const resendApiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.WAITLIST_FROM_EMAIL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (!resendApiKey || !fromEmail || !appUrl) {
    return NextResponse.json(
      { error: 'Email delivery is not configured' },
      { status: 503 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = campaignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid campaign details' },
      { status: 400 },
    )
  }

  // Marketing email must identify the sender and give a postal address. The business
  // details are an owner decision, so refuse to send until they are configured.
  const sender = marketingSenderIdentity({
    MARKETING_SENDER_NAME: process.env.MARKETING_SENDER_NAME,
    MARKETING_SENDER_ADDRESS: process.env.MARKETING_SENDER_ADDRESS,
  })
  if (!sender) {
    return NextResponse.json(
      {
        error:
          'Set MARKETING_SENDER_ADDRESS (and optionally MARKETING_SENDER_NAME) before sending marketing email',
      },
      { status: 503 },
    )
  }

  const campaignInput = parsed.data
  const supabase = createAdminClient()
  const { error: campaignError } = await supabase
    .from('waitlist_email_campaigns')
    .upsert(
      {
        campaign_key: campaignInput.campaignKey,
        kind: campaignInput.kind,
        subject: campaignInput.subject,
        message: campaignInput.message,
      },
      { onConflict: 'campaign_key', ignoreDuplicates: true },
    )

  if (campaignError) {
    return NextResponse.json(
      { error: 'Could not prepare campaign' },
      { status: 500 },
    )
  }

  const { data: campaign, error: campaignLookupError } = await supabase
    .from('waitlist_email_campaigns')
    .select('id, kind, subject, message')
    .eq('campaign_key', campaignInput.campaignKey)
    .single()

  if (campaignLookupError || !campaign) {
    return NextResponse.json(
      { error: 'Could not load campaign' },
      { status: 500 },
    )
  }

  if (
    campaign.kind !== campaignInput.kind ||
    campaign.subject !== campaignInput.subject ||
    campaign.message !== campaignInput.message
  ) {
    return NextResponse.json(
      { error: 'This campaign key is already attached to different content' },
      { status: 409 },
    )
  }

  let audit: Awaited<ReturnType<typeof beginAdminAudit>>
  try {
    audit = await beginAdminAudit({
      actorId: actor.id,
      action: 'waitlist.email_campaign_batch',
      targetType: 'waitlist_email_campaign',
      targetId: campaign.id,
      details: {
        kind: campaignInput.kind,
        recipient_limit: 25,
        has_after_id: Boolean(campaignInput.afterId),
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )
  }

  let recipientQuery = supabase
    .from('waitlist_subscribers')
    .select('id, email, unsubscribe_token')
    .eq('updates_consent', true)
    .is('unsubscribed_at', null)
    .order('id', { ascending: true })
    .limit(25)

  if (campaignInput.afterId)
    recipientQuery = recipientQuery.gt('id', campaignInput.afterId)

  const { data: recipients, error: recipientError } = await recipientQuery
  if (recipientError) {
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      'failed',
      'Audience query failed',
    )
    return NextResponse.json(
      { error: 'Could not load subscribers' },
      { status: 500 },
    )
  }

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const recipient of recipients ?? []) {
    const { data: previousDelivery } = await supabase
      .from('waitlist_email_deliveries')
      .select('status')
      .eq('campaign_id', campaign.id)
      .eq('subscriber_id', recipient.id)
      .maybeSingle()

    if (previousDelivery?.status === 'sent') {
      skipped += 1
      continue
    }

    const { data: currentSubscriber } = await supabase
      .from('waitlist_subscribers')
      .select('updates_consent, unsubscribed_at')
      .eq('id', recipient.id)
      .maybeSingle()

    if (
      !currentSubscriber?.updates_consent ||
      currentSubscriber.unsubscribed_at
    ) {
      await supabase.from('waitlist_email_deliveries').upsert(
        {
          campaign_id: campaign.id,
          subscriber_id: recipient.id,
          status: 'skipped',
          error_message: null,
        },
        { onConflict: 'campaign_id,subscriber_id' },
      )
      skipped += 1
      continue
    }

    const unsubscribeUrl = `${appUrl}/api/waitlist/unsubscribe?token=${encodeURIComponent(recipient.unsubscribe_token)}`
    const escapedMessage = escapeHtml(campaign.message)
    const footerInput = { unsubscribeUrl, sender }
    const html = `<main style="font-family:Arial,sans-serif;max-width:600px;margin:32px auto;color:#2f211b;line-height:1.65"><h1 style="font-size:24px">${escapeHtml(campaign.subject)}</h1><p style="white-space:pre-line">${escapedMessage}</p><hr style="border:0;border-top:1px solid #e9d6c5;margin:32px 0">${marketingFooterHtml(footerInput)}</main>`
    const text = `${campaign.subject}

${campaign.message}

${marketingFooterText(footerInput)}`

    try {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `${campaignInput.campaignKey}:${recipient.id}`,
        },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          from: fromEmail,
          to: [recipient.email],
          subject: campaign.subject,
          html,
          text,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
      })
      const responseBody = (await emailResponse.json().catch(() => ({}))) as {
        id?: string
      }

      if (!emailResponse.ok) {
        await supabase.from('waitlist_email_deliveries').upsert(
          {
            campaign_id: campaign.id,
            subscriber_id: recipient.id,
            status: 'failed',
            error_message: `Email provider returned ${emailResponse.status}`,
          },
          { onConflict: 'campaign_id,subscriber_id' },
        )
        failed += 1
        continue
      }

      const { error: deliveryError } = await supabase
        .from('waitlist_email_deliveries')
        .upsert(
          {
            campaign_id: campaign.id,
            subscriber_id: recipient.id,
            status: 'sent',
            provider_message_id: responseBody.id ?? null,
            sent_at: new Date().toISOString(),
            error_message: null,
          },
          { onConflict: 'campaign_id,subscriber_id' },
        )

      if (deliveryError) failed += 1
      else sent += 1
    } catch {
      await supabase.from('waitlist_email_deliveries').upsert(
        {
          campaign_id: campaign.id,
          subscriber_id: recipient.id,
          status: 'failed',
          error_message: 'Email provider request failed',
        },
        { onConflict: 'campaign_id,subscriber_id' },
      )
      failed += 1
    }
  }

  const hasMore = (recipients?.length ?? 0) === 25
  await finishAdminAudit(
    audit.admin,
    audit.auditId,
    failed > 0 ? 'failed' : 'succeeded',
    failed > 0 ? `${failed} recipient delivery attempt(s) failed` : undefined,
  )
  return NextResponse.json({
    campaignKey: campaignInput.campaignKey,
    attempted: recipients?.length ?? 0,
    sent,
    failed,
    skipped,
    hasMore,
    nextAfterId: hasMore ? recipients?.at(-1)?.id : null,
  })
}
