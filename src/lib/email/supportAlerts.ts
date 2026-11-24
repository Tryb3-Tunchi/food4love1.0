import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { supportAlertEmail } from '@/lib/email/templates'
import { MAX_ATTEMPTS, sendTransactionalEmail } from '@/lib/email/transactional'
import { retryDelayMs } from '@/lib/email/retryPolicy'

type Admin = ReturnType<typeof createAdminClient>

export async function processSupportAlerts(
  admin: Admin,
  input: { appUrl?: string; immediateMessageId?: string },
) {
  const recipient = process.env.SUPPORT_EMAIL
  const appUrl = input.appUrl?.replace(/\/$/, '')
  if (!recipient || !appUrl || !process.env.RESEND_API_KEY) {
    return { checked: 0, accepted: 0, failed: 0 }
  }

  const settledBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  let query = admin
    .from('email_deliveries')
    .select('recipient_key, status, attempts, next_attempt_at, updated_at')
    .eq('kind', 'support_alert')
    .in('status', ['queued', 'failed'])
    .lt('attempts', MAX_ATTEMPTS)
  if (input.immediateMessageId)
    query = query.eq('recipient_key', input.immediateMessageId)
  else
    query = query
      .lt('updated_at', settledBefore)
      .order('updated_at', { ascending: true })
      .limit(25)
  const { data: rows, error } = await query
  if (error) return { checked: 0, accepted: 0, failed: 0 }

  let accepted = 0
  let failed = 0
  for (const row of rows ?? []) {
    if (row.status === 'failed') {
      if (
        !row.next_attempt_at ||
        new Date(row.next_attempt_at).getTime() > Date.now()
      )
        continue
    }
    const { data: claimed } = await admin
      .from('email_deliveries')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('kind', 'support_alert')
      .eq('recipient_key', row.recipient_key)
      .eq('status', row.status)
      .select('recipient_key')
      .maybeSingle()
    if (!claimed) continue

    const result = await sendTransactionalEmail({
      admin,
      kind: 'support_alert',
      recipientKey: row.recipient_key,
      to: recipient,
      email: supportAlertEmail({ appUrl }),
      scheduleRetry: (attempts, failure) =>
        retryDelayMs(attempts, {
          errorCode: failure.errorCode,
          retryAfterMs: failure.retryAfterMs,
        }),
    })
    if (result === 'accepted' || result === 'already_accepted') accepted++
    else failed++
  }
  return { checked: rows?.length ?? 0, accepted, failed }
}
