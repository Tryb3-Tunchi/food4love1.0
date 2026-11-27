const CACHE_NAME = 'food4love-static-v2'
const OFFLINE_URL = '/offline.html'
const PRE_CACHE = [
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/badge-96.png',
  '/logo4lfood11.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE)),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith('food4love-static-') && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ---------------------------------------------------------------- Web Push
// Payloads come from the Supabase Edge Function "push-dispatch" (generic text only, see
// supabase/functions/_shared/push-core.ts). Everything in them is still treated as untrusted here.

const PUSH_DEFAULT_URL = '/notifications'
const PUSH_SAFE_PATHS = [
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
const NOTIFICATION_ID = /^[0-9a-f-]{36}$/i

// Same rules as safePushUrl() in push-core.ts: a relative path from the allowlist, nothing else.
function safePushUrl(candidate) {
  if (typeof candidate !== 'string') return PUSH_DEFAULT_URL
  const value = candidate.trim()
  if (!value.startsWith('/') || value.startsWith('//') || /[\\%\s]/.test(value))
    return PUSH_DEFAULT_URL
  const path = value.split(/[?#]/)[0]
  return PUSH_SAFE_PATHS.some((rule) => rule.test(path))
    ? path
    : PUSH_DEFAULT_URL
}

function cleanText(value, fallback, max) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, max)
    : fallback
}

function readPush(event) {
  try {
    const data = event.data ? event.data.json() : null
    if (data && typeof data === 'object') return data
  } catch {
    // not JSON: fall through to the generic notification
  }
  return {}
}

// Diagnostics: remember when a push was last DISPLAYED on this device (the settings page shows it).
// Only a notification id and a time are stored, in this device's own cache.
function recordShown(id) {
  return caches
    .open('food4love-push-diagnostics')
    .then((cache) =>
      cache.put(
        '/__f4l/push-last-shown',
        new Response(JSON.stringify({ at: new Date().toISOString(), id }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    .catch(() => undefined)
}

self.addEventListener('push', (event) => {
  const data = readPush(event)
  const id =
    typeof data.id === 'string' && NOTIFICATION_ID.test(data.id)
      ? data.id
      : null
  const title = cleanText(data.title, 'Food4Love', 80)
  const options = {
    body: cleanText(data.body, 'You have a new update.', 200),
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: cleanText(data.tag, 'food4love', 64),
    // a newer update on the same conversation/booking alerts again instead of replacing silently
    renotify: true,
    silent: data.silent === true,
    timestamp: Date.now(),
    data: { url: safePushUrl(data.url), id },
  }
  const badge =
    Number.isInteger(data.badge) && data.badge >= 0 ? data.badge : null
  const nav = self.navigator
  // ALWAYS show a notification: Safari and Chrome revoke push for a site that receives pushes
  // without showing one. Open Food4Love windows are also told, so their bell refreshes at once.
  event.waitUntil(
    Promise.all([
      self.registration
        .showNotification(title, options)
        .then(() => recordShown(id)),
      badge === null || !nav || !nav.setAppBadge
        ? null
        : (badge > 0 ? nav.setAppBadge(badge) : nav.clearAppBadge()).catch(
            () => undefined,
          ),
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((windows) =>
          windows.forEach((client) =>
            client.postMessage({ type: 'F4L_PUSH_RECEIVED' }),
          ),
        ),
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const url = safePushUrl(data.url)
  const id =
    typeof data.id === 'string' && NOTIFICATION_ID.test(data.id)
      ? data.id
      : null
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (windows) => {
        // reuse an open Food4Love window: the page routes itself and marks the notification read
        const existing = windows.find(
          (client) => new URL(client.url).origin === self.location.origin,
        )
        if (existing) {
          await existing.focus().catch(() => undefined)
          existing.postMessage({ type: 'F4L_OPEN_NOTIFICATION', url, id })
          return
        }
        await self.clients.openWindow(id ? `${url}?f4l_n=${id}` : url)
      }),
  )
})

// The browser replaced the subscription (Chrome/Firefox; Safari does not fire this). Re-subscribe
// with the same key and tell the server to swap the old endpoint for the new one. The request is
// same-origin, so it carries the member's session cookie; without a session it is refused and
// the old row is purged on its first 410.
// The push service rotated (or expired) this browser's subscription. The worker cannot know which
// Food4Love account opted in here, so it never decides that itself:
//  1. it records the rotation (Cache API, readable by the page) BEFORE anything else;
//  2. it re-subscribes and offers the server a SWAP of the old endpoint. The server accepts that only
//     if the old endpoint is already the signed-in account's device (otherwise 409 renewal_deferred);
//  3. the next time Food4Love is open, the page finishes the renewal for the account that owns this
//     browser's subscription (recoverRenewedSubscription), without a permission prompt.
const RENEWAL_PATH = '/__f4l/push-renewal'
function recordRenewal(oldEndpoint) {
  return caches
    .open('food4love-push-diagnostics')
    .then((cache) =>
      cache.put(
        RENEWAL_PATH,
        new Response(
          JSON.stringify({ oldEndpoint, at: new Date().toISOString() }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    .catch(() => undefined)
}

self.addEventListener('pushsubscriptionchange', (event) => {
  const oldSubscription = event.oldSubscription
  const oldEndpoint =
    oldSubscription && typeof oldSubscription.endpoint === 'string'
      ? oldSubscription.endpoint
      : null
  const key =
    oldSubscription && oldSubscription.options
      ? oldSubscription.options.applicationServerKey
      : null
  event.waitUntil(
    recordRenewal(oldEndpoint)
      .then(() => {
        // without the old endpoint and key there is nothing the server could verify: the page does it
        if (!key || !oldEndpoint) return undefined
        return self.registration.pushManager
          .subscribe({ userVisibleOnly: true, applicationServerKey: key })
          .then((subscription) =>
            fetch('/api/push/subscriptions', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              // deliberately no account id: the server verifies ownership of oldEndpoint instead
              body: JSON.stringify({
                subscription: subscription.toJSON(),
                oldEndpoint,
                label: 'Renewed device',
              }),
            }),
          )
      })
      .catch(() => undefined),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME)
        return (await cache.match(OFFLINE_URL)) || Response.error()
      }),
    )
    return
  }

  const isBuildAsset = url.pathname.startsWith('/_next/static/')
  const isBrandedAsset = PRE_CACHE.includes(url.pathname)
  if (!isBuildAsset && !isBrandedAsset) return

  event.respondWith(
    caches.match(request).then(async (cached) => {
      if (cached) return cached

      const response = await fetch(request)
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME)
        await cache.put(request, response.clone())
      }
      return response
    }),
  )
})
