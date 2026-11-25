// Validation for browser push subscriptions sent to /api/push/subscriptions.
// Pure (no imports) so it is unit-tested with `node --test`.
//
// WHY THE HOST ALLOWLIST MATTERS: the Edge Function POSTs to whatever endpoint is stored. Without
// this check a member could register "https://internal-service/..." and make our infrastructure
// send requests there. Only the real browser push services are accepted.

const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge (Android), Samsung Internet, Opera, Brave
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/, // Safari on iOS/iPadOS 16.4+ and macOS
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/, // Edge on Windows (WNS)
]

const B64URL = /^[A-Za-z0-9_-]+$/

export const PLATFORMS = [
  'android',
  'ios',
  'windows',
  'macos',
  'linux',
  'chromeos',
  'other',
] as const
export type PushPlatform = (typeof PLATFORMS)[number]

export interface ValidSubscription {
  endpoint: string
  p256dh: string
  auth: string
  oldEndpoint: string | null
  label: string
  platform: PushPlatform
  installed: boolean
}

export function isAllowedPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 1024) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return (
    url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    url.port === '' &&
    url.pathname.length > 1 &&
    PUSH_HOSTS.some((rule) => rule.test(url.hostname))
  )
}

export function isValidP256dh(value: unknown): value is string {
  // 65-byte uncompressed P-256 point = 87 base64url chars (no padding), starts with 0x04 ("B")
  return (
    typeof value === 'string' &&
    B64URL.test(value) &&
    value.length === 87 &&
    value.startsWith('B')
  )
}

export function isValidAuthSecret(value: unknown): value is string {
  // 16 bytes = 22 base64url chars
  return typeof value === 'string' && B64URL.test(value) && value.length === 22
}

export function cleanLabel(value: unknown): string {
  if (typeof value !== 'string') return 'This device'
  // printable text only, collapsed, max 60 (matches the database check)
  const text = value
    .replace(/[^A-Za-z0-9À-ɏ ()._\-/]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, 60) || 'This device'
}

export function parseSubscriptionInput(
  body: unknown,
): { ok: true; value: ValidSubscription } | { ok: false; error: string } {
  if (!body || typeof body !== 'object')
    return { ok: false, error: 'invalid_body' }
  const input = body as Record<string, unknown>
  const sub = input.subscription as Record<string, unknown> | undefined
  const keys = sub?.keys as Record<string, unknown> | undefined
  if (!sub || !isAllowedPushEndpoint(sub.endpoint))
    return { ok: false, error: 'invalid_endpoint' }
  if (!keys || !isValidP256dh(keys.p256dh) || !isValidAuthSecret(keys.auth))
    return { ok: false, error: 'invalid_keys' }
  const oldEndpoint =
    input.oldEndpoint === undefined || input.oldEndpoint === null
      ? null
      : isAllowedPushEndpoint(input.oldEndpoint)
        ? input.oldEndpoint
        : undefined
  if (oldEndpoint === undefined)
    return { ok: false, error: 'invalid_old_endpoint' }
  const platform = PLATFORMS.includes(input.platform as PushPlatform)
    ? (input.platform as PushPlatform)
    : 'other'
  return {
    ok: true,
    value: {
      endpoint: sub.endpoint as string,
      p256dh: keys.p256dh as string,
      auth: keys.auth as string,
      oldEndpoint,
      label: cleanLabel(input.label),
      platform,
      installed: input.installed === true,
    },
  }
}
