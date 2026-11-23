// No imports on purpose: unit-tested with `node --test`.
//
// Rules for "forgot password". The security properties, in one place:
//  * NO ACCOUNT ENUMERATION: the answer to "send me a reset link" is the same sentence whether or not
//    the address has an account, and takes about the same time (see withMinimumDuration).
//  * Only a CONFIRMED account can be recovered. An account that was invited but never accepted is
//    unconfirmed, so password recovery can never be used to walk around an invitation (revoked,
//    expired or not yet accepted).
//  * At most ONE reset email per address per cooldown window, decided by a database row so it holds
//    across server instances. Asking again inside the window does not create a new link, so it cannot
//    be used to keep killing a link the person is about to use.
//  * The token is Supabase's own one-time recovery token. This app never invents or stores one.

export const GENERIC_RECOVERY_MESSAGE =
  "If an account uses that email address, we've sent a link to reset its password. It can take a few minutes to arrive, so check your spam folder too."

export const RECOVERY_COOLDOWN_MS = 10 * 60 * 1000
// Every answer takes at least this long, so a slow path (sending an email) is not distinguishable
// from a fast one (no such account).
export const MIN_RECOVERY_RESPONSE_MS = 1500

const EMAIL_PATTERN =
  /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

// Returns the normalised address, or null when it is not a plausible email address. The shape of an
// address says nothing about whether an account exists, so rejecting a bad shape leaks nothing.
export function normalizeRecoveryEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const email = input.trim().toLowerCase()
  if (email.length < 5 || email.length > 254) return null
  if (CONTROL_CHARACTERS.test(email)) return null
  return EMAIL_PATTERN.test(email) ? email : null
}

// The one-time token Supabase returns for a recovery link. Anything that does not look like one is
// rejected before it is ever sent to Supabase.
export function looksLikeRecoveryToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,200}$/.test(value)
}

// Which accounts may be sent a reset link.
export function canRecoverAccount(
  facts: { confirmed: boolean } | null | undefined | 'unknown',
): boolean {
  if (!facts || facts === 'unknown') return false
  return facts.confirmed === true
}

// One bucket per address per cooldown window. Two requests in the same bucket map to the same key.
export function recoveryBucket(nowMs: number): number {
  return Math.floor(nowMs / RECOVERY_COOLDOWN_MS)
}

// Runs `work`, then waits so the whole call took at least `minimumMs`. Errors from `work` are
// swallowed on purpose: the caller must answer the same way whatever happened.
export async function withMinimumDuration(
  minimumMs: number,
  work: () => Promise<unknown>,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => number = () => Date.now(),
): Promise<void> {
  const started = now()
  try {
    await work()
  } catch {
    // see above
  }
  const remaining = minimumMs - (now() - started)
  if (remaining > 0) await sleep(remaining)
}
