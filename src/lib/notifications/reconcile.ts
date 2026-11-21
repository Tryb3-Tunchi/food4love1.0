import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { logOpsEvent } from '@/lib/admin/ops'

type Admin = ReturnType<typeof createAdminClient>

// RECOVERING "YOUR COOK IS VERIFIED" EMAILS THAT WERE NEVER QUEUED
//
// The database trigger queues one email per interested customer when a cook becomes verified. By
// design, a failure while queueing must not block the verification itself, so in that rare case
// the customer got the in-app notice but no email row exists. This step finds those customers
// and queues the missing row; the normal worker then sends (or cancels) it.
//
// POLICY (documented in the engineering handover):
//   * Only customers fulfilled AFTER the outbox went live (interest_email_cutover.applied_at).
//     Anyone fulfilled before it is "historical" and is NEVER emailed automatically.
//   * Only the last RECONCILE_WINDOW_DAYS days, so a stale "your cook is verified" is not sent weeks
//     later.
//   * Only requests that were fulfilled WITH consent. Withdrawn and non-consenting ones are ignored.
//   * Any customer who already has an email row, in ANY state (queued, accepted, failed, cancelled,
//     bounced), is left alone: nothing is ever re-queued, so no repeat emails and the history stays.
//   * Eligibility (cook still verified, preferences, account state) is re-checked by the worker at
//     SEND time, exactly like every other email; an ineligible customer's row becomes 'cancelled'
//     with the reason instead of an email.
//   * Idempotent: the unique (kind, recipient) constraint means two overlapping runs, or a retry
//     after a partial failure, can only ever produce one row per customer.
export const RECONCILE_WINDOW_DAYS = 14
const PAGE = 200
const MAX_PAGES = 10 // 2,000 requests per run: far above anything real, and bounds the work

export interface ReconcileSummary {
  candidates: number
  queued: number
}

export async function reconcileMissedInterestEmails(
  admin: Admin,
  options: { now?: Date } = {},
): Promise<ReconcileSummary> {
  const none: ReconcileSummary = { candidates: 0, queued: 0 }
  const now = options.now ?? new Date()

  // No cutover row = the outbox migration is not applied, so there is nothing to reconcile (and no
  // way to tell historical from recent): do nothing.
  const { data: cutover, error: cutoverError } = await admin
    .from('interest_email_cutover')
    .select('applied_at')
    .maybeSingle()
  if (cutoverError || !cutover?.applied_at) return none

  const windowStart =
    now.getTime() - RECONCILE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const since = new Date(
    Math.max(new Date(cutover.applied_at as string).getTime(), windowStart),
  ).toISOString()

  const summary: ReconcileSummary = { candidates: 0, queued: 0 }
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data: interests, error } = await admin
      .from('booking_interests')
      .select('id')
      .eq('status', 'fulfilled')
      .eq('notify_when_verified', true)
      .gte('customer_notified_at', since)
      .order('customer_notified_at', { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error || !interests || interests.length === 0) break

    const ids = interests.map((row) => row.id as string)
    const { data: existing, error: existingError } = await admin
      .from('email_deliveries')
      .select('recipient_key')
      .eq('kind', 'interest_verified')
      .in('recipient_key', ids)
    // If we cannot see what already exists, queue nothing: a duplicate is worse than a delay.
    if (existingError) break
    const have = new Set(
      (existing ?? []).map((row) => row.recipient_key as string),
    )
    const missing = ids.filter((id) => !have.has(id))
    summary.candidates += missing.length

    if (missing.length > 0) {
      const { data: inserted, error: insertError } = await admin
        .from('email_deliveries')
        .upsert(
          missing.map((id) => ({
            kind: 'interest_verified',
            recipient_key: id,
            status: 'queued',
            // Marks WHY this row exists. The successful send clears it; ops_events keeps the record.
            last_error_code: 'reconciled',
          })),
          { onConflict: 'kind,recipient_key', ignoreDuplicates: true },
        )
        .select('recipient_key')
      // A failed insert queues nothing from this page; the next scheduled run simply tries again.
      if (insertError) break
      summary.queued += inserted?.length ?? 0
    }
    if (interests.length < PAGE) break
  }

  if (summary.queued > 0) {
    // Counts only: no customer, cook or address is ever written to the log.
    await logOpsEvent({
      severity: 'warning',
      service: 'email',
      code: 'interest_email_reconciled',
      summary: `Queued ${summary.queued} verification email(s) that the database outbox had missed`,
    })
  }
  return summary
}
