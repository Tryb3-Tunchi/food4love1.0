import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { getAdminUser } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const campaignSchema = z.object({
  audience: z.enum(['members', 'waitlist']),
  campaignKey: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  kind: z.enum(['launch', 'newsletter', 'offer']).default('launch'),
  subject: z.string().trim().min(2).max(120),
  previewText: z.string().trim().max(180).default(''),
  heading: z.string().trim().max(140).default(''),
  message: z.string().trim().min(1).max(5000),
  ctaLabel: z.string().trim().max(40).default(''),
  ctaUrl: z.string().trim().max(500).default(''),
  sendEmail: z.boolean().default(true),
  sendInApp: z.boolean().default(false),
  targetGroup: z
    .enum(['all', 'buyers', 'cooks', 'testers', 'selected'])
    .default('all'),
  selectedUserIds: z.array(z.string().uuid()).max(500).default([]),
  selectedSubscriberIds: z.array(z.string().uuid()).max(500).default([]),
  scheduleAt: z.string().datetime().nullable().optional(),
  action: z.enum(['draft', 'schedule']),
})

export async function GET() {
  const actor = await getAdminUser('messages:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const admin = createAdminClient()
    const [{ data: members }, { data: waitlist }] = await Promise.all([
      admin
        .from('admin_announcements')
        .select(
          'id, campaign_key, campaign_name, subject, message, preview_text, email_heading, cta_label, cta_url, campaign_status, scheduled_at, created_at, target_group, selected_user_ids',
        )
        .order('updated_at', { ascending: false })
        .limit(30),
      admin
        .from('waitlist_email_campaigns')
        .select(
          'id, campaign_key, campaign_name, subject, message, preview_text, email_heading, cta_label, cta_url, campaign_status, scheduled_at, created_at, kind, selected_subscriber_ids',
        )
        .order('updated_at', { ascending: false })
        .limit(30),
    ])
    const memberIds = (members ?? []).map((item) => item.id)
    const waitlistIds = (waitlist ?? []).map((item) => item.id)
    const [
      { data: memberDeliveries, error: memberDeliveryError },
      { data: waitlistDeliveries, error: waitlistDeliveryError },
    ] = await Promise.all([
      memberIds.length
        ? admin
            .from('admin_announcement_deliveries')
            .select('campaign_id, email_status, in_app_status')
            .in('campaign_id', memberIds)
        : Promise.resolve({ data: [], error: null }),
      waitlistIds.length
        ? admin
            .from('waitlist_email_deliveries')
            .select('campaign_id, status')
            .in('campaign_id', waitlistIds)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (memberDeliveryError || waitlistDeliveryError)
      return NextResponse.json(
        { error: 'Could not load campaign delivery summaries' },
        { status: 500 },
      )
    const memberStats = new Map<
      string,
      {
        recipients: number
        delivered: number
        accepted: number
        bounced: number
        failed: number
        skipped: number
        queued: number
      }
    >()
    for (const row of memberDeliveries ?? []) {
      const stat = memberStats.get(row.campaign_id) ?? {
        recipients: 0,
        delivered: 0,
        accepted: 0,
        bounced: 0,
        failed: 0,
        skipped: 0,
        queued: 0,
      }
      stat.recipients++
      if (row.email_status === 'delivered') stat.delivered++
      if (row.email_status === 'sent') stat.accepted++
      if (row.email_status === 'bounced') stat.bounced++
      if (row.email_status === 'failed') stat.failed++
      if (row.email_status === 'pending') stat.queued++
      if (row.email_status === 'skipped') stat.skipped++
      memberStats.set(row.campaign_id, stat)
    }
    const waitlistStats = new Map<
      string,
      {
        recipients: number
        delivered: number
        accepted: number
        bounced: number
        failed: number
        skipped: number
        queued: number
      }
    >()
    for (const row of waitlistDeliveries ?? []) {
      const stat = waitlistStats.get(row.campaign_id) ?? {
        recipients: 0,
        delivered: 0,
        accepted: 0,
        bounced: 0,
        failed: 0,
        skipped: 0,
        queued: 0,
      }
      stat.recipients++
      if (row.status === 'delivered') stat.delivered++
      if (row.status === 'sent') stat.accepted++
      if (row.status === 'bounced') stat.bounced++
      if (row.status === 'failed') stat.failed++
      if (row.status === 'skipped') stat.skipped++
      waitlistStats.set(row.campaign_id, stat)
    }
    return NextResponse.json({
      campaigns: [
        ...(members ?? []).map((item) => ({
          ...item,
          audience: 'members',
          stats: memberStats.get(item.id) ?? {
            recipients: 0,
            delivered: 0,
            accepted: 0,
            bounced: 0,
            failed: 0,
            skipped: 0,
            queued: 0,
          },
        })),
        ...(waitlist ?? []).map((item) => ({
          ...item,
          audience: 'waitlist',
          stats: waitlistStats.get(item.id) ?? {
            recipients: 0,
            delivered: 0,
            accepted: 0,
            bounced: 0,
            failed: 0,
            skipped: 0,
            queued: 0,
          },
        })),
      ]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 40),
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not load campaign history' },
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
  const parsed = campaignSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Check the campaign fields and try again' },
      { status: 400 },
    )
  const input = parsed.data
  if (!input.sendEmail && !input.sendInApp)
    return NextResponse.json(
      { error: 'Choose at least one delivery channel' },
      { status: 400 },
    )
  if (input.targetGroup === 'selected' && !input.selectedUserIds.length)
    return NextResponse.json(
      { error: 'Select at least one member' },
      { status: 400 },
    )
  if (
    input.audience === 'waitlist' &&
    !input.selectedSubscriberIds.length &&
    input.action === 'schedule'
  ) {
    // An empty selection means all currently eligible waitlist subscribers.
  }
  if (input.action === 'schedule') {
    const scheduled = input.scheduleAt ? Date.parse(input.scheduleAt) : NaN
    if (!Number.isFinite(scheduled) || scheduled < Date.now() + 5 * 60 * 1000)
      return NextResponse.json(
        { error: 'Schedule the campaign at least five minutes in the future' },
        { status: 400 },
      )
  }
  if (
    input.audience === 'waitlist' &&
    (!process.env.RESEND_API_KEY ||
      !process.env.WAITLIST_FROM_EMAIL ||
      !process.env.NEXT_PUBLIC_APP_URL ||
      !process.env.MARKETING_SENDER_ADDRESS)
  )
    return NextResponse.json(
      { error: 'Waitlist email settings are incomplete' },
      { status: 503 },
    )
  if (
    input.audience === 'members' &&
    input.sendEmail &&
    (!process.env.RESEND_API_KEY || !process.env.ACCOUNT_UPDATES_FROM_EMAIL)
  )
    return NextResponse.json(
      { error: 'Member email settings are incomplete' },
      { status: 503 },
    )
  if (input.ctaUrl) {
    try {
      if (new URL(input.ctaUrl).protocol !== 'https:') throw new Error()
    } catch {
      return NextResponse.json(
        { error: 'CTA link must be a valid HTTPS URL' },
        { status: 400 },
      )
    }
  }

  const admin = createAdminClient()
  const status = input.action === 'schedule' ? 'scheduled' : 'draft'
  const scheduledAt = input.action === 'schedule' ? input.scheduleAt : null
  const audit = await beginAdminAudit({
    actorId: actor.id,
    action:
      input.action === 'draft'
        ? 'email.campaign_draft_saved'
        : 'email.campaign_scheduled',
    targetType: 'email_campaign',
    targetId: input.campaignKey,
    details: {
      audience: input.audience,
      target_group: input.targetGroup,
      has_selected_members: input.selectedUserIds.length > 0,
      has_selected_waitlist: input.selectedSubscriberIds.length > 0,
      has_cta: Boolean(input.ctaUrl),
    },
  }).catch(() => null)
  if (!audit)
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )

  let error: { message: string } | null = null
  if (input.audience === 'members') {
    const { data: existing } = await admin
      .from('admin_announcements')
      .select('campaign_status')
      .eq('campaign_key', input.campaignKey)
      .maybeSingle()
    if (
      existing &&
      !['draft', 'scheduled'].includes(existing.campaign_status)
    ) {
      await finishAdminAudit(
        audit.admin,
        audit.auditId,
        'failed',
        'Campaign already sent or in progress',
      )
      return NextResponse.json(
        { error: 'This campaign can no longer be edited' },
        { status: 409 },
      )
    }
    const result = await admin.from('admin_announcements').upsert(
      {
        campaign_key: input.campaignKey,
        campaign_name: input.name,
        subject: input.subject,
        message: input.message,
        send_email: input.sendEmail,
        send_in_app: input.sendInApp,
        created_by: actor.id,
        preview_text: input.previewText,
        email_heading: input.heading,
        cta_label: input.ctaLabel || null,
        cta_url: input.ctaUrl || null,
        campaign_status: status,
        scheduled_at: scheduledAt,
        target_group: input.targetGroup,
        selected_user_ids: input.selectedUserIds,
        next_after_user_id: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'campaign_key' },
    )
    error = result.error
  } else {
    const { data: existing } = await admin
      .from('waitlist_email_campaigns')
      .select('campaign_status')
      .eq('campaign_key', input.campaignKey)
      .maybeSingle()
    if (
      existing &&
      !['draft', 'scheduled'].includes(existing.campaign_status)
    ) {
      await finishAdminAudit(
        audit.admin,
        audit.auditId,
        'failed',
        'Campaign already sent or in progress',
      )
      return NextResponse.json(
        { error: 'This campaign can no longer be edited' },
        { status: 409 },
      )
    }
    const result = await admin.from('waitlist_email_campaigns').upsert(
      {
        campaign_key: input.campaignKey,
        kind: input.kind,
        campaign_name: input.name,
        subject: input.subject,
        message: input.message,
        preview_text: input.previewText,
        email_heading: input.heading,
        cta_label: input.ctaLabel || null,
        cta_url: input.ctaUrl || null,
        campaign_status: status,
        scheduled_at: scheduledAt,
        selected_subscriber_ids: input.selectedSubscriberIds,
        next_after_id: null,
        created_by: actor.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'campaign_key' },
    )
    error = result.error
  }

  await finishAdminAudit(
    audit.admin,
    audit.auditId,
    error ? 'failed' : 'succeeded',
    error?.message,
  )
  if (error)
    return NextResponse.json(
      { error: 'Could not save campaign' },
      { status: 500 },
    )
  return NextResponse.json({ ok: true, campaignKey: input.campaignKey, status })
}
