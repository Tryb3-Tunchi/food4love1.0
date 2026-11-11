// No imports on purpose: unit-tested with `node --test`.
export const FRESH_CONFIRMATION_MS = 15 * 60 * 1000

// True only when the address was confirmed in the last 15 minutes. This keeps an
// older account that happens to sign in through the callback (magic link, a
// repeat visit) from receiving a "welcome" it should have had long ago.
export function isFreshConfirmation(
  confirmedAt: string | null | undefined,
  now = Date.now(),
) {
  if (!confirmedAt) return false
  const confirmed = new Date(confirmedAt).getTime()
  if (!Number.isFinite(confirmed)) return false
  const age = now - confirmed
  return age >= 0 && age <= FRESH_CONFIRMATION_MS
}
