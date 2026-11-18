import 'server-only'
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { createAdminClient } from '@/lib/supabase/admin'
import { passwordRecoveryEmail } from '@/lib/email/templates'
import { sendTransactionalEmail } from '@/lib/email/transactional'
import { lookupAuthUser } from '@/lib/invitations/server'
import { validatePassword } from '@/lib/invitations/rules'
import {
  canRecoverAccount,
  looksLikeRecoveryToken,
  recoveryBucket,
} from '@/lib/auth/recovery'

type Admin = ReturnType<typeof createAdminClient>

export type RecoveryOutcome = 'sent' | 'skipped' | 'cooldown' | 'unavailable'

// A short, non-reversible handle for the address, used as the cooldown key. The address itself is
// never stored by this feature.
export function recoveryAddressKey(email: string): string {
  return createHash('sha256').update(email).digest('hex').slice(0, 32)
}

// The cooldown is a database row, so it holds across server instances, and two simultaneous requests
// race on a unique key (kind + recipient): exactly one of them wins.
async function claimSlot(
  admin: Admin,
  key: string,
): Promise<'claimed' | 'cooldown' | 'untracked'> {
  const { data, error } = await admin
    .from('email_deliveries')
    .upsert(
      { kind: 'password_recovery', recipient_key: key, status: 'queued' },
      { onConflict: 'kind,recipient_key', ignoreDuplicates: true },
    )
    .select('id')
  // The table (or the email kind) is not available yet: do not block recovery, rely on the
  // per-instance limits in the route.
  if (error) return 'untracked'
  return (data?.length ?? 0) > 0 ? 'claimed' : 'cooldown'
}

// A reset email that was never accepted by the provider must not lock the person out of trying
// again for the rest of the window.
async function releaseSlot(admin: Admin, key: string) {
  await admin
    .from('email_deliveries')
    .delete()
    .eq('kind', 'password_recovery')
    .eq('recipient_key', key)
    .in('status', ['queued', 'failed'])
}

// Sends a reset link when (and only when) the address belongs to a confirmed account. The caller
// answers the visitor identically for EVERY outcome; the return value exists for tests and logs.
export async function requestPasswordRecovery(
  admin: Admin,
  input: { email: string; appUrl: string },
): Promise<RecoveryOutcome> {
  const { email, appUrl } = input

  const facts = await lookupAuthUser(admin, email)
  if (!canRecoverAccount(facts)) return 'skipped'

  const key = `${recoveryAddressKey(email)}:${recoveryBucket(Date.now())}`
  const slot = await claimSlot(admin, key)
  if (slot === 'cooldown') return 'cooldown'

  // Supabase creates the one-time token and remembers it. We only carry it to the person, in our own
  // branded email, instead of relying on Supabase's mail settings and redirect allow-list.
  const link = await admin.auth.admin.generateLink({ type: 'recovery', email })
  const hashed = link.data?.properties?.hashed_token
  if (
    link.error ||
    !hashed ||
    link.data?.user?.email?.toLowerCase() !== email
  ) {
    if (slot === 'claimed') await releaseSlot(admin, key)
    return 'unavailable'
  }

  const result = await sendTransactionalEmail({
    admin,
    kind: 'password_recovery',
    recipientKey: key,
    to: email,
    email: passwordRecoveryEmail({
      resetUrl: `${appUrl}/reset-password#token=${hashed}`,
    }),
    // A failed reset email is never retried automatically (that would need the token again, and a
    // new token would invalidate the one already sent). The person just asks again.
    scheduleRetry: () => null,
  })
  if (result === 'accepted' || result === 'already_accepted') return 'sent'
  if (slot === 'claimed') await releaseSlot(admin, key)
  return 'unavailable'
}

export type ResetResult =
  | { kind: 'ok' }
  | { kind: 'invalid_link' }
  | { kind: 'weak_password'; message: string }
  | { kind: 'failed' }

// Finishes a reset: proves the one-time token, sets the new password through Supabase Auth (which
// hashes it; this app never sees or stores it), then ends EVERY session of that account so a stolen
// session cannot outlive the password change. `session` is the cookie-bound client of the visitor's
// browser; it is left signed out, so the person signs in normally with the new password.
export async function completePasswordReset(input: {
  session: SupabaseClient
  rawToken: unknown
  password: unknown
}): Promise<ResetResult> {
  const { session } = input
  if (!looksLikeRecoveryToken(input.rawToken)) return { kind: 'invalid_link' }

  // Cheap checks first, so a weak password does not use up the one-time token.
  const early = validatePassword(input.password)
  if (!early.ok) return { kind: 'weak_password', message: early.message }
  const password = input.password as string

  const verified = await session.auth.verifyOtp({
    token_hash: input.rawToken,
    type: 'recovery',
  })
  const user = verified.data?.user
  if (verified.error || !user) return { kind: 'invalid_link' }

  const endSessions = async () => {
    await session.auth.signOut({ scope: 'global' }).catch(() => undefined)
  }

  // Now the address is known: refuse a password that contains it.
  const withEmail = validatePassword(password, { email: user.email ?? '' })
  if (!withEmail.ok) {
    await endSessions()
    return {
      kind: 'weak_password',
      message: `${withEmail.message} This link has been used, so request a new one.`,
    }
  }

  const updated = await session.auth.updateUser({ password })
  if (updated.error) {
    await endSessions()
    if ((updated.error.code ?? '') === 'weak_password') {
      return {
        kind: 'weak_password',
        message:
          'That password is too weak for this project. Request a new link and choose a longer, less common one.',
      }
    }
    return { kind: 'failed' }
  }

  await endSessions()
  return { kind: 'ok' }
}
