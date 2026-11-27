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
import { useAuthStore } from '@/stores/useAuthStore'
import {
  ACTIVATION_TIMEOUTS,
  type ActivationResult,
  RegisterError,
  runActivation,
} from '@/lib/push/activation'

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

// The service worker registration, once a worker is ACTIVE (pushManager.subscribe() on an
// installing or waiting worker can hang). Bounded; null when there is none or it does not activate.
async function registration(
  timeoutMs = 4000,
): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  const timer = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), timeoutMs),
  )
  const existing = await Promise.race([
    navigator.serviceWorker.getRegistration('/').catch(() => undefined),
    timer,
  ])
  if (existing?.active) return existing
  // registering / installing / updating: navigator.serviceWorker.ready resolves once one is active
  return Promise.race([navigator.serviceWorker.ready, timer])
}

export async function browserSubscription(): Promise<PushSubscription | null> {
  const reg = await registration()
  if (!reg) return null
  return Promise.race([
    reg.pushManager.getSubscription().catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ])
}

function sameKey(subscription: PushSubscription, key: Uint8Array) {
  const current = subscription.options?.applicationServerKey
  if (!current) return true // browser does not tell us: assume it matches
  const bytes = new Uint8Array(current)
  return bytes.length === key.length && bytes.every((b, i) => b === key[i])
}

// expectedUserId: the server refuses (409 account_changed) when the session cookie that arrives
// belongs to another account, so a slow request can never register this browser to whoever is
// signed in by the time it lands.
async function sendToServer(
  subscription: PushSubscription,
  expectedUserId: string,
  signal?: AbortSignal,
  oldEndpoint?: string | null,
): Promise<string> {
  const env = readEnvironment()
  const response = await fetch('/api/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      label: deviceLabel(env),
      platform: platformFromUserAgent(env),
      installed: env.standalone,
      expectedUserId,
      ...(oldEndpoint && oldEndpoint !== subscription.endpoint
        ? { oldEndpoint }
        : {}),
    }),
  })
  const result = (await response.json().catch(() => ({}))) as {
    id?: string
    error?: string
    code?: string
  }
  if (!response.ok || !result.id)
    throw new RegisterError(
      result.code ?? `http_${response.status}`,
      response.status,
      result.error,
    )
  return result.id
}

export type EnableResult = ActivationResult

// Who started the last activation on this browser. Lets a later session finish a registration that
// the server refused or never received (for example while push was pilot-only), WITHOUT ever
// registering a browser on behalf of an account that did not opt in on it.
const PENDING_OWNER_KEY = 'food4love-push-pending-owner'
export const PUSH_REGISTERED_EVENT = 'food4love:push-registered'

function activationDeps(
  userId: string,
  onStage?: (stage: 'permission' | 'setting_up') => void,
) {
  const key = base64UrlToUint8Array(VAPID_PUBLIC_KEY)
  return {
    keyStatus: pushKeyStatus,
    permissionState: () =>
      typeof Notification === 'undefined' ? null : Notification.permission,
    requestPermission: () =>
      // older Safari: callback form only
      new Promise<string | undefined>((resolve) => {
        const answer = Notification.requestPermission(resolve)
        if (answer && typeof answer.then === 'function')
          answer.then(resolve, () => resolve(undefined))
      }),
    activeRegistration: () => registration(ACTIVATION_TIMEOUTS.service_worker),
    getSubscription: (reg: ServiceWorkerRegistration) =>
      reg.pushManager.getSubscription(),
    keyMatches: (sub: PushSubscription) => sameKey(sub, key),
    unsubscribe: (sub: PushSubscription) => sub.unsubscribe(),
    subscribe: (reg: ServiceWorkerRegistration) =>
      reg.pushManager.subscribe({
        userVisibleOnly: true, // required by Chrome and Safari: every push shows a notification
        applicationServerKey: key,
      }),
    register: (sub: PushSubscription, signal: AbortSignal) =>
      sendToServer(sub, userId, signal),
    isCurrentAccount: () => useAuthStore.getState().profile?.id === userId,
    beforeSubscribe: () => store(PENDING_OWNER_KEY, userId),
    onRegistered: (deviceId: string) => {
      store(DEVICE_KEY, deviceId)
      store(OWNER_KEY, userId)
      store(PENDING_OWNER_KEY, null)
    },
    onLateSuccess: () => {
      try {
        window.dispatchEvent(new Event(PUSH_REGISTERED_EVENT))
      } catch {
        // no window (tests)
      }
    },
    onStage,
    setTimer: (fn: () => void, ms: number) => setTimeout(fn, ms),
  }
}

// MUST be called straight from a click/tap handler: when permission is still needed,
// requestPermission() is the first browser call so the tap still counts (Safari requires it).
// One attempt at a time per page: a second tap while one is running gets 'in_progress'
// (no overlapping prompts or requests). Released when the attempt resolves; every step is bounded.
let attempt: Promise<EnableResult> | null = null
export async function enablePush(
  userId: string,
  onStage?: (stage: 'permission' | 'setting_up') => void,
): Promise<EnableResult> {
  if (attempt) return { ok: false, reason: 'in_progress' }
  attempt = runActivation(activationDeps(userId, onStage)).catch(
    (error: unknown): EnableResult => ({
      ok: false,
      reason: 'failed',
      message: error instanceof Error ? error.message : undefined,
    }),
  )
  try {
    return await attempt
  } finally {
    attempt = null
  }
}

// May this browser's existing subscription be (re)registered for userId without a tap?
// Only if THIS account owns it, or THIS account started the activation that never completed.
function mayRecoverFor(userId: string) {
  try {
    const owner = window.localStorage.getItem(OWNER_KEY)
    const pending = window.localStorage.getItem(PENDING_OWNER_KEY)
    return owner === userId || (owner === null && pending === userId)
  } catch {
    return false
  }
}

// Re-registers this browser's EXISTING subscription for the signed-in member, without asking for
// permission again and only when mayRecoverFor() allows it. Never subscribes a browser that has no
// subscription; bounded by the same time limits as activation.
export async function resyncThisDevice(userId: string): Promise<boolean> {
  if (pushKeyStatus() !== 'ok' || !mayRecoverFor(userId)) return false
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
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ACTIVATION_TIMEOUTS.server)
  try {
    const deviceId = await sendToServer(subscription, userId, controller.signal)
    activationDeps(userId).onRegistered(deviceId)
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
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
  store(PENDING_OWNER_KEY, null)
  await clearRenewal()
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
  let pending: string | null = null
  try {
    pending = window.localStorage.getItem(PENDING_OWNER_KEY)
  } catch {
    pending = null
  }
  const claimedBy = owner ?? pending
  if (claimedBy === null || claimedBy === userId) return
  const subscription = await browserSubscription().catch(() => null)
  await subscription?.unsubscribe().catch(() => undefined)
  // the previous account's "last displayed" marker must not show up for the next account
  if (typeof caches !== 'undefined')
    await caches.delete(PUSH_DIAGNOSTICS_CACHE).catch(() => false)
  store(DEVICE_KEY, null)
  store(OWNER_KEY, null)
  store(PENDING_OWNER_KEY, null)
}

// Rotation recorded by the service worker (pushsubscriptionchange), finished by the page.
const RENEWAL_PATH = '/__f4l/push-renewal'
async function readRenewal(): Promise<{ oldEndpoint: string | null } | null> {
  try {
    if (typeof caches === 'undefined') return null
    const hit = await (
      await caches.open(PUSH_DIAGNOSTICS_CACHE)
    ).match(RENEWAL_PATH)
    if (!hit) return null
    const body = (await hit.json()) as { oldEndpoint?: unknown }
    return {
      oldEndpoint:
        typeof body.oldEndpoint === 'string' ? body.oldEndpoint : null,
    }
  } catch {
    return null
  }
}
async function clearRenewal() {
  try {
    if (typeof caches !== 'undefined')
      await (await caches.open(PUSH_DIAGNOSTICS_CACHE)).delete(RENEWAL_PATH)
  } catch {
    // best effort
  }
}

// Finishes a renewal for the signed-in account, ONLY if this account opted in on this browser
// (mayRecoverFor). Never prompts: requires permission already granted. Re-subscribes silently when
// the push service dropped the subscription, swaps the old endpoint on the server (it removes only
// this account's own old row), and stores the device. Returns true when the server confirmed it.
export async function recoverRenewedSubscription(
  userId: string,
): Promise<boolean> {
  const renewal = await readRenewal()
  if (!renewal) return false
  if (!mayRecoverFor(userId)) return false // another account's browser: the sign-in guard clears it
  if (
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted' ||
    pushKeyStatus() !== 'ok'
  ) {
    await clearRenewal() // permission was withdrawn: nothing to renew
    return false
  }
  const key = base64UrlToUint8Array(VAPID_PUBLIC_KEY)
  let subscription = await browserSubscription().catch(() => null)
  if (subscription && !sameKey(subscription, key)) subscription = null
  if (!subscription) {
    const reg = await registration(ACTIVATION_TIMEOUTS.service_worker)
    if (!reg) return false
    subscription = await Promise.race([
      reg.pushManager
        .subscribe({ userVisibleOnly: true, applicationServerKey: key })
        .catch(() => null),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), ACTIVATION_TIMEOUTS.subscription),
      ),
    ])
    if (!subscription) return false // marker kept: retried at the next app start
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ACTIVATION_TIMEOUTS.server)
  try {
    const deviceId = await sendToServer(
      subscription,
      userId,
      controller.signal,
      renewal.oldEndpoint,
    )
    if (useAuthStore.getState().profile?.id !== userId) return false
    activationDeps(userId).onRegistered(deviceId)
    await clearRenewal()
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

// Once a day at most, when the signed-in OWNER of this browser's subscription opens Food4Love:
// re-send the existing subscription so the server keeps the device marked as in use (cleanup
// removes devices unseen for 120 days) and re-registers it if the server no longer knows it.
// Never prompts, never subscribes a browser that has not opted in, never acts for another account.
const REFRESHED_KEY = 'food4love-push-refreshed-at'
export async function refreshOwnDevice(userId: string | null): Promise<void> {
  if (!userId) return
  try {
    if (!mayRecoverFor(userId)) return
    // a rotated subscription is finished at once, not on the daily schedule
    if (await recoverRenewedSubscription(userId)) {
      window.localStorage.setItem(REFRESHED_KEY, String(Date.now()))
      return
    }
    const owned = window.localStorage.getItem(OWNER_KEY) === userId
    const last = Number(window.localStorage.getItem(REFRESHED_KEY) ?? 0)
    // a never-completed activation is retried at every app start; an owned device once a day
    if (owned && Date.now() - last < 24 * 60 * 60 * 1000) return
    if (await resyncThisDevice(userId))
      window.localStorage.setItem(REFRESHED_KEY, String(Date.now()))
  } catch {
    // best effort: the settings page still shows the device state
  }
}
