import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyCronRequest } from '@/lib/cron/auth'
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
  campaignName: z.string().trim().min(2).max(100).optional(),
  kind: z.enum(['launch', 'newsletter', 'offer']),
  subject: z.string().trim().min(1).max(120),
  previewText: z.string().max(180).default(''),
  heading: z.string().max(140).default(''),
  message: z.string().trim().min(1).max(5000),
  ctaLabel: z.string().max(40).default(''),
  ctaUrl: z.string().max(500).default(''),
  selectedIds: z.array(z.string().uuid()).max(500).default([]),
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
  const isCron =
    !actor &&
    verifyCronRequest(
      request.headers.get('authorization'),
      process.env.CRON_SECRET,
    ) === 'ok'
  if (!actor && !isCron)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
  if (parsed.data.ctaUrl) {
    try {
      if (new URL(parsed.data.ctaUrl).protocol !== 'https:') throw new Error()
    } catch {
      return NextResponse.json(
        { error: 'CTA link must use HTTPS' },
        { status: 400 },
      )
    }
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
  let actorId = actor?.id
  if (isCron) {
    const { data: scheduled } = await supabase
      .from('waitlist_email_campaigns')
      .select('created_by, campaign_status, scheduled_at, next_after_id')
      .eq('campaign_key', campaignInput.campaignKey)
      .maybeSingle()
    if (
      !scheduled ||
      scheduled.campaign_status !== 'scheduled' ||
      !scheduled.scheduled_at ||
      Date.parse(scheduled.scheduled_at) > Date.now() ||
      campaignInput.afterId !== (scheduled.next_after_id ?? undefined) ||
      !scheduled.created_by
    )
      return NextResponse.json(
        { error: 'Campaign is not ready for scheduled delivery' },
        { status: 403 },
      )
    actorId = scheduled.created_by
  }
  if (!actorId)
    return NextResponse.json(
      { error: 'Campaign sender is unavailable' },
      { status: 403 },
    )
  const { error: campaignError } = await supabase
    .from('waitlist_email_campaigns')
    .upsert(
      {
        campaign_key: campaignInput.campaignKey,
        kind: campaignInput.kind,
        subject: campaignInput.subject,
        message: campaignInput.message,
        campaign_name: campaignInput.campaignName ?? 'Waitlist update',
        preview_text: campaignInput.previewText,
        email_heading: campaignInput.heading,
        cta_label: campaignInput.ctaLabel || null,
        cta_url: campaignInput.ctaUrl || null,
        campaign_status: 'sending',
        selected_subscriber_ids: campaignInput.selectedIds,
        scheduled_at: null,
        updated_at: new Date().toISOString(),
        created_by: actorId,
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
    .select(
      'id, kind, subject, message, campaign_name, preview_text, email_heading, cta_label, cta_url, selected_subscriber_ids, campaign_status',
    )
    .eq('campaign_key', campaignInput.campaignKey)
    .single()

  if (campaignLookupError || !campaign) {
    return NextResponse.json(
      { error: 'Could not load campaign' },
      { status: 500 },
    )
  }

  const campaignContentChanged =
    campaign.kind !== campaignInput.kind ||
    campaign.subject !== campaignInput.subject ||
    campaign.message !== campaignInput.message ||
    JSON.stringify(campaign.selected_subscriber_ids ?? []) !==
      JSON.stringify(campaignInput.selectedIds) ||
    campaign.campaign_name !==
      (campaignInput.campaignName ?? 'Waitlist update') ||
    campaign.preview_text !== campaignInput.previewText ||
    campaign.email_heading !== campaignInput.heading ||
    campaign.cta_label !== (campaignInput.ctaLabel || null) ||
    campaign.cta_url !== (campaignInput.ctaUrl || null)
  if (campaignContentChanged && actor && campaign.campaign_status === 'draft') {
    const { error: updateDraftError } = await supabase
      .from('waitlist_email_campaigns')
      .update({
        kind: campaignInput.kind,
        campaign_name: campaignInput.campaignName ?? 'Waitlist update',
        subject: campaignInput.subject,
        message: campaignInput.message,
        preview_text: campaignInput.previewText,
        email_heading: campaignInput.heading,
        cta_label: campaignInput.ctaLabel || null,
        cta_url: campaignInput.ctaUrl || null,
        selected_subscriber_ids: campaignInput.selectedIds,
        campaign_status: 'sending',
        scheduled_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaign.id)
      .eq('campaign_status', 'draft')
    if (updateDraftError)
      return NextResponse.json(
        { error: 'Could not update campaign draft' },
        { status: 409 },
      )
    Object.assign(campaign, {
      kind: campaignInput.kind,
      campaign_name: campaignInput.campaignName ?? 'Waitlist update',
      subject: campaignInput.subject,
      message: campaignInput.message,
      preview_text: campaignInput.previewText,
      email_heading: campaignInput.heading,
      cta_label: campaignInput.ctaLabel || null,
      cta_url: campaignInput.ctaUrl || null,
      selected_subscriber_ids: campaignInput.selectedIds,
    })
  } else if (campaignContentChanged) {
    return NextResponse.json(
      { error: 'This campaign key is already attached to different content' },
      { status: 409 },
    )
  }

  let audit: Awaited<ReturnType<typeof beginAdminAudit>>
  try {
    audit = await beginAdminAudit({
      actorId,
      action: 'waitlist.email_campaign_batch',
      targetType: 'waitlist_email_campaign',
      targetId: campaign.id,
      details: {
        kind: campaignInput.kind,
        recipient_limit: 25,
        has_after_id: Boolean(campaignInput.afterId),
        selected_count: campaignInput.selectedIds.length,
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
    .select('id, email, unsubscribe_token, audience')
    .eq('updates_consent', true)
    .is('unsubscribed_at', null)
    .order('id', { ascending: true })
    .limit(25)

  if (campaignInput.afterId)
    recipientQuery = recipientQuery.gt('id', campaignInput.afterId)
  if (campaignInput.selectedIds.length)
    recipientQuery = recipientQuery.in('id', campaignInput.selectedIds)

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

    if (
      previousDelivery &&
      ['sent', 'delivered', 'bounced', 'skipped'].includes(
        previousDelivery.status,
      )
    ) {
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
    const accountType = recipient.audience === 'cook' ? 'cook' : 'food lover'
    const personalize = (value: string) =>
      value
        .replace(/\{\{\s*email\s*\}\}/gi, recipient.email)
        .replace(/\{\{\s*account_type\s*\}\}/gi, accountType)
    const personalizedMessage = personalize(campaign.message)
    const escapedMessage = escapeHtml(personalizedMessage)
    const footerInput = { unsubscribeUrl, sender }
    const heading = campaign.email_heading
      ? escapeHtml(personalize(campaign.email_heading))
      : escapeHtml(campaign.subject)
    const ctaHtml =
      campaign.cta_label && campaign.cta_url
        ? `<p style="margin:24px 0"><a href="${escapeHtml(campaign.cta_url)}" style="display:inline-block;border-radius:8px;background:#176044;color:#fff;padding:12px 18px;text-decoration:none;font-weight:bold">${escapeHtml(campaign.cta_label)}</a></p>`
        : ''
    const html = `<main style="font-family:Arial,sans-serif;max-width:600px;margin:32px auto;color:#2f211b;line-height:1.65"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(personalize(campaign.preview_text ?? ''))}</div><p style="color:#176044;font-size:13px;font-weight:bold">Food4Love</p><h1 style="font-size:24px">${heading}</h1><p style="white-space:pre-line">${escapedMessage}</p>${ctaHtml}<hr style="border:0;border-top:1px solid #e9d6c5;margin:32px 0">${marketingFooterHtml(footerInput)}</main>`
    const text = `${campaign.email_heading || campaign.subject}

${personalizedMessage}
${campaign.cta_label && campaign.cta_url ? `\n${campaign.cta_label}: ${campaign.cta_url}\n` : ''}

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
  await supabase
    .from('waitlist_email_campaigns')
    .update({
      campaign_status: hasMore
        ? isCron
          ? 'scheduled'
          : 'sending'
        : failed > 0
          ? 'failed'
          : 'completed',
      next_after_id: hasMore ? recipients?.at(-1)?.id : null,
      scheduled_at: hasMore && isCron ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id)
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
