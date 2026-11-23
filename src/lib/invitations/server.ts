import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { beginAdminAudit, finishAdminAudit } from '@/lib/admin/audit'
import { isMissingSchema } from '@/lib/booking/server'
import { sendTransactionalEmail } from '@/lib/email/transactional'
import { testerInvitationEmail } from '@/lib/email/templates'
import {
  INVITATION_TTL_DAYS,
  canResend,
  canRevoke,
  classifyAuthError,
  decideInviteTarget,
  effectiveStatus,
  profileRoleFor,
  type AuthUserFacts,
  type InvitationStatus,
  type InviteInput,
} from '@/lib/invitations/rules'
import { generateInviteToken, hashInviteToken } from '@/lib/invitations/token'

type Admin = ReturnType<typeof createAdminClient>

// token_hash is deliberately absent: it never leaves the server, not even to an admin.
export const INVITATION_COLUMNS =
  'id, email, full_name, preferred_username, access_type, profile_role, personal_message, status, failure_reason, auth_user_id, invited_by, send_count, last_sent_at, expires_at, accepted_at, revoked_at, created_at, updated_at, claimed_at'

export interface InvitationRow {
  id: string
  email: string
  full_name: string
  preferred_username: string | null
  access_type: string
  profile_role: 'buyer' | 'cook'
  personal_message: string | null
  status: InvitationStatus
  failure_reason: string | null
  auth_user_id: string | null
  invited_by: string | null
  send_count: number
  last_sent_at: string | null
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
  claimed_at: string | null
}

// How long a claim on an invitation ("someone is completing it") is respected. After
// this the claim is treated as abandoned, so an interrupted browser cannot lock it forever.
export const CLAIM_WINDOW_MS = 10 * 60 * 1000

export type DeliveryOutcome = 'accepted' | 'failed' | 'not_configured'

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

export { resolveAppUrl } from '@/lib/appUrl'

// A brake on invitation sends per admin that works across server instances: it counts the
// audit records the sends already write, instead of keeping a counter in memory (which each
// serverless instance would have its own copy of). Fails open if the audit table cannot be
// read, because every send also needs to write an audit record and refuses to run without it.
export const INVITE_ACTIONS_PER_HOUR = 40

export async function hasInviteBudget(
  admin: Admin,
  actorId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error } = await admin
    .from('admin_audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('actor_id', actorId)
    .in('action', ['tester.invite', 'tester.resend'])
    .gte('created_at', since)
  if (error) return true
  return (count ?? 0) < INVITE_ACTIONS_PER_HOUR
}

// ----------------------------------------------------------- what is on file already
// Has this email got an auth account, and was it ever used? Uses the lookup function from
// the invitations migration; without it, falls back to scanning the user list (fine at
// today's size, and reported as 'unknown' if the list is too long to scan safely).
export async function lookupAuthUser(
  admin: Admin,
  email: string,
): Promise<AuthUserFacts | null | 'unknown'> {
  const { data, error } = await admin.rpc('admin_lookup_auth_user', {
    p_email: email,
  })
  if (!error) {
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null
    return {
      id: row.id as string,
      confirmed: !!row.confirmed,
      signedInBefore: !!row.signed_in_before,
      hasProfile: !!row.has_profile,
    }
  }
  if (!isMissingSchema(error)) return 'unknown'

  const perPage = 200
  for (let page = 1; page <= 5; page++) {
    const { data: list, error: listError } = await admin.auth.admin.listUsers({
      page,
      perPage,
    })
    if (listError || !list) return 'unknown'
    const hit = list.users.find((user) => user.email?.toLowerCase() === email)
    if (hit) {
      const { data: profile } = await admin
        .from('profiles')
        .select('id')
        .eq('id', hit.id)
        .maybeSingle()
      return {
        id: hit.id,
        confirmed: !!hit.email_confirmed_at,
        signedInBefore: !!hit.last_sign_in_at,
        hasProfile: !!profile,
      }
    }
    if (list.users.length < perPage) return null
  }
  return 'unknown'
}

// "Pending" past its expiry is really expired. Flipping it makes the one-pending-per-email
// rule fair and keeps the table honest. Idempotent; safe to run on every list/create.
async function expireStale(admin: Admin, email?: string) {
  let query = admin
    .from('tester_invitations')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lte('expires_at', new Date().toISOString())
  if (email) query = query.eq('email', email)
  await query
}

// ---------------------------------------------------------------- sending the email
// Rotates nothing and creates nothing: it only sends `rawToken` for this row. The send
// number (row.send_count) is also Resend's idempotency key, so a retry of the very same
// send can never produce a second email.
async function dispatchInvitation(
  admin: Admin,
  row: InvitationRow,
  rawToken: string,
  appUrl: string,
): Promise<DeliveryOutcome> {
  // row.send_count is THIS send's number. The caller already claimed it in the same atomic
  // update that wrote the new secret (see createInvitation / resendInvitation), so two
  // concurrent presses can never end up with one secret and another press's email.
  const result = await sendTransactionalEmail({
    admin,
    kind: 'tester_invitation',
    recipientKey: `${row.id}:${row.send_count}`,
    to: row.email,
    email: testerInvitationEmail({
      fullName: row.full_name,
      acceptUrl: `${appUrl}/invite/accept#token=${rawToken}`,
      expiresAt: row.expires_at,
      personalMessage: row.personal_message,
    }),
    // The link's secret is not stored, so a failed invitation cannot be re-sent
    // automatically. The admin presses Resend, which issues a fresh link.
    scheduleRetry: () => null,
  })

  if (result === 'accepted' || result === 'already_accepted') {
    await admin
      .from('tester_invitations')
      .update({ failure_reason: null })
      .eq('id', row.id)
    return 'accepted'
  }
  const notConfigured = result === 'unavailable'
  await admin
    .from('tester_invitations')
    .update({
      status: 'failed',
      failure_reason: notConfigured ? 'email_not_configured' : 'email_not_sent',
    })
    .eq('id', row.id)
    .eq('status', 'pending')
  return notConfigured ? 'not_configured' : 'failed'
}

// Creates (or refreshes) the Supabase invitation WITHOUT sending Supabase's own email.
// generateLink builds the invited auth user and hands back a link, which we discard:
// Resend delivers the branded email, so the person gets exactly one message. The user is
// created now (not when they click) so any Supabase-side problem, such as a failing
// signup trigger or rate limit, is shown to the admin immediately.
async function prepareAuthInvitation(
  admin: Admin,
  row: InvitationRow,
): Promise<
  | { ok: true; authUserId: string }
  | { ok: false; code: string; message: string; httpStatus: number }
> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: row.email,
    options: { data: { full_name: row.full_name, role: row.profile_role } },
  })
  if (error || !data?.user) {
    const failure = classifyAuthError(error)
    return {
      ok: false,
      code: failure.code,
      message: failure.message,
      httpStatus: failure.httpStatus,
    }
  }
  await admin
    .from('tester_invitations')
    .update({ auth_user_id: data.user.id })
    .eq('id', row.id)
  return { ok: true, authUserId: data.user.id }
}

async function markFailed(admin: Admin, id: string, reason: string) {
  await admin
    .from('tester_invitations')
    .update({ status: 'failed', failure_reason: reason.slice(0, 80) })
    .eq('id', id)
    .in('status', ['pending', 'failed', 'expired'])
}

// ------------------------------------------------------------------------- create
export type CreateInvitationResult =
  | {
      kind: 'created'
      invitation: InvitationRow
      delivery: DeliveryOutcome
      note: string | null
    }
  | {
      kind: 'blocked'
      code: string
      message: string
      invitationId?: string
    }
  | {
      kind: 'failed'
      code: string
      message: string
      httpStatus: number
      invitation?: InvitationRow
    }
  | { kind: 'unavailable' }

export async function createInvitation(
  admin: Admin,
  input: { value: InviteInput; actorId: string; appUrl: string },
): Promise<CreateInvitationResult> {
  const { value, actorId, appUrl } = input

  await expireStale(admin, value.email)

  const [pending, prior, usernameRow, authUser] = await Promise.all([
    admin
      .from('tester_invitations')
      .select('id')
      .eq('email', value.email)
      .eq('status', 'pending')
      .maybeSingle(),
    admin
      .from('tester_invitations')
      .select('id, status')
      .eq('email', value.email)
      .in('status', ['failed', 'expired'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    value.preferred_username
      ? admin
          .from('tester_invitations')
          .select('id')
          .eq('preferred_username', value.preferred_username)
          .in('status', ['pending', 'accepted'])
          .neq('email', value.email)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    lookupAuthUser(admin, value.email),
  ])
  if (pending.error && isMissingSchema(pending.error))
    return { kind: 'unavailable' }

  const decision = decideInviteTarget({
    pendingInvitation: pending.data ? { id: pending.data.id as string } : null,
    priorInvitation: prior.data
      ? {
          id: prior.data.id as string,
          status: prior.data.status as InvitationStatus,
        }
      : null,
    authUser,
    usernameTaken: !!usernameRow.data,
  })
  if (!decision.ok)
    return {
      kind: 'blocked',
      code: decision.code,
      message: decision.message,
      invitationId: decision.invitationId,
    }

  const rawToken = generateInviteToken()
  const fields = {
    full_name: value.full_name,
    preferred_username: value.preferred_username,
    access_type: value.access_type,
    profile_role: profileRoleFor(value.access_type),
    personal_message: value.personal_message,
    token_hash: hashInviteToken(rawToken),
    status: 'pending' as const,
    failure_reason: null,
    invited_by: actorId,
    expires_at: daysFromNow(INVITATION_TTL_DAYS),
    claimed_at: null,
    ...(decision.adoptAuthUserId
      ? { auth_user_id: decision.adoptAuthUserId }
      : {}),
  }

  // The new secret and this send's number are written in ONE update, guarded by the
  // previous send number, so the secret that ends up in the database is always the one
  // in the email that is about to be sent.
  let written
  if (decision.reuseInvitationId) {
    const previous = await getInvitation(admin, decision.reuseInvitationId)
    written = previous
      ? await admin
          .from('tester_invitations')
          .update({
            ...fields,
            send_count: previous.send_count + 1,
            last_sent_at: new Date().toISOString(),
          })
          .eq('id', previous.id)
          .eq('send_count', previous.send_count)
          .in('status', ['failed', 'expired'])
          .select(INVITATION_COLUMNS)
          .maybeSingle()
      : { data: null, error: null }
  } else {
    written = await admin
      .from('tester_invitations')
      .insert({
        email: value.email,
        ...fields,
        send_count: 1,
        last_sent_at: new Date().toISOString(),
      })
      .select(INVITATION_COLUMNS)
      .single()
  }

  if (written.error || !written.data) {
    if (written.error && isMissingSchema(written.error))
      return { kind: 'unavailable' }
    if (written.error?.code === '23505') {
      const username = /username_in_use/.test(written.error.message ?? '')
      return {
        kind: 'blocked',
        code: username ? 'username_taken' : 'pending_invitation',
        message: username
          ? 'That username is already used by another invitation. Choose another.'
          : 'This email already has a pending invitation. Use Resend in the table below.',
      }
    }
    return {
      kind: 'failed',
      code: 'save_failed',
      message: 'The invitation could not be saved. Nothing was sent.',
      httpStatus: 500,
    }
  }
  const invitation = written.data as unknown as InvitationRow

  // Write the audit record BEFORE anything is sent to a real person. If auditing is
  // unavailable the invitation is parked as failed and nothing goes out.
  const audit = await beginAdminAudit({
    actorId,
    action: 'tester.invite',
    targetType: 'tester_invitation',
    targetId: invitation.id,
    details: { email: value.email, access_type: value.access_type },
  }).catch(() => null)
  if (!audit) {
    await markFailed(admin, invitation.id, 'audit_unavailable')
    return {
      kind: 'failed',
      code: 'audit_unavailable',
      message: 'Admin audit logging is unavailable, so nothing was sent.',
      httpStatus: 503,
      invitation,
    }
  }

  const prepared = await prepareAuthInvitation(admin, invitation)
  if (!prepared.ok) {
    await markFailed(admin, invitation.id, `auth:${prepared.code}`)
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      'failed',
      `auth:${prepared.code}`,
    ).catch(() => undefined)
    return {
      kind: 'failed',
      code: prepared.code,
      message: prepared.message,
      httpStatus: prepared.httpStatus,
      invitation: { ...invitation, status: 'failed' },
    }
  }

  const delivery = await dispatchInvitation(admin, invitation, rawToken, appUrl)
  await finishAdminAudit(
    audit.admin,
    audit.auditId,
    delivery === 'accepted' ? 'succeeded' : 'failed',
    delivery === 'accepted' ? undefined : `delivery:${delivery}`,
  ).catch(() => undefined)

  const fresh = await getInvitation(admin, invitation.id)
  return {
    kind: 'created',
    invitation: fresh ?? invitation,
    delivery,
    note: decision.note,
  }
}

export async function getInvitation(
  admin: Admin,
  id: string,
): Promise<InvitationRow | null> {
  const { data } = await admin
    .from('tester_invitations')
    .select(INVITATION_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  return (data as unknown as InvitationRow | null) ?? null
}

// ------------------------------------------------------------------------- resend
export type ActionResult =
  | { kind: 'ok'; invitation: InvitationRow; delivery?: DeliveryOutcome }
  | { kind: 'blocked'; code: string; message: string; httpStatus: number }
  | { kind: 'failed'; code: string; message: string; httpStatus: number }
  | { kind: 'not_found' }

const claimIsFresh = (row: InvitationRow) =>
  !!row.claimed_at &&
  Date.now() - new Date(row.claimed_at).getTime() < CLAIM_WINDOW_MS

export async function resendInvitation(
  admin: Admin,
  input: { id: string; actorId: string; appUrl: string },
): Promise<ActionResult> {
  const row = await getInvitation(admin, input.id)
  if (!row) return { kind: 'not_found' }
  const status = effectiveStatus(row)
  if (!canResend(status))
    return {
      kind: 'blocked',
      code: 'not_resendable',
      message:
        status === 'accepted'
          ? 'This invitation was already accepted.'
          : 'This invitation was revoked. Invite the person again from the form instead.',
      httpStatus: 409,
    }
  if (claimIsFresh(row))
    return {
      kind: 'blocked',
      code: 'in_progress',
      message: 'The recipient is completing this invitation right now.',
      httpStatus: 409,
    }

  const audit = await beginAdminAudit({
    actorId: input.actorId,
    action: 'tester.resend',
    targetType: 'tester_invitation',
    targetId: row.id,
    details: { email: row.email, previous_status: status },
  }).catch(() => null)
  if (!audit)
    return {
      kind: 'failed',
      code: 'audit_unavailable',
      message: 'Admin audit logging is unavailable, so nothing was sent.',
      httpStatus: 503,
    }

  // A fresh secret: the previous link stops working the moment this succeeds. The secret
  // and the new send number are claimed together, so of two simultaneous presses exactly
  // one wins and the other is told the invitation just changed.
  const rawToken = generateInviteToken()
  const { data: rotated } = await admin
    .from('tester_invitations')
    .update({
      token_hash: hashInviteToken(rawToken),
      status: 'pending',
      failure_reason: null,
      expires_at: daysFromNow(INVITATION_TTL_DAYS),
      claimed_at: null,
      send_count: row.send_count + 1,
      last_sent_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .in('status', ['pending', 'failed', 'expired'])
    .eq('send_count', row.send_count)
    // Atomic with the recipient's claim (same rule as revoke): if they started completing the
    // invitation after the check above, this update matches nothing instead of pulling the
    // link out from under them and clearing their claim.
    .or(
      `claimed_at.is.null,claimed_at.lt.${new Date(Date.now() - CLAIM_WINDOW_MS).toISOString()}`,
    )
    .select(INVITATION_COLUMNS)
    .maybeSingle()
  if (!rotated) {
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      'failed',
      'changed_meanwhile',
    ).catch(() => undefined)
    return {
      kind: 'blocked',
      code: 'changed_meanwhile',
      message: 'This invitation just changed. Refresh and try again.',
      httpStatus: 409,
    }
  }
  const invitation = rotated as unknown as InvitationRow

  const prepared = await prepareAuthInvitation(admin, invitation)
  if (!prepared.ok) {
    await markFailed(admin, invitation.id, `auth:${prepared.code}`)
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      'failed',
      `auth:${prepared.code}`,
    ).catch(() => undefined)
    return {
      kind: 'failed',
      code: prepared.code,
      message: prepared.message,
      httpStatus: prepared.httpStatus,
    }
  }

  const delivery = await dispatchInvitation(
    admin,
    invitation,
    rawToken,
    input.appUrl,
  )
  await finishAdminAudit(
    audit.admin,
    audit.auditId,
    delivery === 'accepted' ? 'succeeded' : 'failed',
    delivery === 'accepted' ? undefined : `delivery:${delivery}`,
  ).catch(() => undefined)

  return {
    kind: 'ok',
    invitation: (await getInvitation(admin, invitation.id)) ?? invitation,
    delivery,
  }
}

// ------------------------------------------------------------------------- revoke
// Revoking is enforced on the SERVER, not just displayed: every use of the link (checking
// it and completing it) requires status 'pending', the status becomes final (a database
// trigger forbids reviving it), and an invited account that nobody ever used is removed so
// its address cannot be used to get in through "forgot password". The recipient who tries
// the old link is told it was cancelled.
export async function revokeInvitation(
  admin: Admin,
  input: { id: string; actorId: string },
): Promise<ActionResult> {
  const row = await getInvitation(admin, input.id)
  if (!row) return { kind: 'not_found' }
  const status = effectiveStatus(row)
  if (!canRevoke(status))
    return {
      kind: 'blocked',
      code: 'not_revocable',
      message:
        status === 'accepted'
          ? 'This invitation was already accepted. Manage the account from Users instead.'
          : 'This invitation was already revoked.',
      httpStatus: 409,
    }
  if (claimIsFresh(row))
    return {
      kind: 'blocked',
      code: 'in_progress',
      message:
        'The recipient is completing this invitation right now. Try again in a few minutes.',
      httpStatus: 409,
    }

  const audit = await beginAdminAudit({
    actorId: input.actorId,
    action: 'tester.revoke',
    targetType: 'tester_invitation',
    targetId: row.id,
    details: { email: row.email, previous_status: status },
  }).catch(() => null)
  if (!audit)
    return {
      kind: 'failed',
      code: 'audit_unavailable',
      message: 'Admin audit logging is unavailable, so nothing was changed.',
      httpStatus: 503,
    }

  const { data: revoked } = await admin
    .from('tester_invitations')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revoked_by: input.actorId,
      failure_reason: null,
    })
    .eq('id', row.id)
    .in('status', ['pending', 'failed', 'expired'])
    .or(
      `claimed_at.is.null,claimed_at.lt.${new Date(Date.now() - CLAIM_WINDOW_MS).toISOString()}`,
    )
    .select(INVITATION_COLUMNS)
    .maybeSingle()
  if (!revoked) {
    await finishAdminAudit(
      audit.admin,
      audit.auditId,
      'failed',
      'changed_meanwhile',
    ).catch(() => undefined)
    return {
      kind: 'blocked',
      code: 'changed_meanwhile',
      message: 'This invitation just changed. Refresh and try again.',
      httpStatus: 409,
    }
  }

  if (row.auth_user_id) await removeUnusedInvitedUser(admin, row.auth_user_id)
  await finishAdminAudit(audit.admin, audit.auditId, 'succeeded').catch(
    () => undefined,
  )
  return { kind: 'ok', invitation: revoked as unknown as InvitationRow }
}

// Only ever removes an account that was created by an invitation and never used: not
// confirmed, never signed in, profile never onboarded. Anything else is left alone.
async function removeUnusedInvitedUser(admin: Admin, userId: string) {
  try {
    const { data } = await admin.auth.admin.getUserById(userId)
    const user = data?.user
    if (!user || user.email_confirmed_at || user.last_sign_in_at) return
    const { data: profile } = await admin
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', userId)
      .maybeSingle()
    if (profile?.onboarding_complete) return
    await admin.auth.admin.deleteUser(userId)
  } catch {
    // cleanup is best effort; the revocation itself already holds
  }
}

// -------------------------------------------------------------------------- list
export interface ListFilters {
  status?: InvitationStatus
  search?: string
  page: number
  pageSize: number
}

export async function listInvitations(admin: Admin, filters: ListFilters) {
  await expireStale(admin)

  let query = admin
    .from('tester_invitations')
    .select(INVITATION_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(
      (filters.page - 1) * filters.pageSize,
      filters.page * filters.pageSize - 1,
    )
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.search) {
    // Whitelist, not escape: commas and parentheses are structure in PostgREST's or()
    // syntax, so they must never reach it from user input.
    const safe = filters.search.replace(/[^A-Za-z0-9À-ɏ@.+\-' ]/g, '').trim()
    if (safe)
      query = query.or(`email.ilike.%${safe}%,full_name.ilike.%${safe}%`)
  }
  const { data, count, error } = await query
  if (error) return { error }

  const rows = (data ?? []) as unknown as InvitationRow[]

  // How the LAST email for each invitation fared (accepted by Resend is not "delivered").
  const keys = rows
    .filter((r) => r.send_count > 0)
    .map((r) => `${r.id}:${r.send_count}`)
  const deliveryByKey = new Map<
    string,
    { status: string; last_error_code: string | null }
  >()
  if (keys.length > 0) {
    const { data: deliveries } = await admin
      .from('email_deliveries')
      .select('recipient_key, status, last_error_code')
      .eq('kind', 'tester_invitation')
      .in('recipient_key', keys)
    for (const d of deliveries ?? [])
      deliveryByKey.set(d.recipient_key as string, {
        status: d.status as string,
        last_error_code: (d.last_error_code as string | null) ?? null,
      })
  }

  const inviterIds = Array.from(
    new Set(rows.map((r) => r.invited_by).filter(Boolean)),
  ) as string[]
  const inviterName = new Map<string, string>()
  if (inviterIds.length > 0) {
    const { data: inviters } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', inviterIds)
    for (const p of inviters ?? [])
      inviterName.set(p.id as string, (p.full_name as string) ?? 'Admin')
  }

  return {
    invitations: rows.map((row) => ({
      ...row,
      status: effectiveStatus(row),
      email_delivery: deliveryByKey.get(`${row.id}:${row.send_count}`) ?? null,
      invited_by_name: row.invited_by
        ? (inviterName.get(row.invited_by) ?? null)
        : null,
    })),
    total: count ?? 0,
  }
}
