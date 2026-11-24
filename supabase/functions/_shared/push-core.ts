// Pure Web Push logic shared by the Supabase Edge Function (Deno) and the Node unit tests.
// NO imports and NO runtime-specific APIs here, so the exact same file runs in both places.
// The Deno entry point (push-dispatch/index.ts) only adds the network, the database client and
// the encryption library.

// ------------------------------------------------------------------ categories
// Must match public.food4love_notification_category() in supabase-migration-web-push.sql
// (tests/push-core.test.mjs compares the two).
export const PUSH_CATEGORIES = [
  'messages',
  'matches',
  'bookings',
  'verification',
  'stories',
  'updates',
  'account',
  'test',
] as const
export type PushCategory = (typeof PUSH_CATEGORIES)[number]

// Categories a member can switch off individually (account + test only follow the master switch).
export const PUSH_TOGGLE_CATEGORIES = [
  'messages',
  'matches',
  'bookings',
  'verification',
  'stories',
  'updates',
] as const

// ------------------------------------------------------------------ safe destinations
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Every path a push may open. Anything else becomes /notifications.
const SAFE_PATH = [
  /^\/notifications$/,
  /^\/chat$/,
  /^\/chat\/[0-9a-f-]{36}$/i,
  /^\/matches$/,
  /^\/requests$/,
  /^\/bookings$/,
  /^\/bookings\/[0-9a-f-]{36}$/i,
  /^\/cook\/verification$/,
  /^\/cook\/[0-9a-f-]{36}$/i,
  /^\/swipe$/,
  /^\/settings$/,
  /^\/support$/,
]

export const DEFAULT_PUSH_URL = '/notifications'

// Returns a same-origin relative path from the allowlist, or the default. Rejects absolute URLs,
// protocol-relative "//host", backslashes, encoded tricks and anything not on the list.
export function safePushUrl(candidate: unknown): string {
  if (typeof candidate !== 'string') return DEFAULT_PUSH_URL
  const value = candidate.trim()
  if (!value.startsWith('/') || value.startsWith('//') || /[\\%\s]/.test(value))
    return DEFAULT_PUSH_URL
  const [path] = value.split(/[?#]/)
  return SAFE_PATH.some((rule) => rule.test(path)) ? path : DEFAULT_PUSH_URL
}

function readId(data: unknown, keys: string[]): string | null {
  if (!data || typeof data !== 'object') return null
  for (const key of keys) {
    const value = (data as Record<string, unknown>)[key]
    if (typeof value === 'string' && UUID.test(value)) return value
  }
  return null
}

// Same decisions as src/lib/notificationRoutes.ts notificationHref() (tests compare the two), plus
// a destination for every case so a tap always lands somewhere useful.
export function pushHref(
  type: string,
  data: unknown,
  role: string | null | undefined,
): string {
  const kind =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>).kind
      : undefined
  if (kind === 'verification' || kind === 'interest')
    return role === 'cook' ? '/cook/verification' : DEFAULT_PUSH_URL
  if (kind === 'interest_available') {
    const cookId = readId(data, ['cook_id'])
    return cookId ? `/cook/${cookId}` : '/swipe'
  }
  if (readId(data, ['support_thread_id'])) return '/support'
  const matchId = readId(data, ['match_id', 'matchId'])
  switch (type) {
    case 'match':
      return matchId ? `/chat/${matchId}` : '/matches'
    case 'message':
      return matchId ? `/chat/${matchId}` : '/chat'
    case 'like':
      return role === 'cook' ? '/requests' : '/matches'
    case 'request':
      return role === 'cook' ? '/requests' : DEFAULT_PUSH_URL
    case 'booking': {
      const bookingId = readId(data, ['booking_id', 'bookingId'])
      return bookingId ? `/bookings/${bookingId}` : '/bookings'
    }
    default:
      return DEFAULT_PUSH_URL
  }
}

// ------------------------------------------------------------------ payloads
// Notifications can show on a LOCKED screen, so the text is generic per category: never a name,
// message text, address, amount or anything from the notification row's title/body.
const COPY: Record<string, { title: string; body: string }> = {
  messages: {
    title: 'New message',
    body: 'You have a new message on Food4Love.',
  },
  match: { title: "It's a match!", body: 'Open Food4Love to say hello.' },
  like: {
    title: 'Someone likes you',
    body: 'Open Food4Love to see who.',
  },
  request: {
    title: 'New request',
    body: 'Someone would like to connect with you.',
  },
  bookings: {
    title: 'Booking update',
    body: 'There is an update on one of your bookings.',
  },
  interest_available: {
    title: 'Good news',
    body: 'A cook you were interested in can now be booked.',
  },
  verification: {
    title: 'Verification update',
    body: 'There is an update on your cook verification.',
  },
  stories: {
    title: 'Story activity',
    body: 'There is new activity on Food4Love stories.',
  },
  updates: { title: 'Food4Love', body: 'You have a new update.' },
  account: {
    title: 'Account security',
    body: 'There was a change to your Food4Love account. If this was not you, check it now.',
  },
  test: {
    title: 'Notifications are on',
    body: 'This device will now receive Food4Love notifications.',
  },
}

export interface PushPayload {
  v: 1
  id: string // notification id (the app marks it read when opened)
  title: string
  body: string
  url: string
  tag: string
  category: string
  silent: boolean
  badge: number | null
}

export interface ClaimedDelivery {
  delivery_id: string
  claim_token: string
  attempts: number
  category: string
  endpoint: string
  p256dh: string
  auth_secret: string
  notification_id: string
  notification_type: string
  notification_data: Record<string, unknown> | null
  recipient_role: string | null
  recipient_sound: boolean | null
  unread_count: number | null
}

export function buildPushPayload(row: ClaimedDelivery): PushPayload {
  const data = row.notification_data ?? {}
  const kind = typeof data.kind === 'string' ? data.kind : ''
  const copy =
    (kind === 'interest_available' && COPY.interest_available) ||
    (row.category === 'matches' && COPY[row.notification_type]) ||
    COPY[row.category] ||
    COPY.updates
  // one tag per conversation / booking, so repeats replace each other instead of stacking up
  const thread =
    readId(data, ['match_id', 'matchId']) ??
    readId(data, ['booking_id', 'bookingId']) ??
    row.notification_id
  return {
    v: 1,
    id: row.notification_id,
    title: copy.title,
    body: copy.body,
    url: safePushUrl(pushHref(row.notification_type, data, row.recipient_role)),
    tag: `f4l-${row.category}-${thread}`.slice(0, 64),
    category: row.category,
    silent: row.recipient_sound === false,
    badge:
      typeof row.unread_count === 'number' && row.unread_count >= 0
        ? Math.min(row.unread_count, 999)
        : null,
  }
}

// ------------------------------------------------------------------ delivery options
export interface PushOptions {
  ttl: number // seconds the push service keeps it for an offline device
  urgency: 'very-low' | 'low' | 'normal' | 'high'
  topic: string // a newer push with the same topic replaces an undelivered older one
}

export function pushOptionsFor(category: string): PushOptions {
  switch (category) {
    case 'messages':
      return { ttl: 3600, urgency: 'high', topic: 'messages' }
    case 'account':
      return { ttl: 86400, urgency: 'high', topic: 'account' }
    case 'bookings':
      return { ttl: 86400, urgency: 'high', topic: 'bookings' }
    case 'test':
      return { ttl: 600, urgency: 'high', topic: 'test' }
    default:
      return {
        ttl: 43200,
        urgency: 'normal',
        topic: /^[a-z]{1,32}$/.test(category) ? category : 'updates',
      }
  }
}

// ------------------------------------------------------------------ push service responses
export type PushOutcome = 'sent' | 'gone' | 'retry' | 'permanent'

// status = HTTP status from the push service, or null when the request never got an answer.
export function classifyPushResponse(status: number | null): PushOutcome {
  if (status === null) return 'retry' // network error / timeout
  if (status >= 200 && status < 300) return 'sent'
  if (status === 404 || status === 410) return 'gone'
  if (status === 429 || status === 408 || status >= 500) return 'retry'
  return 'permanent' // 400 bad request, 401/403 VAPID rejected, 413 too large
}

// ------------------------------------------------------------------ secrets
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const length = Math.max(a.length, b.length, 1)
  let diff = a.length ^ b.length
  for (let i = 0; i < length; i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

// ------------------------------------------------------------------ the worker loop
export interface DispatchDeps {
  claim: (limit: number) => Promise<ClaimedDelivery[]>
  complete: (
    row: ClaimedDelivery,
    outcome: PushOutcome,
    httpStatus: number | null,
    errorCode: string | null,
  ) => Promise<void>
  // resolves with the push service HTTP status, or null for a network failure; never throws
  send: (
    row: ClaimedDelivery,
    payload: PushPayload,
    options: PushOptions,
  ) => Promise<number | null>
  now: () => number
}

export interface DispatchResult {
  claimed: number
  sent: number
  gone: number
  retry: number
  permanent: number
  stoppedEarly: boolean
}

// Claims batches until the queue is empty or the time budget is used up. Each delivery is
// completed exactly once; a failure to record an outcome is left for the 5-minute reclaim.
export async function runDispatch(
  deps: DispatchDeps,
  { budgetMs = 40_000, batchSize = 50, concurrency = 10, maxBatches = 20 } = {},
): Promise<DispatchResult> {
  const started = deps.now()
  const result: DispatchResult = {
    claimed: 0,
    sent: 0,
    gone: 0,
    retry: 0,
    permanent: 0,
    stoppedEarly: false,
  }
  for (let batch = 0; batch < maxBatches; batch++) {
    if (deps.now() - started > budgetMs) {
      result.stoppedEarly = true
      break
    }
    const rows = await deps.claim(batchSize)
    if (rows.length === 0) break
    result.claimed += rows.length
    let next = 0
    const worker = async () => {
      while (next < rows.length) {
        const row = rows[next++]
        let status: number | null = null
        try {
          status = await deps.send(
            row,
            buildPushPayload(row),
            pushOptionsFor(row.category),
          )
        } catch {
          status = null
        }
        const outcome = classifyPushResponse(status)
        result[outcome]++
        try {
          await deps.complete(
            row,
            outcome,
            status,
            outcome === 'sent'
              ? null
              : status === null
                ? 'network'
                : `http_${status}`,
          )
        } catch {
          // left in 'sending'; claim() reclaims it after 5 minutes
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(concurrency, rows.length) }, worker),
    )
    if (rows.length < batchSize) break
  }
  return result
}
