// Browser-side Web Push glue. Talks to the existing service worker (/sw.js, registered by
// PwaProvider) and to /api/push/subscriptions. No second service worker is ever registered.

import {
  type PushEnvironment,
  base64UrlToUint8Array,
  deviceLabel,
  detectPushSupport,
  platformFromUserAgent,
} from '@/lib/push/support'
import { pushPublicKeyFor } from '@/lib/push/publicKeys'

// The project's public key, chosen from the Supabase project this build talks to (see
// publicKeys.ts). No Vercel setting is involved; an unknown project gets no key (fails closed).
export const VAPID_PUBLIC_KEY =
  pushPublicKeyFor(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? ''

// Is this build's public key usable? 'missing' = this build talks to a Supabase project that has
// no Food4Love push key; 'invalid' = the stored key is not a 65-byte P-256 key.
export function pushKeyStatus(): 'ok' | 'missing' | 'invalid' {
  if (!VAPID_PUBLIC_KEY) return 'missing'
  try {
    const bytes = base64UrlToUint8Array(VAPID_PUBLIC_KEY)
    return bytes.length === 65 && bytes[0] === 4 ? 'ok' : 'invalid'
  } catch {
    return 'invalid'
  }
}

// When the service worker last DISPLAYED a Food4Love push on this device (it records this after
// showNotification succeeds). This is the only evidence of display the browser gives us; a row in
// the in-app bell proves nothing about the device.
export const PUSH_DIAGNOSTICS_CACHE = 'food4love-push-diagnostics'
export const LAST_SHOWN_PATH = '/__f4l/push-last-shown'
export async function lastPushShownOnThisDevice(): Promise<{
  at: string
  id: string | null
} | null> {
  try {
    if (typeof caches === 'undefined') return null
    const cache = await caches.open(PUSH_DIAGNOSTICS_CACHE)
    const hit = await cache.match(LAST_SHOWN_PATH)
    if (!hit) return null
    const body = (await hit.json()) as { at?: unknown; id?: unknown }
    return typeof body.at === 'string'
      ? { at: body.at, id: typeof body.id === 'string' ? body.id : null }
      : null
  } catch {
    return null
  }
}
// Which account this browser's subscription was registered for, and its device row id.
const OWNER_KEY = 'food4love-push-owner'
const DEVICE_KEY = 'food4love-push-device-id'

export function readEnvironment(): PushEnvironment {
  const nav = navigator as Navigator & { standalone?: boolean }
  return {
    secureContext: window.isSecureContext,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : null,
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean(nav.standalone),
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    platform: navigator.platform ?? '',
  }
}

export function pushSupport() {
  if (typeof window === 'undefined') return 'unsupported' as const
  return detectPushSupport(readEnvironment())
}

function store(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // private mode: the server still knows the device; only the "this device" hint is lost
  }
}
export function currentDeviceId(): string | null {
  try {
    return window.localStorage.getItem(DEVICE_KEY)
  } catch {
    return null
  }
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing) return existing
  // PwaProvider registers /sw.js in production builds; wait briefly for it
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ])
}

export async function browserSubscription(): Promise<PushSubscription | null> {
  const reg = await registration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

function sameKey(subscription: PushSubscription, key: Uint8Array) {
  const current = subscription.options?.applicationServerKey
  if (!current) return true // browser does not tell us: assume it matches
  const bytes = new Uint8Array(current)
  return bytes.length === key.length && bytes.every((b, i) => b === key[i])
}

async function sendToServer(subscription: PushSubscription) {
  const env = readEnvironment()
  const response = await fetch('/api/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      label: deviceLabel(env),
      platform: platformFromUserAgent(env),
      installed: env.standalone,
    }),
  })
  const result = (await response.json().catch(() => ({}))) as {
    id?: string
    error?: string
    code?: string
  }
  if (!response.ok || !result.id)
    throw new RegistrationError(
      result.error ?? 'Could not turn on notifications',
      result.code ?? `http_${response.status}`,
    )
  return result.id
}

class RegistrationError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

export type EnableResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | 'denied'
        | 'dismissed'
        | 'unavailable'
        | 'key_missing'
        | 'key_invalid'
        | 'not_enrolled'
        | 'failed'
      message?: string
    }

// MUST be called straight from a click/tap handler: requestPermission() is the first await so the
// browser still sees the member's gesture (Safari refuses the prompt otherwise).
export async function enablePush(userId: string): Promise<EnableResult> {
  const keyStatus = pushKeyStatus()
  if (keyStatus === 'missing') return { ok: false, reason: 'key_missing' }
  if (keyStatus === 'invalid') return { ok: false, reason: 'key_invalid' }
  const permission = await Notification.requestPermission()
  if (permission === 'denied') return { ok: false, reason: 'denied' }
  if (permission !== 'granted') return { ok: false, reason: 'dismissed' }
  try {
    const reg = await registration()
    if (!reg) return { ok: false, reason: 'unavailable' }
    const key = base64UrlToUint8Array(VAPID_PUBLIC_KEY)
    let subscription = await reg.pushManager.getSubscription()
    // a subscription made for another key (key rotation, staging vs production) cannot be used
    if (subscription && !sameKey(subscription, key)) {
      await subscription.unsubscribe().catch(() => undefined)
      subscription = null
    }
    subscription ??= await reg.pushManager.subscribe({
      userVisibleOnly: true, // required by Chrome and Safari: every push shows a notification
      applicationServerKey: key,
    })
    const deviceId = await sendToServer(subscription)
    store(DEVICE_KEY, deviceId)
    store(OWNER_KEY, userId)
    return { ok: true }
  } catch (error) {
    if (error instanceof RegistrationError && error.code === 'not_enrolled')
      return { ok: false, reason: 'not_enrolled', message: error.message }
    return {
      ok: false,
      reason: 'failed',
      message: error instanceof Error ? error.message : undefined,
    }
  }
}

// Re-registers this browser's EXISTING subscription for the signed-in member, without asking for
// permission again. Used when the server no longer knows this device (it expired and was removed,
// or it was removed from another device) while the browser still holds a valid subscription.
export async function resyncThisDevice(userId: string): Promise<boolean> {
  if (pushKeyStatus() !== 'ok') return false
  if (
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted'
  )
    return false
  const subscription = await browserSubscription().catch(() => null)
  if (
    !subscription ||
    !sameKey(subscription, base64UrlToUint8Array(VAPID_PUBLIC_KEY))
  )
    return false
  try {
    const deviceId = await sendToServer(subscription)
    store(DEVICE_KEY, deviceId)
    store(OWNER_KEY, userId)
    return true
  } catch {
    return false
  }
}

// Turns push off on THIS device: removes the server row, then kills the browser subscription
// (so even a missed server call ends delivery: the push service answers 410 and the row is purged).
export async function disablePush(): Promise<void> {
  const deviceId = currentDeviceId()
  if (deviceId)
    await fetch(`/api/push/subscriptions/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    }).catch(() => undefined)
  const subscription = await browserSubscription().catch(() => null)
  await subscription?.unsubscribe().catch(() => undefined)
  store(DEVICE_KEY, null)
  store(OWNER_KEY, null)
}

// Called on every auth change. A browser subscription registered for a different (or no) account
// is dropped, so after sign-out or an account switch this device stops receiving the previous
// member's notifications even though the session (and so the API) is already gone.
export async function dropSubscriptionIfNotOwnedBy(userId: string | null) {
  let owner: string | null = null
  try {
    owner = window.localStorage.getItem(OWNER_KEY)
  } catch {
    owner = null
  }
  if (owner === null || owner === userId) return
  const subscription = await browserSubscription().catch(() => null)
  await subscription?.unsubscribe().catch(() => undefined)
  // the previous account's "last displayed" marker must not show up for the next account
  if (typeof caches !== 'undefined')
    await caches.delete(PUSH_DIAGNOSTICS_CACHE).catch(() => false)
  store(DEVICE_KEY, null)
  store(OWNER_KEY, null)
}

// Once a day at most, when the signed-in OWNER of this browser's subscription opens Food4Love:
// re-send the existing subscription so the server keeps the device marked as in use (cleanup
// removes devices unseen for 120 days) and re-registers it if the server no longer knows it.
// Never prompts, never subscribes a browser that has not opted in, never acts for another account.
const REFRESHED_KEY = 'food4love-push-refreshed-at'
export async function refreshOwnDevice(userId: string | null): Promise<void> {
  if (!userId) return
  try {
    if (window.localStorage.getItem(OWNER_KEY) !== userId) return
    const last = Number(window.localStorage.getItem(REFRESHED_KEY) ?? 0)
    if (Date.now() - last < 24 * 60 * 60 * 1000) return
    if (await resyncThisDevice(userId))
      window.localStorage.setItem(REFRESHED_KEY, String(Date.now()))
  } catch {
    // best effort: the settings page still shows the device state
  }
}
