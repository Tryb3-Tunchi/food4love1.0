import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronRequest } from '@/lib/cron/auth'
import { drainInterestEmails } from '@/lib/notifications/interestEmails'
import { drainReferralRewardEmails } from '@/lib/email/referralRewards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Room for a few batches of sends; the worker also stops itself at ~40 s.
export const maxDuration = 60

// The scheduled worker for "your cook is verified" emails.
//
// WHY THIS EXISTS: the database trigger queues one email per interested customer the moment
// a cook becomes verified, by ANY route (admin approval, a manual SQL update, a future
// automated check). Without this endpoint the queue only drained when an admin happened to
// approve someone or press "retry". A scheduler (Vercel Cron, GitHub Actions, a Supabase
// pg_cron job) calls this on a timer so queued, failed and abandoned sends always get picked
// up. See the handover for how to schedule it; NOTHING is scheduled by this file.
//
// SECURITY: there is no browser session here. The caller proves itself with
// `Authorization: Bearer $CRON_SECRET` (what Vercel sends on its own when CRON_SECRET is set).
// No secret configured means the endpoint refuses everyone. It uses the server-side admin
// client internally; nothing about it is ever returned (counts only, no addresses, no ids).
//
// SAFETY OF RUNNING IT TOO OFTEN OR TWICE AT ONCE: every row is claimed with a
// compare-and-swap before sending and every send carries an idempotency key, so overlapping
// runs, a double trigger, or a run that is cut off cannot send anyone a second email.
async function handle(request: Request) {
  const noStore = { 'Cache-Control': 'no-store' }

  const auth = verifyCronRequest(
    request.headers.get('authorization'),
    process.env.CRON_SECRET,
  )
  if (auth === 'not_configured') {
    return NextResponse.json(
      { error: 'Scheduled processing is not configured' },
      { status: 503, headers: noStore },
    )
  }
  if (auth !== 'ok') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: noStore },
    )
  }

  // Links in these emails must point at the real site. The request's own address is not
  // trusted for that (a scheduler may call a preview or internal address), so a configured
  // site address is required here, unlike the admin-triggered paths.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (!appUrl) {
    return NextResponse.json(
      { error: 'NEXT_PUBLIC_APP_URL is not configured' },
      { status: 503, headers: noStore },
    )
  }

  try {
    const admin = createAdminClient()
    const [interestEmails, referralRewards] = await Promise.all([
      drainInterestEmails(admin, { appUrl }),
      drainReferralRewardEmails(admin, { appUrl }),
    ])
    return NextResponse.json(
      {
        ok: true,
        ...interestEmails,
        referral_rewards: referralRewards,
      },
      { headers: noStore },
    )
  } catch {
    // Details stay in the server log; the caller only learns that this run failed.
    console.error('Scheduled notification processing failed')
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500, headers: noStore },
    )
  }
}

// Vercel Cron calls with GET; pg_net / curl / Actions commonly use POST. Both need the secret.
export const GET = handle
export const POST = handle
