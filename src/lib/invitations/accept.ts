import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import {
  CLAIM_WINDOW_MS,
  INVITATION_COLUMNS,
  type InvitationRow,
} from '@/lib/invitations/server'
import {
  classifyAuthError,
  effectiveStatus,
  validatePassword,
} from '@/lib/invitations/rules'
import { hashInviteToken, looksLikeInviteToken } from '@/lib/invitations/token'

type Admin = ReturnType<typeof createAdminClient>

// Where a freshly accepted member goes next: the same onboarding every new member does.
export const AFTER_ACCEPT_PATH = '/onboarding/setup'

export type TokenProblem = 'invalid' | 'expired' | 'revoked' | 'used'

export type TokenCheck =
  { ok: true; invitation: InvitationRow } | { ok: false; reason: TokenProblem }

// The secret in the emailed link is looked up by its hash. A wrong or unknown secret and
// a failed invitation both answer "invalid" so a guesser learns nothing.
export async function checkInvitationToken(
  admin: Admin,
  rawToken: unknown,
): Promise<TokenCheck> {
  if (!looksLikeInviteToken(rawToken)) return { ok: false, reason: 'invalid' }
  const { data } = await admin
    .from('tester_invitations')
    .select(INVITATION_COLUMNS)
    .eq('token_hash', hashInviteToken(rawToken))
    .maybeSingle()
  const invitation = data as unknown as InvitationRow | null
  if (!invitation) return { ok: false, reason: 'invalid' }
  if (invitation.status === 'accepted') return { ok: false, reason: 'used' }
  if (invitation.status === 'revoked') return { ok: false, reason: 'revoked' }
  const status = effectiveStatus(invitation)
  if (status === 'expired') return { ok: false, reason: 'expired' }
  if (status !== 'pending') return { ok: false, reason: 'invalid' }
  return { ok: true, invitation }
}

export type AcceptResult =
  | { kind: 'ok'; redirectTo: string }
  | { kind: 'token'; reason: TokenProblem }
  | { kind: 'weak_password'; message: string }
  | { kind: 'in_progress' }
  | { kind: 'failed'; message: string }

const GENERIC_FAILURE =
  'We could not finish setting up your account. Please try the link in your email again, or ask for a new invitation.'

// Finishes an invitation: proves the link is still valid, gets a one-time Supabase token,
// signs the person in with it, lets THEM choose their password (Supabase hashes it; we
// never see or store it), completes their profile and records the tester type.
//
// `session` is the cookie-bound client of the person's browser, so a successful run leaves
// them signed in. `admin` is the service-role client and is used only for the steps no
// browser should be able to do.
export async function completeInvitation(input: {
  admin: Admin
  session: SupabaseClient
  rawToken: unknown
  password: unknown
}): Promise<AcceptResult> {
  const { admin, session } = input

  const checked = await checkInvitationToken(admin, input.rawToken)
  if (!checked.ok) return { kind: 'token', reason: checked.reason }
  const invitation = checked.invitation

  const passwordCheck = validatePassword(input.password, {
    email: invitation.email,
    fullName: invitation.full_name,
  })
  if (!passwordCheck.ok)
    return { kind: 'weak_password', message: passwordCheck.message }
  const password = input.password as string

  // Claim it: two tabs, a double submit or a retry cannot both complete the invitation.
  const staleBefore = new Date(Date.now() - CLAIM_WINDOW_MS).toISOString()
  const { data: claimed } = await admin
    .from('tester_invitations')
    .update({ claimed_at: new Date().toISOString() })
    .eq('id', invitation.id)
    .eq('status', 'pending')
    .or(`claimed_at.is.null,claimed_at.lt.${staleBefore}`)
    .select('id')
    .maybeSingle()
  if (!claimed) return { kind: 'in_progress' }

  const release = async (reason: string) => {
    await admin
      .from('tester_invitations')
      .update({ claimed_at: null, failure_reason: reason.slice(0, 80) })
      .eq('id', invitation.id)
      .eq('status', 'pending')
  }

  let signedIn = false
  try {
    // A fresh one-time Supabase token for THIS invitation. 'invite' works while the
    // invited account is still unconfirmed; if they already got part-way (confirmed but
    // never set a password), Supabase refuses 'invite' and a magic link is used instead.
    let link = await admin.auth.admin.generateLink({
      type: 'invite',
      email: invitation.email,
      options: {
        data: {
          full_name: invitation.full_name,
          role: invitation.profile_role,
        },
      },
    })
    if (
      link.error &&
      classifyAuthError(link.error).code === 'existing_account'
    ) {
      link = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: invitation.email,
      })
    }
    const linkUser = link.data?.user
    const properties = link.data?.properties
    if (link.error || !linkUser || !properties?.hashed_token) {
      await release(`auth:${classifyAuthError(link.error).code}`)
      return { kind: 'failed', message: GENERIC_FAILURE }
    }
    // The account behind the link must be the one this invitation was made for.
    if (
      linkUser.email?.toLowerCase() !== invitation.email ||
      (invitation.auth_user_id && linkUser.id !== invitation.auth_user_id)
    ) {
      await release('identity_mismatch')
      return { kind: 'failed', message: GENERIC_FAILURE }
    }

    const verified = await session.auth.verifyOtp({
      token_hash: properties.hashed_token,
      type: properties.verification_type as
        'invite' | 'magiclink' | 'signup' | 'recovery',
    })
    if (verified.error || !verified.data.user) {
      await release('verify_failed')
      return { kind: 'failed', message: GENERIC_FAILURE }
    }
    signedIn = true
    const userId = verified.data.user.id
    if (userId !== linkUser.id) {
      await session.auth.signOut()
      await release('identity_mismatch')
      return { kind: 'failed', message: GENERIC_FAILURE }
    }

    const updated = await session.auth.updateUser({ password })
    if (updated.error) {
      await session.auth.signOut()
      if ((updated.error.code ?? '') === 'weak_password') {
        await release('weak_password')
        return {
          kind: 'weak_password',
          message:
            'That password is too weak for this project. Choose a longer, less common one.',
        }
      }
      await release('password_failed')
      return { kind: 'failed', message: GENERIC_FAILURE }
    }

    // The profile normally exists (created by the signup trigger). If it does not, or if
    // the account was left over from an earlier attempt with a different name or role,
    // make it match the invitation. Verification and suspension are never touched here.
    const { data: profile } = await admin
      .from('profiles')
      .select('id, onboarding_complete')
      .eq('id', userId)
      .maybeSingle()
    if (!profile) {
      await admin.from('profiles').insert({
        id: userId,
        full_name: invitation.full_name,
        role: invitation.profile_role,
      })
    } else if (!profile.onboarding_complete) {
      await admin
        .from('profiles')
        .update({
          full_name: invitation.full_name,
          role: invitation.profile_role,
        })
        .eq('id', userId)
    }

    // The tester type lives in server-only app_metadata (a member cannot edit it) and is
    // merged with what is already there. `role` and `admin_permissions`, which decide
    // admin access, are never read or written here.
    const { data: current } = await admin.auth.admin.getUserById(userId)
    const existing = (current?.user?.app_metadata ?? {}) as Record<
      string,
      unknown
    >
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...existing,
        tester_type: invitation.access_type,
        invitation_id: invitation.id,
      },
    })

    const { data: accepted } = await admin
      .from('tester_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        auth_user_id: userId,
        claimed_at: null,
        failure_reason: null,
      })
      .eq('id', invitation.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (!accepted) {
      // Revoked or changed in the instant between the check and now. Revoke refuses to
      // run while a claim is fresh, so this should be unreachable; fail closed anyway.
      await session.auth.signOut()
      return { kind: 'token', reason: 'revoked' }
    }

    // The audit record is best effort: an unavailable audit table must not undo an
    // account that is already set up.
    try {
      const audit = await beginAdminAudit({
        actorId: userId,
        action: 'tester.accept',
        targetType: 'tester_invitation',
        targetId: invitation.id,
        details: { access_type: invitation.access_type },
      })
      await finishAdminAudit(audit.admin, audit.auditId, 'succeeded')
    } catch {
      // see above
    }

    return { kind: 'ok', redirectTo: AFTER_ACCEPT_PATH }
  } catch {
    if (signedIn) await session.auth.signOut().catch(() => undefined)
    await release('unexpected_error').catch(() => undefined)
    return { kind: 'failed', message: GENERIC_FAILURE }
  }
}
