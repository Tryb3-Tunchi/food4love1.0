// No framework imports on purpose: unit-tested with `node --test`.
//
// Authentication for scheduled jobs (Vercel Cron, a GitHub Actions schedule, a Supabase
// pg_cron + pg_net call: anything that can send one HTTP header).
//
// The caller proves itself with a shared secret in `Authorization: Bearer <secret>`.
// Vercel sends exactly this header by itself when a project environment variable named
// CRON_SECRET exists. Rules:
//  * FAIL CLOSED: no secret configured, or one that is too short to be a real secret,
//    means every call is refused. A forgotten variable can never become an open endpoint.
//  * The secret is only ever read from the header, never from the URL (URLs end up in logs).
//  * The comparison does not leak how many characters matched: both sides are hashed to the
//    same length, then compared in constant time.
import { createHash, timingSafeEqual } from 'node:crypto'

// 32 characters is the floor for a hand-typed secret; `openssl rand -hex 32` gives 64.
export const MIN_CRON_SECRET_LENGTH = 32

export type CronAuthResult = 'ok' | 'not_configured' | 'unauthorized'

export function verifyCronRequest(
  authorizationHeader: string | null | undefined,
  secret: string | null | undefined,
): CronAuthResult {
  const configured = (secret ?? '').trim()
  if (configured.length < MIN_CRON_SECRET_LENGTH) return 'not_configured'

  const match = /^Bearer ([^\s]+)$/.exec((authorizationHeader ?? '').trim())
  if (!match) return 'unauthorized'

  const given = createHash('sha256').update(match[1]).digest()
  const wanted = createHash('sha256').update(configured).digest()
  return timingSafeEqual(given, wanted) ? 'ok' : 'unauthorized'
}
