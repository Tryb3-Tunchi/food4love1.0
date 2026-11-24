import { NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/cron/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  const auth = verifyCronRequest(
    request.headers.get('authorization'),
    process.env.CRON_SECRET,
  )
  if (auth === 'not_configured')
    return NextResponse.json(
      { error: 'Scheduled processing is not configured' },
      { status: 503, headers },
    )
  if (auth !== 'ok')
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers },
    )
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (!appUrl)
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_APP_URL is not configured' },
      { status: 503, headers },
    )
  const secret = process.env.CRON_SECRET
  if (!secret)
    return NextResponse.json(
      { error: 'Scheduled processing is not configured' },
      { status: 503, headers },
    )

  try {
    const admin = createAdminClient()
    const now = new Date().toISOString()
    const [memberResult, waitlistResult] = await Promise.all([
      admin
        .from('admin_announcements')
        .select(
          'campaign_key, campaign_name, subject, message, send_email, send_in_app, preview_text, email_heading, cta_label, cta_url, target_group, selected_user_ids, next_after_user_id',
        )
        .eq('campaign_status', 'scheduled')
        .lte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(10),
      admin
        .from('waitlist_email_campaigns')
        .select(
          'campaign_key, campaign_name, kind, subject, message, preview_text, email_heading, cta_label, cta_url, selected_subscriber_ids, next_after_id',
        )
        .eq('campaign_status', 'scheduled')
        .lte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(10),
    ])
    if (memberResult.error || waitlistResult.error)
      return NextResponse.json(
        { error: 'Could not load scheduled campaigns' },
        { status: 500, headers },
      )

    let processed = 0
    let failed = 0
    const sendOne = async (path: string, payload: Record<string, unknown>) => {
      const response = await fetch(`${appUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(50000),
      })
      if (!response.ok) {
        failed++
        return
      }
      processed++
    }

    for (const campaign of memberResult.data ?? []) {
      await sendOne('/api/admin/announcements', {
        campaignKey: campaign.campaign_key,
        campaignName: campaign.campaign_name ?? 'Member update',
        subject: campaign.subject,
        message: campaign.message,
        sendEmail: campaign.send_email,
        sendInApp: campaign.send_in_app,
        previewText: campaign.preview_text ?? '',
        heading: campaign.email_heading ?? '',
        ctaLabel: campaign.cta_label ?? '',
        ctaUrl: campaign.cta_url ?? '',
        targetGroup: campaign.target_group,
        selectedUserIds: campaign.selected_user_ids ?? [],
        ...(campaign.next_after_user_id
          ? { afterUserId: campaign.next_after_user_id }
          : {}),
      })
    }
    for (const campaign of waitlistResult.data ?? []) {
      await sendOne('/api/waitlist/campaigns', {
        campaignKey: campaign.campaign_key,
        campaignName: campaign.campaign_name ?? 'Waitlist update',
        kind: campaign.kind,
        subject: campaign.subject,
        message: campaign.message,
        previewText: campaign.preview_text ?? '',
        heading: campaign.email_heading ?? '',
        ctaLabel: campaign.cta_label ?? '',
        ctaUrl: campaign.cta_url ?? '',
        selectedIds: campaign.selected_subscriber_ids ?? [],
        ...(campaign.next_after_id ? { afterId: campaign.next_after_id } : {}),
      })
    }
    return NextResponse.json(
      { ok: true, campaigns_processed: processed, campaigns_failed: failed },
      { headers },
    )
  } catch {
    console.error('Scheduled email campaign processing failed')
    return NextResponse.json(
      { error: 'Scheduled campaign processing failed' },
      { status: 500, headers },
    )
  }
}

export const GET = handle
export const POST = handle
