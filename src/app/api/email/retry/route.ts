import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createLimiter } from '@/lib/rateLimit'
import { getAdminUser } from '@/lib/admin/auth'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { welcomeEmail, waitlistSignupEmail } from '@/lib/email/templates'
import { MAX_ATTEMPTS, sendTransactionalEmail } from '@/lib/email/transactional'

export const runtime = 'nodejs'

// A brake on repeated clicks. Sends are idempotent, so this is not what prevents
// duplicates; it just stops an accidental flood. Per server instance.
const allow = createLimiter({ limit: 6, windowMs: 10 * 60 * 1000 })

// Retries transactional emails that Resend did not accept (provider outage, rate
// limit, timeout). Admin only. Safe to call repeatedly: every send carries an
// idempotency key and rows that were already accepted are skipped.
export async function POST(request: Request) {
  const actor =
    (await getAdminUser('email:manage')) ??
    (await getAdminUser('messages:manage'))
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!allow(actor.id)) {
    return NextResponse.json(
      { error: 'Too many retries. Please wait a few minutes.' },
      { status: 429 },
    )
  }

  // Sending email is a sensitive action: record it before doing anything.
  const audit = await beginAdminAudit({
    actorId: actor.id,
    action: 'email.retry_failed',
    targetType: 'email_delivery_batch',
    targetId: actor.id,
    details: { max_batch: 25 },
  }).catch(() => null)
  if (!audit) {
    return NextResponse.json(
      { error: 'Admin audit logging is unavailable' },
      { status: 503 },
    )
  }

  try {
    const admin = createAdminClient()
    const origin = new URL(request.url).origin
    // Leave rows alone for two minutes so an in-flight send is never raced.
    const settledBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString()

    const { data: rows, error } = await admin
      .from('email_deliveries')
      .select('kind, recipient_key')
      .in('status', ['failed', 'queued'])
      .lt('attempts', MAX_ATTEMPTS)
      .lt('updated_at', settledBefore)
      .order('updated_at', { ascending: true })
      .limit(25)

    if (error) {
      await finishAdminAudit(
        audit.admin,
        audit.auditId,
        'failed',
        'Could not read email delivery records',
      ).catch(() => undefined)
      return NextResponse.json(
        { error: 'Could not read email delivery records' },
        { status: 500 },
      )
    }

    let accepted = 0
    let failed = 0
    for (const row of rows ?? []) {
      if (row.kind === 'welcome') {
        const { data } = await admin.auth.admin.getUserById(row.recipient_key)
        const user = data?.user
        if (!user?.email) continue
        const { data: profile } = await admin
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .maybeSingle()
        const result = await sendTransactionalEmail({
          admin,
          kind: 'welcome',
          recipientKey: user.id,
          to: user.email,
          email: welcomeEmail({
            name: profile?.full_name ?? null,
            role: profile?.role ?? null,
            appUrl: origin,
          }),
        })
        if (result === 'accepted' || result === 'already_accepted') accepted++
        else failed++
      } else if (row.kind === 'waitlist_confirmation') {
        const { data: subscriber } = await admin
          .from('waitlist_subscribers')
          .select('id, email, audience')
          .eq('id', row.recipient_key)
          .maybeSingle()
        if (!subscriber) continue
        const result = await sendTransactionalEmail({
          admin,
          kind: 'waitlist_confirmation',
          recipientKey: subscriber.id,
          to: subscriber.email,
          email: waitlistSignupEmail(),
        })
        if (result === 'accepted' || result === 'already_accepted') {
          accepted++
          await admin
            .from('waitlist_subscribers')
            .update({ confirmation_sent_at: new Date().toISOString() })
            .eq('id', subscriber.id)
            .is('confirmation_sent_at', null)
        } else {
          failed++
        }
      }
    }

    await finishAdminAudit(audit.admin, audit.auditId, 'succeeded').catch(
      () => undefined,
    )
    return NextResponse.json({
      checked: rows?.length ?? 0,
      accepted_by_provider: accepted,
      still_failing: failed,
    })
  } catch {
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      'failed',
      'Retry failed',
    ).catch(() => undefined)
    return NextResponse.json({ error: 'Retry failed' }, { status: 500 })
  }
}
