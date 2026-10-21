import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const campaignSchema = z.object({
  campaignKey: z.string().uuid(),
  kind: z.enum(['launch', 'newsletter', 'offer']),
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(5000),
  afterId: z.string().uuid().optional(),
})

function authorized(request: Request) {
  const expected = process.env.WAITLIST_ADMIN_API_KEY
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!expected || !supplied) return false

  const expectedBytes = Buffer.from(expected)
  const suppliedBytes = Buffer.from(supplied)
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  )
}

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

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    return NextResponse.json({ error: 'Invalid campaign details' }, { status: 400 })
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
    return NextResponse.json({ error: 'Could not prepare campaign' }, { status: 500 })
  }

  const { data: campaign, error: campaignLookupError } = await supabase
    .from('waitlist_email_campaigns')
    .select('id, kind, subject, message')
    .eq('campaign_key', campaignInput.campaignKey)
    .single()

  if (campaignLookupError || !campaign) {
    return NextResponse.json({ error: 'Could not load campaign' }, { status: 500 })
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

  let recipientQuery = supabase
    .from('waitlist_subscribers')
    .select('id, email, unsubscribe_token')
    .eq('updates_consent', true)
    .is('unsubscribed_at', null)
    .order('id', { ascending: true })
    .limit(25)

  if (campaignInput.afterId) recipientQuery = recipientQuery.gt('id', campaignInput.afterId)

  const { data: recipients, error: recipientError } = await recipientQuery
  if (recipientError) {
    return NextResponse.json({ error: 'Could not load subscribers' }, { status: 500 })
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

    if (!currentSubscriber?.updates_consent || currentSubscriber.unsubscribed_at) {
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
    const html = `<main style="font-family:Arial,sans-serif;max-width:600px;margin:32px auto;color:#2f211b;line-height:1.65"><h1 style="font-size:24px">${escapeHtml(campaign.subject)}</h1><p style="white-space:pre-line">${escapedMessage}</p><hr style="border:0;border-top:1px solid #e9d6c5;margin:32px 0"><p style="font-size:12px;color:#6e5a52">You receive Food4Love updates because you opted in. <a href="${unsubscribeUrl}">Unsubscribe</a></p></main>`
    const text = `${campaign.subject}\n\n${campaign.message}\n\nUnsubscribe: ${unsubscribeUrl}`

    try {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `${campaignInput.campaignKey}:${recipient.id}`,
        },
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
