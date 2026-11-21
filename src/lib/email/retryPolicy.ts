// No imports on purpose: unit-tested with `node --test`.
//
// How long to wait before trying a failed email again, and when to stop trying.
// The processor stores the answer in email_deliveries.next_attempt_at, so a "scheduled
// for retry" email survives a server restart: the schedule is data, not a timer.
//
// The rules, in one place:
//  * Bounded exponential backoff: 5 min, 10, 20, 40 ... never more than `maxMs`.
//  * Jitter: every delay is shortened by a random 0-50%, so a provider outage that failed a
//    hundred emails at once does not bring a hundred retries back in the same second.
//    The cap is applied BEFORE jitter, so no delay ever exceeds `maxMs`.
//  * A hard limit on attempts (`maxAttempts`). After that the email is given up on.
//  * Not every failure deserves a retry (see classifyFailure): a request the provider
//    rejected as invalid will be rejected again, so it stops at once; a provider that is
//    refusing OUR credentials needs a person, so it waits at the cap instead of burning
//    through the attempts in an hour.
//  * A provider's own "retry after" request (HTTP 429) is honoured, within the cap.
//  * Giving up is DATA: a failed row with no next_attempt_at is finished (see isRetryDue).
//
// Protection against two workers sending the same email lives elsewhere, on purpose: the
// worker claims a row with a compare-and-swap update (interestEmails.ts), and the send
// carries a stable Idempotency-Key (transactional.ts). This file only decides timing.

export interface RetryPolicy {
  maxAttempts: number
  baseMs: number
  maxMs: number
  // Fraction of each delay that may be randomly removed: 0 = no jitter, 0.5 = delay lands
  // between 50% and 100% of the backoff, 1 = anywhere from 0 to 100% ("full jitter").
  jitter: number
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseMs: 5 * 60 * 1000, // 5 minutes
  maxMs: 6 * 60 * 60 * 1000, // never wait longer than 6 hours
  jitter: 0.5,
}

// What a failed send tells us about whether trying again can help.
//   permanent: the provider judged the request itself unacceptable (bad address, bad
//              payload). The same request will fail again, so stop.
//   config:    the provider refused our credentials or domain (401/403). Not the email's
//              fault and not fixed by waiting minutes: retry only at the slow cap.
//   transient: timeouts, network errors, 429, 5xx, a duplicate in flight (409), or anything
//              we do not recognise. Back off and try again.
export type FailureKind = 'permanent' | 'config' | 'transient'

const PERMANENT_STATUSES = new Set([400, 404, 405, 413, 422])
const CONFIG_STATUSES = new Set([401, 403])

// `errorCode` is what transactional.ts stores in last_error_code: "http_422", "timeout",
// "network", "processing_error" ... Unknown codes are transient: when in doubt, retry
// (the attempt limit keeps that bounded).
export function classifyFailure(errorCode: string | null | undefined) {
  const match = /^http_(\d{3})$/.exec(errorCode ?? '')
  if (!match) return 'transient' as FailureKind
  const status = Number(match[1])
  if (PERMANENT_STATUSES.has(status)) return 'permanent' as FailureKind
  if (CONFIG_STATUSES.has(status)) return 'config' as FailureKind
  return 'transient' as FailureKind
}

export interface RetryOptions {
  policy?: RetryPolicy
  // The stored error code of the attempt that just failed (decides retry or stop).
  errorCode?: string | null
  // The provider's own "try again in" hint, in ms (from a Retry-After header).
  retryAfterMs?: number | null
  // Returns a number in [0, 1). Injected by tests so they are deterministic.
  random?: () => number
}

// `attemptsMade` is how many sends have already failed (1 after the first failure).
// Returns the delay in milliseconds before the next attempt, or null to give up.
export function retryDelayMs(
  attemptsMade: number,
  options: RetryOptions = {},
): number | null {
  const policy = options.policy ?? DEFAULT_RETRY_POLICY
  const random = options.random ?? Math.random

  if (!Number.isFinite(attemptsMade)) return null
  if (attemptsMade >= policy.maxAttempts) return null

  const kind = classifyFailure(options.errorCode)
  if (kind === 'permanent') return null

  // Backoff ceiling for this attempt (config problems always wait the full cap).
  const exponent = Math.min(Math.max(0, attemptsMade - 1), 30) // 2 ** 30 stays exact
  const ceiling =
    kind === 'config'
      ? policy.maxMs
      : Math.min(policy.baseMs * 2 ** exponent, policy.maxMs)

  // Jitter removes up to `jitter` of the ceiling. Clamp the random source so a faulty
  // value (NaN, negative, >= 1) can never push the delay outside [ceiling*(1-jitter), ceiling].
  const jitter = Math.min(Math.max(policy.jitter, 0), 1)
  const drawn = random()
  const r = Number.isFinite(drawn) ? Math.min(Math.max(drawn, 0), 1) : 0
  let delay = Math.round(ceiling * (1 - jitter * r))

  // Honour the provider's request, but never past our own cap.
  const hint = options.retryAfterMs
  if (typeof hint === 'number' && Number.isFinite(hint) && hint > delay) {
    delay = Math.min(Math.round(hint), policy.maxMs)
  }
  return delay
}

// Parses an HTTP Retry-After header (seconds, or an HTTP date) into milliseconds.
export function parseRetryAfterMs(
  header: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!header) return null
  const trimmed = header.trim()
  if (/^\d+$/.test(trimmed)) return Math.min(Number(trimmed), 86_400) * 1000
  const at = Date.parse(trimmed)
  if (Number.isNaN(at)) return null
  return Math.max(0, at - now.getTime())
}

// True when a failed/queued delivery may be attempted now.
//   * queued with no time set: due now.
//   * a time set: due once it has passed.
//   * FAILED with no time set: the policy gave up on it (permanent failure or attempts
//     used up), so it is never due again.
export function isRetryDue(
  row: { status?: string | null; next_attempt_at?: string | null },
  now: Date = new Date(),
): boolean {
  if (!row.next_attempt_at) return row.status !== 'failed'
  const due = new Date(row.next_attempt_at).getTime()
  return Number.isFinite(due) && due <= now.getTime()
}
