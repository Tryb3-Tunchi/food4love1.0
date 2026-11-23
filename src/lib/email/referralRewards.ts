import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { referralRewardEmail } from '@/lib/email/templates'
import { isRetryDue, retryDelayMs } from '@/lib/email/retryPolicy'
import { MAX_ATTEMPTS, sendTransactionalEmail } from '@/lib/email/transactional'

type Admin = ReturnType<typeof createAdminClient>
const KIND = 'referral_reward'
const STALE_CLAIM_MS = 10 * 60 * 1000

interface DeliveryRow {
  id: string
  recipient_key: string
  status: 'queued' | 'failed' | 'processing'
  attempts: number
  next_attempt_at: string | null
  updated_at: string
  created_at: string
}

export interface ReferralEmailSummary {
  checked: number
  sent: number
  failed: number
  cancelled: number
  deferred: number
  reconciled: number
}

const emptySummary = (): ReferralEmailSummary => ({
  checked: 0,
  sent: 0,
  failed: 0,
  cancelled: 0,
  deferred: 0,
  reconciled: 0,
})

async function reconcileReferralOutbox(admin: Admin, referredUserId?: string) {
  const { data: cutover } = await admin
    .from('referral_reward_email_cutover')
    .select('applied_at')
    .eq('id', true)
    .maybeSingle()
  if (!cutover?.applied_at) return { referralIds: [], queued: 0 }

  let referralsQuery = admin
    .from('referrals')
    .select('id')
    .gte('signup_rewarded_at', cutover.applied_at)
    .order('signup_rewarded_at', { ascending: true })
    .limit(referredUserId ? 1 : 100)
  if (referredUserId)
    referralsQuery = referralsQuery.eq('referred_user_id', referredUserId)

  const { data: referrals, error } = await referralsQuery
  if (error || !referrals?.length) return { referralIds: [], queued: 0 }

  const referralIds = referrals.map((row) => row.id as string)
  const { error: queueError } = await admin.from('email_deliveries').upsert(
    referralIds.map((id) => ({
      kind: KIND,
      recipient_key: id,
      status: 'queued',
    })),
    { onConflict: 'kind,recipient_key', ignoreDuplicates: true },
  )

  // If the outbox table is temporarily unavailable, the referral remains credited. A
  // later scheduled run reconciles it; email delivery never rolls back a wallet reward.
  return { referralIds, queued: queueError ? 0 : referralIds.length }
}

export async function processReferralRewardEmails(
  admin: Admin,
  options: {
    appUrl: string
    referredUserId?: string
    limit?: number
  },
): Promise<ReferralEmailSummary> {
  const summary = emptySummary()
  const limit = Math.min(options.limit ?? 25, 50)

  let referralIds: string[] | null = null
  try {
    const reconciled = await reconcileReferralOutbox(
      admin,
      options.referredUserId,
    )
    referralIds = reconciled.referralIds.length
      ? reconciled.referralIds
      : options.referredUserId
        ? []
        : null
    summary.reconciled = reconciled.queued
  } catch {
    // The original signup transaction has already credited the wallet. Retry next run.
  }
  if (referralIds?.length === 0) return summary

  const now = new Date()
  const nowIso = now.toISOString()
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS).toISOString()
  const select = () => {
    let query = admin
      .from('email_deliveries')
      .select(
        'id, recipient_key, status, attempts, next_attempt_at, updated_at, created_at',
      )
      .eq('kind', KIND)
      .lt('attempts', MAX_ATTEMPTS)
    if (referralIds) query = query.in('recipient_key', referralIds)
    return query
  }

  const [queued, retryable, abandoned] = await Promise.all([
    select()
      .eq('status', 'queued')
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
      .order('created_at', { ascending: true })
      .limit(limit),
    select()
      .eq('status', 'failed')
      .lte('next_attempt_at', nowIso)
      .order('created_at', { ascending: true })
      .limit(limit),
    select()
      .eq('status', 'processing')
      .lt('updated_at', staleBefore)
      .order('created_at', { ascending: true })
      .limit(limit),
  ])
  if (queued.error || retryable.error || abandoned.error) return summary

  const rows = [
    ...(queued.data ?? []),
    ...(retryable.data ?? []),
    ...(abandoned.data ?? []),
  ] as unknown as DeliveryRow[]
  rows.sort((a, b) => a.created_at.localeCompare(b.created_at))

  for (const row of rows.slice(0, limit)) {
    if (
      row.status === 'processing' &&
      Date.parse(row.updated_at) >= Date.parse(staleBefore)
    )
      continue
    if (row.status !== 'processing' && !isRetryDue(row, now)) continue
    summary.checked++

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
      const attempts = row.attempts + 1
      const delay = retryDelayMs(attempts, { errorCode: 'processing_error' })
      await admin
        .from('email_deliveries')
        .update({
          status: 'failed',
          attempts,
          last_error_code: 'processing_error',
          next_attempt_at:
            delay === null ? null : new Date(Date.now() + delay).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      summary.failed++
    }
  }
  return summary
}

export async function drainReferralRewardEmails(
  admin: Admin,
  options: { appUrl: string; budgetMs?: number; maxBatches?: number },
) {
  const total = { ...emptySummary(), batches: 0 }
  const deadline = Date.now() + (options.budgetMs ?? 35_000)
  const maxBatches = options.maxBatches ?? 8
  while (total.batches < maxBatches && Date.now() < deadline) {
    const batch = await processReferralRewardEmails(admin, {
      appUrl: options.appUrl,
      limit: 25,
    })
    total.batches++
    total.checked += batch.checked
    total.sent += batch.sent
    total.failed += batch.failed
    total.cancelled += batch.cancelled
    total.deferred += batch.deferred
    total.reconciled += batch.reconciled
    if (batch.sent + batch.failed + batch.cancelled + batch.deferred === 0)
      break
  }
  return total
}

async function processOne(
  admin: Admin,
  row: DeliveryRow,
  appUrl: string,
  summary: ReferralEmailSummary,
) {
  const { data: referral } = await admin
    .from('referrals')
    .select('id, referrer_id, signup_rewarded_at')
    .eq('id', row.recipient_key)
    .maybeSingle()
  if (!referral?.signup_rewarded_at) {
    await finish(admin, row.id, 'cancelled', 'referral_missing')
    summary.cancelled++
    return
  }

  const [{ data: profile }, { data: authResult }] = await Promise.all([
    admin
      .from('profiles')
      .select('full_name')
      .eq('id', referral.referrer_id)
      .maybeSingle(),
    admin.auth.admin.getUserById(referral.referrer_id as string),
  ])
  const user = authResult?.user
  if (!user?.email || !user.email_confirmed_at) {
    const nextAttempt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    await admin
      .from('email_deliveries')
      .update({
        status: 'queued',
        last_error_code: 'recipient_unconfirmed',
        next_attempt_at: nextAttempt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    summary.deferred++
    return
  }

  const result = await sendTransactionalEmail({
    admin,
    kind: KIND,
    recipientKey: row.recipient_key,
    to: user.email,
    email: referralRewardEmail({
      name: profile?.full_name ?? null,
      appUrl,
    }),
    scheduleRetry: (attemptsMade, failure) =>
      retryDelayMs(attemptsMade, failure),
  })
  if (result === 'accepted' || result === 'already_accepted') {
    summary.sent++
  } else if (result === 'unavailable') {
    await admin
      .from('email_deliveries')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .eq('id', row.id)
    summary.deferred++
  } else if (result === 'cancelled') {
    summary.cancelled++
  } else {
    summary.failed++
  }
}

async function finish(
  admin: Admin,
  id: string,
  status: 'cancelled',
  reason: string,
) {
  await admin
    .from('email_deliveries')
    .update({
      status,
      last_error_code: reason,
      next_attempt_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}
