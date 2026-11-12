// Browser-side analytics helper. Privacy rules enforced here:
//  - NOTHING is stored or sent until the visitor presses "Accept".
//  - "Decline" is remembered and every identifier is deleted.
//  - Only random first-party ids are used (no fingerprinting).
//  - Only the URL path is sent, never the query string or fragment.

export const CONSENT_KEY = 'food4love-analytics-consent-v1'
export const CONSENT_EVENT = 'food4love-consent-change'
const VISITOR_KEY = 'food4love-vid'
const SESSION_KEY = 'food4love-sid'
const SESSION_IDLE_MS = 30 * 60 * 1000
const VISITOR_MAX_AGE_MS = 395 * 24 * 60 * 60 * 1000

export type Consent = 'accepted' | 'declined' | null
export type AnalyticsEventName =
  | 'page_view'
  | 'waitlist_signup'
  | 'signup_complete'
  | 'profile_complete'
  | 'cook_profile_view'
  | 'story_view'
  | 'story_save'
  | 'booking_request'

interface SessionState {
  id: string
  last: number
  returning: boolean
  referrerHost: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  hasRef: boolean
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage blocked: analytics simply stays off for this browser.
  }
}

function remove(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function uuid(): string {
  const webCrypto: Crypto | undefined =
    typeof crypto === 'undefined' ? undefined : crypto
  // Older browsers have getRandomValues but not randomUUID.
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (webCrypto) webCrypto.getRandomValues(bytes)
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function getConsent(): Consent {
  if (typeof window === 'undefined') return null
  const value = read(CONSENT_KEY)
  return value === 'accepted' || value === 'declined' ? value : null
}

export function setConsent(value: 'accepted' | 'declined') {
  write(CONSENT_KEY, value)
  if (value === 'declined') {
    remove(VISITOR_KEY)
    remove(SESSION_KEY)
  }
  window.dispatchEvent(new Event(CONSENT_EVENT))
}

function visitorId(): { id: string; existed: boolean } {
  const raw = read(VISITOR_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { id?: string; created?: number }
      if (
        parsed.id &&
        typeof parsed.created === 'number' &&
        Date.now() - parsed.created < VISITOR_MAX_AGE_MS
      ) {
        return { id: parsed.id, existed: true }
      }
    } catch {
      // fall through and issue a new id
    }
  }
  const id = uuid()
  write(VISITOR_KEY, JSON.stringify({ id, created: Date.now() }))
  return { id, existed: false }
}

function referrerHostOnly(): string | null {
  try {
    if (!document.referrer) return null
    return new URL(document.referrer).hostname.toLowerCase() || null
  } catch {
    return null
  }
}

function session(): { state: SessionState; visitor: string } {
  const visitor = visitorId()
  const now = Date.now()
  const raw = read(SESSION_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SessionState
      if (parsed.id && now - parsed.last < SESSION_IDLE_MS) {
        parsed.last = now
        write(SESSION_KEY, JSON.stringify(parsed))
        return { state: parsed, visitor: visitor.id }
      }
    } catch {
      // start a new session
    }
  }
  const params = new URLSearchParams(window.location.search)
  const state: SessionState = {
    id: uuid(),
    last: now,
    returning: visitor.existed,
    referrerHost: referrerHostOnly(),
    utmSource: params.get('utm_source'),
    utmMedium: params.get('utm_medium'),
    utmCampaign: params.get('utm_campaign'),
    // We only note THAT a referral link was used, never the code itself.
    hasRef: params.has('ref'),
  }
  write(SESSION_KEY, JSON.stringify(state))
  return { state, visitor: visitor.id }
}

function device(): 'mobile' | 'tablet' | 'desktop' {
  const width = window.innerWidth
  return width < 768 ? 'mobile' : width < 1100 ? 'tablet' : 'desktop'
}

function post(body: Record<string, unknown>) {
  void fetch('/api/analytics/collect', {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      'x-f4l-consent': 'accepted',
    },
    body: JSON.stringify(body),
  }).catch(() => {
    // Analytics must never break the site.
  })
}

function basePayload() {
  const { state, visitor } = session()
  return {
    visitor_id: visitor,
    session_id: state.id,
    path: window.location.pathname,
    referrer_host: state.referrerHost,
    utm_source: state.utmSource,
    utm_medium: state.utmMedium,
    utm_campaign: state.utmCampaign,
    has_ref: state.hasRef,
    is_returning: state.returning,
    device: device(),
  }
}

const recent = new Map<string, number>()

export function track(name: AnalyticsEventName) {
  if (typeof window === 'undefined' || getConsent() !== 'accepted') return
  // The same event on the same page within 2 seconds is a duplicate
  // (e.g. React re-running an effect), not a second visit.
  const key = `${name}:${window.location.pathname}`
  const now = Date.now()
  if (now - (recent.get(key) ?? 0) < 2000) return
  recent.set(key, now)
  post({ type: 'event', name, client_event_id: uuid(), ...basePayload() })
}

export function heartbeat() {
  if (typeof window === 'undefined' || getConsent() !== 'accepted') return
  post({ type: 'heartbeat', ...basePayload() })
}
