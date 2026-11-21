// No imports on purpose: unit-tested with `node --test`, and shared by the admin routes,
// the public acceptance routes and the screens, so there is ONE definition of what a valid
// invitation is and what each account state means.
//
// SECURITY MODEL IN ONE PLACE
//   * A tester classification ("Beta Tester", "Cook Tester", ...) only DESCRIBES how
//     someone takes part in testing. It never grants an admin permission, never marks a
//     cook verified and never makes a cook bookable. Those stay with app_metadata.role,
//     profiles.kyc_status and the booking rules.
//   * The classification is stored in the invitation row and in the member's server-only
//     app_metadata. It is NOT put on `profiles`, which is publicly readable.

// ------------------------------------------------------------------- access types
export const ACCESS_TYPES = [
  {
    key: 'beta_tester',
    label: 'Beta Tester',
    profileRole: 'buyer',
    summary: 'A food lover trying Food4Love early.',
  },
  {
    key: 'regular_user',
    label: 'Regular User',
    profileRole: 'buyer',
    summary: 'A standard food-lover account.',
  },
  {
    key: 'cook_tester',
    label: 'Cook Tester',
    profileRole: 'cook',
    summary:
      'A home cook testing the cook side. Must still be verified to take bookings.',
  },
  {
    key: 'chef_tester',
    label: 'Chef Tester',
    profileRole: 'cook',
    summary:
      'A professional chef testing the cook side. Must still be verified to take bookings.',
  },
] as const

export type AccessType = (typeof ACCESS_TYPES)[number]['key']

export function isAccessType(value: unknown): value is AccessType {
  return ACCESS_TYPES.some((type) => type.key === value)
}

export function profileRoleFor(accessType: AccessType): 'buyer' | 'cook' {
  return ACCESS_TYPES.find((type) => type.key === accessType)!.profileRole
}

export function accessTypeLabel(accessType: string): string {
  return (
    ACCESS_TYPES.find((type) => type.key === accessType)?.label ?? accessType
  )
}

// -------------------------------------------------------------------- invitation status
export type InvitationStatus =
  'pending' | 'accepted' | 'expired' | 'revoked' | 'failed'

export const INVITATION_TTL_DAYS = 7

// "Pending" is only true until the expiry moment; nothing needs to run for that to change.
export function effectiveStatus(
  row: { status: string; expires_at: string },
  now: Date = new Date(),
): InvitationStatus {
  if (
    row.status === 'pending' &&
    new Date(row.expires_at).getTime() <= now.getTime()
  )
    return 'expired'
  return row.status as InvitationStatus
}

export const canResend = (status: InvitationStatus) =>
  status === 'pending' || status === 'failed' || status === 'expired'

export const canRevoke = (status: InvitationStatus) =>
  status === 'pending' || status === 'failed' || status === 'expired'

// How the invitation EMAIL is described to an admin. "Accepted" only means the email
// provider took the message; it is never worded as "delivered" (the provider's webhook
// is what can later say delivered or bounced).
export function describeEmailDelivery(
  sendCount: number,
  delivery: { status: string } | null | undefined,
): { tone: 'ok' | 'warn' | 'bad' | 'neutral'; label: string } {
  if (sendCount === 0) return { tone: 'neutral', label: 'Not sent' }
  if (!delivery) return { tone: 'neutral', label: 'Sent (not tracked)' }
  switch (delivery.status) {
    case 'delivered':
      return { tone: 'ok', label: 'Delivered' }
    case 'accepted':
      return { tone: 'neutral', label: 'Accepted by email provider' }
    case 'bounced':
      return { tone: 'bad', label: 'Bounced' }
    case 'failed':
      return { tone: 'bad', label: 'Send failed' }
    case 'queued':
    case 'processing':
      return { tone: 'warn', label: 'Sending…' }
    case 'cancelled':
      return { tone: 'neutral', label: 'Cancelled' }
    default:
      return { tone: 'neutral', label: 'Unknown' }
  }
}

// --------------------------------------------------------------- invitation input
export interface InviteInput {
  full_name: string
  email: string
  preferred_username: string | null
  access_type: AccessType
  personal_message: string | null
}

export type ValidationResult<T> =
  { ok: true; value: T } | { ok: false; errors: Record<string, string> }

const EMAIL_PATTERN =
  /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/
const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'root',
  'support',
  'help',
  'food4love',
  'moderator',
  'staff',
  'team',
  'system',
])

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function validateInviteInput(
  raw: unknown,
): ValidationResult<InviteInput> {
  const errors: Record<string, string> = {}
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<
    string,
    unknown
  >

  const fullName =
    typeof input.full_name === 'string'
      ? input.full_name.replace(/\s+/g, ' ').trim()
      : ''
  if (fullName.length < 2 || fullName.length > 100)
    errors.full_name = 'Enter the tester’s full name (2 to 100 characters).'
  else if (/[<>]/.test(fullName) || CONTROL_CHARACTERS.test(fullName))
    errors.full_name = 'The name contains characters that are not allowed.'

  const email = normalizeEmail(input.email)
  if (!email) errors.email = 'Enter an email address.'
  else if (
    email.length > 254 ||
    !EMAIL_PATTERN.test(email) ||
    email.includes('..')
  )
    errors.email = 'Enter a valid email address.'

  let username: string | null = null
  if (
    typeof input.preferred_username === 'string' &&
    input.preferred_username.trim()
  ) {
    const candidate = input.preferred_username
      .trim()
      .toLowerCase()
      .replace(/^@/, '')
    if (!USERNAME_PATTERN.test(candidate))
      errors.preferred_username =
        'Use 3 to 30 letters, numbers, dots, dashes or underscores, starting and ending with a letter or number.'
    else if (RESERVED_USERNAMES.has(candidate))
      errors.preferred_username = 'That username is reserved. Choose another.'
    else username = candidate
  }

  if (!isAccessType(input.access_type))
    errors.access_type = 'Choose an account access type.'

  let message: string | null = null
  if (
    typeof input.personal_message === 'string' &&
    input.personal_message.trim()
  ) {
    const text = input.personal_message.replace(/\s+/g, ' ').trim()
    if (text.length > 500)
      errors.personal_message = 'Keep the note under 500 characters.'
    else if (CONTROL_CHARACTERS.test(text))
      errors.personal_message =
        'The note contains characters that are not allowed.'
    else message = text
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      full_name: fullName,
      email,
      preferred_username: username,
      access_type: input.access_type as AccessType,
      personal_message: message,
    },
  }
}

// --------------------------------------------------------------------- password policy
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  'qwerty123',
  '1234567890',
  'iloveyou123',
  'food4love',
  'food4love123',
  'welcome123',
  'letmein123',
])

// The password is the person's own and is sent to Supabase Auth, which hashes it. This
// only rejects choices that are plainly too weak; it is not a substitute for Supabase's
// own rules (set the minimum length under Authentication → Providers → Email).
export function validatePassword(
  password: unknown,
  context: { email?: string; fullName?: string } = {},
): { ok: true } | { ok: false; message: string } {
  if (typeof password !== 'string')
    return { ok: false, message: 'Enter a password.' }
  if (password.length < 10)
    return { ok: false, message: 'Use at least 10 characters.' }
  if (password.length > 128)
    return { ok: false, message: 'Use at most 128 characters.' }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
    return { ok: false, message: 'Include at least one letter and one number.' }
  const lowered = password.toLowerCase()
  if (COMMON_PASSWORDS.has(lowered))
    return {
      ok: false,
      message: 'That password is too common. Choose another.',
    }
  const localPart = (context.email ?? '').split('@')[0]?.toLowerCase()
  if (localPart && localPart.length >= 4 && lowered.includes(localPart))
    return {
      ok: false,
      message: 'Do not include your email address in your password.',
    }
  return { ok: true }
}

// ---------------------------------------------------------- what is already on file
export interface AuthUserFacts {
  id: string
  // email confirmed or ever signed in: a real, used account
  confirmed: boolean
  signedInBefore: boolean
  hasProfile: boolean
}

export interface InviteTargetFacts {
  // an unexpired pending invitation for this email, if any
  pendingInvitation: { id: string } | null
  // the most recent invitation that is no longer pending (failed / expired / revoked)
  priorInvitation: { id: string; status: InvitationStatus } | null
  // null = no auth user; 'unknown' = could not be looked up (lookup function missing)
  authUser: AuthUserFacts | null | 'unknown'
  usernameTaken: boolean
}

export type InviteTargetDecision =
  | {
      ok: true
      // reuse an existing unused auth user created by an earlier attempt
      adoptAuthUserId: string | null
      // continue an existing failed/expired/revoked invitation row instead of adding a duplicate
      reuseInvitationId: string | null
      note: string | null
    }
  | { ok: false; code: InviteBlockCode; message: string; invitationId?: string }

export type InviteBlockCode =
  'pending_invitation' | 'existing_account' | 'username_taken'

// What may happen when an admin invites this address? Account states, in order of how
// final they are. Only authorised admins ever see these messages.
export function decideInviteTarget(
  facts: InviteTargetFacts,
): InviteTargetDecision {
  if (facts.pendingInvitation)
    return {
      ok: false,
      code: 'pending_invitation',
      message:
        'This email already has a pending invitation. Use Resend in the table below instead of inviting again.',
      invitationId: facts.pendingInvitation.id,
    }

  const user = facts.authUser
  if (user && user !== 'unknown' && (user.confirmed || user.signedInBefore))
    return {
      ok: false,
      code: 'existing_account',
      message:
        'This email already belongs to a Food4Love account. Their access is unchanged. Nothing was sent and no password was reset.',
    }

  if (facts.usernameTaken)
    return {
      ok: false,
      code: 'username_taken',
      message:
        'That username is already used by another invitation. Choose another.',
    }

  let note: string | null = null
  let adopt: string | null = null
  if (user && user !== 'unknown') {
    // An auth user exists but nobody ever used it: left behind by an earlier invitation or
    // an interrupted signup. Reuse it instead of creating a second one.
    adopt = user.id
    note = user.hasProfile
      ? 'An unused account for this email was left over from an earlier attempt and will be reused.'
      : 'An unused account without a profile was found for this email; the profile will be completed when they accept.'
  }

  const prior = facts.priorInvitation
  return {
    ok: true,
    adoptAuthUserId: adopt,
    reuseInvitationId: prior ? prior.id : null,
    note,
  }
}

// --------------------------------------------------------------- Supabase Auth errors
// The old route turned EVERY failure into "the email may already be registered". These
// are the real, different causes, so the admin can act on them.
export interface AuthErrorLike {
  code?: string | null
  status?: number | null
  message?: string | null
}

export type AuthFailureCode =
  | 'existing_account'
  | 'email_rate_limited'
  | 'email_invalid'
  | 'email_not_authorized'
  | 'signups_disabled'
  | 'profile_trigger_failed'
  | 'email_send_failed'
  | 'redirect_not_allowed'
  | 'user_banned'
  | 'service_unavailable'
  | 'unknown'

export interface ClassifiedAuthError {
  code: AuthFailureCode
  message: string
  httpStatus: number
  retryable: boolean
}

export function classifyAuthError(
  error: AuthErrorLike | null | undefined,
): ClassifiedAuthError {
  const code = (error?.code ?? '').toString()
  const status = error?.status ?? 0
  const message = (error?.message ?? '').toString()

  if (
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    /already (been )?registered|already exists/i.test(message)
  )
    return {
      code: 'existing_account',
      message: 'An account with this email already exists.',
      httpStatus: 409,
      retryable: false,
    }
  if (code === 'over_email_send_rate_limit' || status === 429)
    return {
      code: 'email_rate_limited',
      message:
        'Supabase is rate-limiting authentication emails right now. Wait a few minutes and try again.',
      httpStatus: 429,
      retryable: true,
    }
  if (code === 'email_address_invalid')
    return {
      code: 'email_invalid',
      message: 'Supabase rejected this email address as invalid.',
      httpStatus: 400,
      retryable: false,
    }
  if (code === 'email_address_not_authorized')
    return {
      code: 'email_not_authorized',
      message:
        'Supabase will only email project members until custom SMTP is configured. Set up SMTP in the Supabase dashboard.',
      httpStatus: 400,
      retryable: false,
    }
  if (code === 'signup_disabled')
    return {
      code: 'signups_disabled',
      message: 'New signups are disabled in the Supabase Auth settings.',
      httpStatus: 403,
      retryable: false,
    }
  if (code === 'user_banned')
    return {
      code: 'user_banned',
      message: 'This account has been banned in Supabase Auth.',
      httpStatus: 403,
      retryable: false,
    }
  if (/database error (saving|creating) new user/i.test(message))
    return {
      code: 'profile_trigger_failed',
      message:
        'Supabase could not create the account because the database signup trigger failed. Check the profile-creation trigger.',
      httpStatus: 502,
      retryable: false,
    }
  if (
    /error sending (invite|confirmation|magic ?link|recovery) email/i.test(
      message,
    )
  )
    return {
      code: 'email_send_failed',
      message:
        'Supabase could not send its email. Check the SMTP settings in the Supabase dashboard.',
      httpStatus: 502,
      retryable: true,
    }
  if (code === 'redirect_url_not_allowed' || /redirect/i.test(message))
    return {
      code: 'redirect_not_allowed',
      message:
        'The redirect URL is not on the allow-list. Add it under Authentication → URL Configuration.',
      httpStatus: 502,
      retryable: false,
    }
  if (status >= 500 || status === 0)
    return {
      code: 'service_unavailable',
      message: 'Supabase Auth is not responding. Try again shortly.',
      httpStatus: 502,
      retryable: true,
    }
  return {
    code: 'unknown',
    message: `Supabase Auth returned an unexpected error${code ? ` (${code.slice(0, 60)})` : ''}.`,
    httpStatus: 502,
    retryable: false,
  }
}
