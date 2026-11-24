import { NextResponse } from 'next/server'
import { z } from 'zod'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { getAdminUser } from '@/lib/admin/auth'
import { adminCampaignEmail } from '@/lib/email/templates'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronRequest } from '@/lib/cron/auth'

export const runtime = 'nodejs'

const announcementSchema = z.object({
  campaignKey: z.string().uuid(),
  subject: z.string().trim().min(2).max(120),
  message: z.string().trim().min(1).max(5000),
  sendEmail: z.boolean(),
  sendInApp: z.boolean(),
  afterUserId: z.string().uuid().optional(),
  campaignName: z.string().trim().min(2).max(100).optional(),
  previewText: z.string().max(180).default(''),
  heading: z.string().max(140).default(''),
  ctaLabel: z.string().max(40).default(''),
  ctaUrl: z.string().max(500).default(''),
  targetGroup: z
    .enum(['all', 'buyers', 'cooks', 'testers', 'selected'])
    .default('all'),
  selectedUserIds: z.array(z.string().uuid()).max(500).default([]),
})

export async function GET() {
  const actor = await getAdminUser('messages:manage')
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const admin = createAdminClient()
    const activeFilter = 'suspended.is.null,suspended.eq.false'
    const [activeResult, emailResult] = await Promise.all([
      admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .in('role', ['buyer', 'cook'])
        .or(activeFilter),
      admin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .in('role', ['buyer', 'cook'])
        .or(activeFilter)
        .eq('email_updates_consent', true),
    ])

    if (activeResult.error || emailResult.error) {
      return NextResponse.json(
        { error: 'Could not load announcement audience' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      active_members: activeResult.count ?? 0,
      email_opted_in_members: emailResult.count ?? 0,
      email_configured: Boolean(
        process.env.RESEND_API_KEY && process.env.ACCOUNT_UPDATES_FROM_EMAIL,
      ),
      email_sender: process.env.ACCOUNT_UPDATES_FROM_EMAIL ?? null,
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not load announcement audience' },
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

  const parsed = announcementSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsed.success || (!parsed.data.sendEmail && !parsed.data.sendInApp)) {
    return NextResponse.json(
      { error: 'Choose at least one delivery channel and enter valid content' },
      { status: 400 },
    )
  }
  if (
    parsed.data.targetGroup === 'selected' &&
    !parsed.data.selectedUserIds.length
  ) {
    return NextResponse.json(
      { error: 'Select at least one member' },
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

  if (
    parsed.data.sendEmail &&
    (!process.env.RESEND_API_KEY || !process.env.ACCOUNT_UPDATES_FROM_EMAIL)
  ) {
    return NextResponse.json(
      { error: 'Account email delivery is not configured' },
      { status: 503 },
    )
  }

  const input = parsed.data
  const admin = createAdminClient()
  let actorId = actor?.id
  if (isCron) {
    const { data: scheduled } = await admin
      .from('admin_announcements')
      .select('created_by, campaign_status, scheduled_at, next_after_user_id')
      .eq('campaign_key', input.campaignKey)
      .maybeSingle()
    if (
      !scheduled ||
      scheduled.campaign_status !== 'scheduled' ||
      !scheduled.scheduled_at ||
      Date.parse(scheduled.scheduled_at) > Date.now() ||
      input.afterUserId !== (scheduled.next_after_user_id ?? undefined) ||
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
  const { error: createError } = await admin.from('admin_announcements').upsert(
    {
      campaign_key: input.campaignKey,
      subject: input.subject,
      message: input.message,
      campaign_name: input.campaignName ?? 'Member update',
      send_email: input.sendEmail,
      send_in_app: input.sendInApp,
      created_by: actorId,
      preview_text: input.previewText,
      email_heading: input.heading,
      cta_label: input.ctaLabel || null,
      cta_url: input.ctaUrl || null,
      campaign_status: 'sending',
      target_group: input.targetGroup,
      selected_user_ids: input.selectedUserIds,
      scheduled_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'campaign_key', ignoreDuplicates: true },
  )

  if (createError) {
    return NextResponse.json(
      { error: 'Could not prepare announcement' },
      { status: 500 },
    )
  }

  const { data: campaign, error: campaignError } = await admin
    .from('admin_announcements')
    .select(
      'id, subject, message, send_email, send_in_app, campaign_name, preview_text, email_heading, cta_label, cta_url, target_group, selected_user_ids, campaign_status',
    )
    .eq('campaign_key', input.campaignKey)
    .single()

  if (!campaign || campaignError) {
    return NextResponse.json(
      { error: 'Could not load announcement' },
      { status: 500 },
    )
  }

  const campaignContentChanged =
    campaign.subject !== input.subject ||
    campaign.message !== input.message ||
    campaign.send_email !== input.sendEmail ||
    campaign.send_in_app !== input.sendInApp ||
    campaign.target_group !== input.targetGroup ||
    JSON.stringify(campaign.selected_user_ids ?? []) !==
      JSON.stringify(input.selectedUserIds) ||
    campaign.campaign_name !== (input.campaignName ?? 'Member update') ||
    campaign.preview_text !== input.previewText ||
    campaign.email_heading !== input.heading ||
    campaign.cta_label !== (input.ctaLabel || null) ||
    campaign.cta_url !== (input.ctaUrl || null)
  if (campaignContentChanged && actor && campaign.campaign_status === 'draft') {
    const { error: updateDraftError } = await admin
      .from('admin_announcements')
      .update({
        campaign_name: input.campaignName ?? 'Member update',
        subject: input.subject,
        message: input.message,
        send_email: input.sendEmail,
        send_in_app: input.sendInApp,
        preview_text: input.previewText,
        email_heading: input.heading,
        cta_label: input.ctaLabel || null,
        cta_url: input.ctaUrl || null,
        target_group: input.targetGroup,
        selected_user_ids: input.selectedUserIds,
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
      campaign_name: input.campaignName ?? 'Member update',
      subject: input.subject,
      message: input.message,
      send_email: input.sendEmail,
      send_in_app: input.sendInApp,
      preview_text: input.previewText,
      email_heading: input.heading,
      cta_label: input.ctaLabel || null,
      cta_url: input.ctaUrl || null,
      target_group: input.targetGroup,
      selected_user_ids: input.selectedUserIds,
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
      action: 'admin.announcement_batch',
      targetType: 'admin_announcement',
      targetId: campaign.id,
      details: {
        email_requested: input.sendEmail,
        in_app_requested: input.sendInApp,
        target_group: input.targetGroup,
        selected_count: input.selectedUserIds.length,
        has_after_user_id: Boolean(input.afterUserId),
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )
  }

  let testerIds: string[] | null = null
  if (input.targetGroup === 'testers') {
    const { data: testerRows, error: testerError } = await admin
      .from('tester_invitations')
      .select('auth_user_id')
      .eq('status', 'accepted')
      .not('auth_user_id', 'is', null)
      .limit(1000)
    if (testerError) {
      await finishAdminAudit(
        audit.admin,
        audit.auditId,
        'failed',
        'Tester audience query failed',
      )
      return NextResponse.json(
        { error: 'Could not load tester audience' },
        { status: 500 },
      )
    }
    testerIds = Array.from(
      new Set(
        (testerRows ?? [])
          .map((item) => item.auth_user_id)
          .filter((id): id is string => Boolean(id)),
      ),
    )
    if (!testerIds.length)
      return NextResponse.json({
        attempted: 0,
        email_sent: 0,
        email_skipped: 0,
        email_failed: 0,
        in_app_sent: 0,
        in_app_failed: 0,
        hasMore: false,
        nextAfterUserId: null,
      })
  }

  let profileQuery = admin
    .from('profiles')
    .select('id, full_name, role, email_updates_consent')
    .in('role', ['buyer', 'cook'])
    .or('suspended.is.null,suspended.eq.false')
    .order('id', { ascending: true })
    .limit(25)

  if (input.targetGroup === 'buyers')
    profileQuery = profileQuery.eq('role', 'buyer')
  if (input.targetGroup === 'cooks')
    profileQuery = profileQuery.eq('role', 'cook')
  if (testerIds) profileQuery = profileQuery.in('id', testerIds)
  if (input.targetGroup === 'selected')
    profileQuery = profileQuery.in('id', input.selectedUserIds)

  if (input.afterUserId) profileQuery = profileQuery.gt('id', input.afterUserId)
  if (input.sendEmail && !input.sendInApp)
    profileQuery = profileQuery.eq('email_updates_consent', true)

  const { data: profiles, error: profilesError } = await profileQuery
  if (profilesError) {
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      'failed',
      'Audience query failed',
    )
    return NextResponse.json(
      { error: 'Could not load announcement audience' },
      { status: 500 },
    )
  }

  const currentProfiles = profiles ?? []
  if (currentProfiles.length) {
    const initialDeliveries = currentProfiles.map((profile) => ({
      campaign_id: campaign.id,
      user_id: profile.id,
      email_status: input.sendEmail
        ? profile.email_updates_consent
          ? 'pending'
          : 'skipped'
        : 'not_requested',
      in_app_status: input.sendInApp ? 'pending' : 'not_requested',
    }))
    const { error: deliveryInitError } = await admin
      .from('admin_announcement_deliveries')
      .upsert(initialDeliveries, {
        onConflict: 'campaign_id,user_id',
        ignoreDuplicates: true,
      })
    if (deliveryInitError) {
      await finishAdminAudit(
        audit.admin,
        audit.auditId,
        'failed',
        'Delivery tracking unavailable',
      )
      return NextResponse.json(
        { error: 'Could not prepare announcement deliveries' },
        { status: 500 },
      )
    }
  }

  let emailSent = 0
  let emailSkipped = 0
  let emailFailed = 0
  let inAppSent = 0
  let inAppFailed = 0

  for (const profile of currentProfiles) {
    const { data: delivery, error: deliveryError } = await admin
      .from('admin_announcement_deliveries')
      .select('email_status, in_app_status')
      .eq('campaign_id', campaign.id)
      .eq('user_id', profile.id)
      .single()
    if (deliveryError || !delivery) {
      emailFailed += input.sendEmail ? 1 : 0
      inAppFailed += input.sendInApp ? 1 : 0
      continue
    }

    if (input.sendInApp && delivery.in_app_status !== 'sent') {
      const { error } = await admin.from('notifications').upsert(
        {
          user_id: profile.id,
          type: 'system',
          title: input.subject,
          body: input.message,
          data: { route: '/notifications', admin_announcement_id: campaign.id },
          read: false,
          admin_announcement_id: campaign.id,
        },
        { onConflict: 'user_id,admin_announcement_id', ignoreDuplicates: true },
      )
      if (error) {
        inAppFailed += 1
        await admin
          .from('admin_announcement_deliveries')
          .update({
            in_app_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('campaign_id', campaign.id)
          .eq('user_id', profile.id)
      } else {
        inAppSent += 1
        await admin
          .from('admin_announcement_deliveries')
          .update({
            in_app_status: 'sent',
            updated_at: new Date().toISOString(),
          })
          .eq('campaign_id', campaign.id)
          .eq('user_id', profile.id)
      }
    }

    if (
      !input.sendEmail ||
      ['sent', 'delivered', 'bounced', 'skipped'].includes(
        delivery.email_status,
      )
    )
      continue
    if (!profile.email_updates_consent) {
      emailSkipped += 1
      await admin
        .from('admin_announcement_deliveries')
        .update({
          email_status: 'skipped',
          updated_at: new Date().toISOString(),
        })
        .eq('campaign_id', campaign.id)
        .eq('user_id', profile.id)
      continue
    }

    const [{ data: latestProfile }, { data: authResult, error: authError }] =
      await Promise.all([
        admin
          .from('profiles')
          .select('email_updates_consent, full_name')
          .eq('id', profile.id)
          .maybeSingle(),
        admin.auth.admin.getUserById(profile.id),
      ])
    if (!latestProfile?.email_updates_consent) {
      emailSkipped += 1
      await admin
        .from('admin_announcement_deliveries')
        .update({
          email_status: 'skipped',
          updated_at: new Date().toISOString(),
        })
        .eq('campaign_id', campaign.id)
        .eq('user_id', profile.id)
      continue
    }
    if (
      authError ||
      !authResult.user?.email ||
      !authResult.user.email_confirmed_at
    ) {
      emailSkipped += 1
      await admin
        .from('admin_announcement_deliveries')
        .update({
          email_status: 'skipped',
          email_error: 'No confirmed email address',
          updated_at: new Date().toISOString(),
        })
        .eq('campaign_id', campaign.id)
        .eq('user_id', profile.id)
      continue
    }

    const { error: tokenUpsertError } = await admin
      .from('admin_email_unsubscribe_tokens')
      .upsert(
        { user_id: profile.id },
        { onConflict: 'user_id', ignoreDuplicates: true },
      )
    const { data: unsubscribeToken, error: tokenError } = await admin
      .from('admin_email_unsubscribe_tokens')
      .select('token')
      .eq('user_id', profile.id)
      .single()
    if (tokenUpsertError || tokenError || !unsubscribeToken) {
      emailFailed += 1
      await admin
        .from('admin_announcement_deliveries')
        .update({
          email_status: 'failed',
          email_error: 'Unsubscribe token unavailable',
          updated_at: new Date().toISOString(),
        })
        .eq('campaign_id', campaign.id)
        .eq('user_id', profile.id)
      continue
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
    if (!appUrl) {
      emailFailed += 1
      continue
    }
    const unsubscribeUrl = `${appUrl}/api/email/unsubscribe?token=${encodeURIComponent(unsubscribeToken.token)}`
    const email = adminCampaignEmail({
      subject: campaign.subject,
      message: campaign.message,
      name: latestProfile.full_name ?? '',
      accountType: profile.role === 'cook' ? 'cook' : 'customer',
      email: authResult.user.email,
      previewText: campaign.preview_text ?? '',
      heading: campaign.email_heading ?? '',
      ctaLabel: campaign.cta_label,
      ctaUrl: campaign.cta_url,
      unsubscribeUrl,
    })

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `${input.campaignKey}:${profile.id}`,
        },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          from: process.env.ACCOUNT_UPDATES_FROM_EMAIL,
          to: [authResult.user.email],
          subject: email.subject,
          text: email.text,
          html: email.html,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
      })
      const responseBody = (await response.json().catch(() => ({}))) as {
        id?: string
      }
      if (!response.ok) {
        emailFailed += 1
        await admin
          .from('admin_announcement_deliveries')
          .update({
            email_status: 'failed',
            email_error: `Email provider returned ${response.status}`,
            updated_at: new Date().toISOString(),
          })
          .eq('campaign_id', campaign.id)
          .eq('user_id', profile.id)
        continue
      }

      emailSent += 1
      await admin
        .from('admin_announcement_deliveries')
        .update({
          email_status: 'sent',
          email_provider_message_id: responseBody.id ?? null,
          email_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('campaign_id', campaign.id)
        .eq('user_id', profile.id)
    } catch {
      emailFailed += 1
      await admin
        .from('admin_announcement_deliveries')
        .update({
          email_status: 'failed',
          email_error: 'Email provider request failed',
          updated_at: new Date().toISOString(),
        })
        .eq('campaign_id', campaign.id)
        .eq('user_id', profile.id)
    }
  }

  const hasMore = currentProfiles.length === 25
  const outcomeFailed = emailFailed > 0 || inAppFailed > 0
  await finishAdminAudit(
    audit.admin,
    audit.auditId,
    outcomeFailed ? 'failed' : 'succeeded',
    outcomeFailed ? 'One or more announcement deliveries failed' : undefined,
  )

  await admin
    .from('admin_announcements')
    .update({
      campaign_status: hasMore
        ? isCron
          ? 'scheduled'
          : 'sending'
        : outcomeFailed
          ? 'failed'
          : 'completed',
      next_after_user_id: hasMore ? currentProfiles.at(-1)?.id : null,
      scheduled_at: hasMore && isCron ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id)

  return NextResponse.json({
    campaignKey: input.campaignKey,
    attempted: currentProfiles.length,
    email_sent: emailSent,
    email_skipped: emailSkipped,
    email_failed: emailFailed,
    in_app_sent: inAppSent,
    in_app_failed: inAppFailed,
    hasMore,
    nextAfterUserId: hasMore ? currentProfiles.at(-1)?.id : null,
  })
}
