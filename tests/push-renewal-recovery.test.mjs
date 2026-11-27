// Run with: npm test
// The REAL src/lib/push/client.ts with a fake browser: after the service worker records a rotated
// subscription, the app finishes the renewal for the account that opted in on this browser only,
// never prompts, and never registers the browser to whoever else is signed in.
import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register('./helpers/alias-hooks.mjs', import.meta.url)
// A minimal stand-in for the zustand auth store (the real one imports a type Node cannot strip).
// Registered last, so it is resolved first; the test imports the same specifier = same instance.
const storeStub = encodeURIComponent(
  'let profile = null; export const useAuthStore = { getState: () => ({ profile, setProfile: (p) => { profile = p } }) }',
)
const hooks = encodeURIComponent(
  `export async function resolve(s, c, next) { if (s === '@/stores/useAuthStore') return { url: 'data:text/javascript,${storeStub}', shortCircuit: true }; return next(s, c) }`,
)
register(`data:text/javascript,${hooks}`)
process.env.NEXT_PUBLIC_SUPABASE_URL =
  'https://pnqjzlzcvrtkpzhonjft.supabase.co'

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const OLD = 'https://fcm.googleapis.com/fcm/send/old'

// ---- fake browser ----
const storage = new Map()
const localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
}
const cacheStore = new Map()
globalThis.caches = {
  open: async (name) => ({
    match: async (path) => {
      const body = cacheStore.get(`${name}${path}`)
      return body === undefined ? undefined : new Response(body)
    },
    put: async (path, response) =>
      cacheStore.set(`${name}${path}`, await response.text()),
    delete: async (path) => cacheStore.delete(`${name}${path}`),
  }),
  delete: async (name) => {
    for (const k of [...cacheStore.keys()])
      if (k.startsWith(name)) cacheStore.delete(k)
    return true
  },
}
const browser = {
  permission: 'granted',
  prompts: 0,
  subscribes: 0,
  current: null,
}
const makeSub = (endpoint) => ({
  endpoint,
  toJSON: () => ({
    endpoint,
    keys: { p256dh: 'B' + 'A'.repeat(86), auth: 'A'.repeat(22) },
  }),
  unsubscribe: async () => {
    if (browser.current?.endpoint === endpoint) browser.current = null
    return true
  },
})
const reg = {
  active: {},
  pushManager: {
    getSubscription: async () => browser.current,
    subscribe: async () => {
      browser.subscribes++
      browser.current = makeSub('https://fcm.googleapis.com/fcm/send/fresh')
      return browser.current
    },
  },
}
const NotificationFake = {
  get permission() {
    return browser.permission
  },
  requestPermission: async () => {
    browser.prompts++
    return browser.permission
  },
}
globalThis.Notification = NotificationFake
globalThis.window = {
  localStorage,
  isSecureContext: true,
  matchMedia: () => ({ matches: true }),
  dispatchEvent: () => true,
  PushManager: {},
  Notification: NotificationFake,
}
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    serviceWorker: {
      getRegistration: async () => reg,
      ready: Promise.resolve(reg),
    },
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile',
    maxTouchPoints: 5,
    platform: 'Linux',
  },
})
// the server: answers like /api/push/subscriptions does for the session account
const server = { session: A, posts: [], reply: null }
globalThis.fetch = async (url, init = {}) => {
  if ((init.method ?? 'GET') !== 'POST') return new Response('{}')
  const body = JSON.parse(init.body)
  server.posts.push(body)
  if (server.reply) return server.reply(body)
  if (body.expectedUserId !== server.session)
    return Response.json({ code: 'account_changed' }, { status: 409 })
  return Response.json({ id: 'device-renewed' })
}

const client = await import('../src/lib/push/client.ts')
const { useAuthStore } = await import('@/stores/useAuthStore')

function reset({
  owner = A,
  signedIn = A,
  sub = 'https://fcm.googleapis.com/fcm/send/new',
  marker = OLD,
} = {}) {
  storage.clear()
  cacheStore.clear()
  if (owner) storage.set('food4love-push-owner', owner)
  browser.permission = 'granted'
  browser.prompts = 0
  browser.subscribes = 0
  browser.current = sub ? makeSub(sub) : null
  server.session = signedIn
  server.posts = []
  server.reply = null
  useAuthStore.getState().setProfile(signedIn ? { id: signedIn } : null)
  if (marker !== undefined)
    cacheStore.set(
      'food4love-push-diagnostics/__f4l/push-renewal',
      JSON.stringify({ oldEndpoint: marker, at: new Date().toISOString() }),
    )
}
const markerLeft = () =>
  cacheStore.has('food4love-push-diagnostics/__f4l/push-renewal')

test('the owner finishes a renewal: old endpoint swapped, no prompt, marker cleared', async () => {
  reset()
  assert.equal(await client.recoverRenewedSubscription(A), true)
  assert.equal(server.posts.length, 1)
  assert.equal(server.posts[0].expectedUserId, A)
  assert.equal(server.posts[0].oldEndpoint, OLD)
  assert.equal(
    server.posts[0].subscription.endpoint,
    'https://fcm.googleapis.com/fcm/send/new',
  )
  assert.equal(browser.prompts, 0)
  assert.equal(client.currentDeviceId(), 'device-renewed')
  assert.equal(markerLeft(), false)
})

test('another account signed in: nothing is sent, the browser is not given to them', async () => {
  reset({ owner: A, signedIn: B })
  assert.equal(await client.recoverRenewedSubscription(B), false)
  assert.equal(server.posts.length, 0)
  // ...and the sign-in guard then cancels A's subscription and the marker
  await client.dropSubscriptionIfNotOwnedBy(B)
  assert.equal(browser.current, null)
  assert.equal(markerLeft(), false)
})

test('a subscription the push service dropped is re-created silently (permission already granted)', async () => {
  reset({ sub: null })
  assert.equal(await client.recoverRenewedSubscription(A), true)
  assert.equal(browser.subscribes, 1)
  assert.equal(browser.prompts, 0, 'never a permission prompt')
  assert.equal(
    server.posts[0].subscription.endpoint,
    'https://fcm.googleapis.com/fcm/send/fresh',
  )
})

test('permission withdrawn: nothing is sent or subscribed, marker discarded', async () => {
  reset({ sub: null })
  browser.permission = 'default'
  assert.equal(await client.recoverRenewedSubscription(A), false)
  assert.equal(server.posts.length, 0)
  assert.equal(browser.subscribes, 0)
  assert.equal(browser.prompts, 0)
  assert.equal(markerLeft(), false)
})

test('a browser where nobody opted in is never subscribed', async () => {
  reset({ owner: null, sub: null })
  assert.equal(await client.recoverRenewedSubscription(A), false)
  assert.equal(browser.subscribes, 0)
  assert.equal(server.posts.length, 0)
})

test('session changed under the request (409): nothing stored, marker kept for the right account', async () => {
  reset()
  server.session = B // the cookie that reaches the server is now B's
  assert.equal(await client.recoverRenewedSubscription(A), false)
  assert.equal(client.currentDeviceId(), null)
  assert.equal(markerLeft(), true)
})

test('server unreachable: marker kept, retried at the next app start', async () => {
  reset()
  server.reply = () => {
    throw new TypeError('Failed to fetch')
  }
  assert.equal(await client.recoverRenewedSubscription(A), false)
  assert.equal(markerLeft(), true)
  server.reply = null
  await client.refreshOwnDevice(A)
  assert.equal(markerLeft(), false)
  assert.equal(client.currentDeviceId(), 'device-renewed')
})

test('a rotation is finished at once, even if the daily refresh ran minutes ago', async () => {
  reset()
  storage.set('food4love-push-refreshed-at', String(Date.now()))
  await client.refreshOwnDevice(A)
  assert.equal(server.posts.length, 1)
  assert.equal(server.posts[0].oldEndpoint, OLD)
})

test('turning notifications off discards a pending renewal', async () => {
  reset()
  await client.disablePush()
  assert.equal(markerLeft(), false)
  assert.equal(await client.recoverRenewedSubscription(A), false)
  assert.equal(server.posts.length, 0)
})
