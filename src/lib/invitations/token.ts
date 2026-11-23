import { createHash, randomBytes } from 'node:crypto'

// No project imports on purpose: unit-tested with `node --test`. Server use only.
//
// The invitation secret is 32 random bytes (256 bits, base64url = 43 characters). Only its
// SHA-256 hash is stored, so the database never holds a usable link. It travels in the
// URL FRAGMENT (#token=...), which browsers do not send to servers, so it is not in access
// logs or Referer headers, and email link scanners that merely fetch the page cannot use
// it up.

export function generateInviteToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function looksLikeInviteToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value)
}
