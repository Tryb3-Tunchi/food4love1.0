import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { interestVerifiedEmail } from '@/lib/email/templates'
import { isRetryDue, retryDelayMs } from '@/lib/email/retryPolicy'
import { MAX_ATTEMPTS, sendTransactionalEmail } from '@/lib/email/transactional'
import { decideInterestEmail } from '@/lib/notifications/interestRules'
import { reconcileMissedInterestEmails } from '@/lib/notifications/reconcile'

type Admin = ReturnType<typeof createAdminClient>

// "Your cook is verified" emails.
//
// The database trigger (supabase-migration-interest-verification-email.sql) writes the
// in-app notification and QUEUES one email_deliveries row per customer who asked to be
// told. This module is the worker that turns queued rows into emails. It can be called
// right after an admin approves a cook, from the admin "retry failed email" button, or by
// a scheduled job: every path goes through the same claim-then-send steps, so two of them
// running at once cannot send the same email twice.

const KIND = 'interest_verified'
// A claim older than this belongs to a worker that died (server restart, timeout) and is
// taken over, so a crash can never strand an email in "processing".
const STALE_CLAIM_MS = 10 * 60 * 1000

export interface ProcessSummary {
  checked: number
  sent: number
  cancelled: number
  failed: number
  notConfigured: number
  // verification emails the database outbox had missed, queued by reconciliation this run
  reconciled: number
}

interface DeliveryRow {
  id: string
  recipient_key: string
  status: 'queued' | 'failed' | 'processing'
  attempts: number
  next_attempt_at: string | null
  updated_at: string
  created_at: string
}

export async function processInterestEmails(
  admin: Admin,
  options: {
    appUrl: string
    cookId?: string
    limit?: number
    // Also queue verification emails the database outbox missed (see reconcile.ts). For scheduled
    // runs and the admin retry button, not for the per-cook call right after an approval.
    reconcile?: boolean
  },
): Promise<ProcessSummary> {
  const summary: ProcessSummary = {
    checked: 0,
    sent: 0,
    cancelled: 0,
    failed: 0,
    notConfigured: 0,
    reconciled: 0,
  }
  const limit = Math.min(options.limit ?? 25, 50)

  // Recovery first, so what it queues is picked up by this same run. Never allowed to break sending.
  if (options.reconcile && !options.cookId) {
    try {
      summary.reconciled = (await reconcileMissedInterestEmails(admin)).queued
    } catch {
      // reconciliation is best effort; the next run tries again
    }
  }

  // Narrow to one cook's interests when called straight after that cook was approved.
  let interestIds: string[] | null = null
  if (options.cookId) {
    const { data } = await admin
      .from('booking_interests')
      .select('id')
      .eq('cook_id', options.cookId)
      .eq('status', 'fulfilled')
    interestIds = (data ?? []).map((row) => row.id as string)
    if (interestIds.length === 0) return summary
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS).toISOString()

  // Which rows are ours to work on is decided IN THE DATABASE, one query per state, so a pile
  // of rows that are not due (waiting for their retry time, or given up on after a permanent
  // failure) can never fill the batch and starve the emails that are ready.
  const select = () => {
    let q = admin
      .from('email_deliveries')
      .select(
        'id, recipient_key, status, attempts, next_attempt_at, updated_at, created_at',
      )
      .eq('kind', KIND)
      .lt('attempts', MAX_ATTEMPTS)
    if (interestIds) q = q.in('recipient_key', interestIds)
    return q
  }
  const oldestFirst = { ascending: true }
  const [queued, retryable, abandoned] = await Promise.all([
    // new, or put back untouched while email was not configured
    select()
      .eq('status', 'queued')
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
      .order('created_at', oldestFirst)
      .limit(limit),
    // failed, and its retry time has come (a failed row with NO time is finished)
    select()
      .eq('status', 'failed')
      .lte('next_attempt_at', nowIso)
      .order('created_at', oldestFirst)
      .limit(limit),
    // claimed by a worker that went quiet (crash, timeout, restart)
    select()
      .eq('status', 'processing')
      .lt('updated_at', staleBefore)
      .order('created_at', oldestFirst)
      .limit(limit),
  ])
  // Nothing to do (or the migration is not applied yet, so nothing could have been queued).
  if (queued.error || retryable.error || abandoned.error) return summary

  const rows = [
    ...(queued.data ?? []),
    ...(retryable.data ?? []),
    ...(abandoned.data ?? []),
  ] as unknown as DeliveryRow[]
  rows.sort((a, b) => a.created_at.localeCompare(b.created_at))

  for (const row of rows.slice(0, limit)) {
    // Belt and braces: the queries already chose these, but the row may have changed since.
    if (
      row.status === 'processing' &&
      Date.parse(row.updated_at) >= Date.parse(staleBefore)
    )
      continue
    if (row.status !== 'processing' && !isRetryDue(row, now)) continue
    summary.checked++

    // CLAIM: the update only matches if nobody else changed the row first. Whoever gets a
    // row back owns the send; everyone else skips it.
    let claim = admin
      .from('email_deliveries')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', row.status)
    if (row.status === 'processing') claim = claim.lt('updated_at', staleBefore)
    const { data: claimed } = await claim.select('id').maybeSingle()
    if (!claimed) {
      summary.checked--
      continue
    }

    try {
      await processOne(admin, row, options.appUrl, summary)
    } catch {
      // Never leave a claimed row looking busy. It goes back to failed with a retry time.
      await admin
        .from('email_deliveries')
        .update({
          status: 'failed',
          last_error_code: 'processing_error',
          attempts: row.attempts + 1,
          next_attempt_at: nextAttemptIso(row.attempts + 1),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      summary.failed++
    }
  }
  return summary
}

// Keeps going in small batches until there is nothing ready, the time budget is used, or a
// batch makes no progress (for example email is not configured, so rows are put straight
// back). This is what a scheduled run calls. Several runs overlapping is safe: the claim
// inside processInterestEmails means each row is worked on by exactly one of them.
export async function drainInterestEmails(
  admin: Admin,
  options: { appUrl: string; budgetMs?: number; maxBatches?: number },
): Promise<ProcessSummary & { batches: number }> {
  const total = {
    checked: 0,
    sent: 0,
    cancelled: 0,
    failed: 0,
    notConfigured: 0,
    reconciled: 0,
    batches: 0,
  }
  const deadline = Date.now() + (options.budgetMs ?? 40_000)
  const maxBatches = options.maxBatches ?? 10
  while (total.batches < maxBatches && Date.now() < deadline) {
    const batch = await processInterestEmails(admin, {
      appUrl: options.appUrl,
      limit: 25,
      // once per run: the first batch only
      reconcile: total.batches === 0,
    })
    total.batches++
    total.checked += batch.checked
    total.sent += batch.sent
    total.cancelled += batch.cancelled
    total.failed += batch.failed
    total.notConfigured += batch.notConfigured
    total.reconciled += batch.reconciled
    if (batch.sent + batch.cancelled + batch.failed === 0) break
  }
  return total
}

function nextAttemptIso(attemptsMade: number): string | null {
  const delay = retryDelayMs(attemptsMade, { errorCode: 'processing_error' })
  return delay === null ? null : new Date(Date.now() + delay).toISOString()
}

async function cancel(admin: Admin, id: string, reason: string) {
  await admin
    .from('email_deliveries')
    .update({
      status: 'cancelled',
      last_error_code: reason,
      next_attempt_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

async function processOne(
  admin: Admin,
  row: DeliveryRow,
  appUrl: string,
  summary: ProcessSummary,
) {
  // Decide from the facts as they are NOW, not as they were when the cook was approved.
  const { data: interest } = await admin
    .from('booking_interests')
    .select('id, customer_id, cook_id, notify_when_verified')
    .eq('id', row.recipient_key)
    .maybeSingle()

  if (!interest) {
    await cancel(admin, row.id, 'no_interest')
    summary.cancelled++
    return
  }

  const [{ data: cook }, { data: customer }, { data: authUser }] =
    await Promise.all([
      admin
        .from('profiles')
        .select('full_name, role, kyc_status, suspended')
        .eq('id', interest.cook_id)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('full_name, role, suspended, notification_preferences')
        .eq('id', interest.customer_id)
        .maybeSingle(),
      admin.auth.admin.getUserById(interest.customer_id as string),
    ])

  const decision = decideInterestEmail({
    interest: { notify_when_verified: !!interest.notify_when_verified },
    cook,
    customer: customer as Parameters<typeof decideInterestEmail>[0]['customer'],
    email: {
      address: authUser?.user?.email ?? null,
      confirmed: !!authUser?.user?.email_confirmed_at,
    },
  })
  if (!decision.send) {
    await cancel(admin, row.id, decision.reason)
    summary.cancelled++
    return
  }

  const result = await sendTransactionalEmail({
    admin,
    kind: KIND,
    recipientKey: row.recipient_key,
    to: authUser!.user!.email!,
    email: interestVerifiedEmail({
      customerName: customer?.full_name ?? null,
      cookName: cook?.full_name ?? 'Your cook',
      profileUrl: `${appUrl}/cook/${interest.cook_id}`,
    }),
    scheduleRetry: (attemptsMade, failure) =>
      retryDelayMs(attemptsMade, failure),
  })

  if (result === 'accepted' || result === 'already_accepted') {
    summary.sent++
  } else if (result === 'unavailable') {
    // Resend (or a sender address) is not configured. That is not a failed attempt: put it
    // back in the queue untouched so it sends as soon as email is set up.
    await admin
      .from('email_deliveries')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .eq('id', row.id)
    summary.notConfigured++
  } else if (result === 'cancelled') {
    summary.cancelled++
  } else {
    summary.failed++
  }
}
