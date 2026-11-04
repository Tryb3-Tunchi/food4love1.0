import { NextResponse } from 'next/server'
import { z } from 'zod'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { getAdminUser } from '@/lib/admin/auth'
import { adminAnnouncementEmail } from '@/lib/email/templates'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const announcementSchema = z.object({
  campaignKey: z.string().uuid(),
  subject: z.string().trim().min(2).max(120),
  message: z.string().trim().min(1).max(5000),
  sendEmail: z.boolean(),
  sendInApp: z.boolean(),
  afterUserId: z.string().uuid().optional(),
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
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
  const { error: createError } = await admin.from('admin_announcements').upsert(
    {
      campaign_key: input.campaignKey,
      subject: input.subject,
      message: input.message,
      send_email: input.sendEmail,
      send_in_app: input.sendInApp,
      created_by: actor.id,
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
    .select('id, subject, message, send_email, send_in_app')
    .eq('campaign_key', input.campaignKey)
    .single()

  if (!campaign || campaignError) {
    return NextResponse.json(
      { error: 'Could not load announcement' },
      { status: 500 },
    )
  }

  if (
    campaign.subject !== input.subject ||
    campaign.message !== input.message ||
    campaign.send_email !== input.sendEmail ||
    campaign.send_in_app !== input.sendInApp
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
      action: 'admin.announcement_batch',
      targetType: 'admin_announcement',
      targetId: campaign.id,
      details: {
        email_requested: input.sendEmail,
        in_app_requested: input.sendInApp,
        has_after_user_id: Boolean(input.afterUserId),
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )
  }

  let profileQuery = admin
    .from('profiles')
    .select('id, full_name, email_updates_consent')
    .in('role', ['buyer', 'cook'])
    .or('suspended.is.null,suspended.eq.false')
    .order('id', { ascending: true })
    .limit(25)

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

    if (!input.sendEmail || delivery.email_status === 'sent') continue
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
    const email = adminAnnouncementEmail({
      subject: campaign.subject,
      message: campaign.message,
      name: latestProfile.full_name ?? '',
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
