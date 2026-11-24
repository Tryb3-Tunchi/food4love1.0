// Run with: npm test
// Runs the REAL public/sw.js inside a Node vm with a fake service-worker global, then fires push,
// notificationclick and pushsubscriptionchange events at it. Also checks that the existing offline
// and update handlers are still registered.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

import { safePushUrl as coreSafeUrl } from '../supabase/functions/_shared/push-core.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'public/sw.js'), 'utf8')
const ID = '123e4567-e89b-12d3-a456-426614174000'

function loadWorker({ windows = [] } = {}) {
  const listeners = {}
  const shown = []
  const opened = []
  const fetched = []
  const badges = []
  const self = {
    location: { origin: 'https://food4love.test' },
    addEventListener: (type, fn) => (listeners[type] = fn),
    skipWaiting: () => {},
    registration: {
      showNotification: async (title, options) =>
        shown.push({ title, options }),
      pushManager: {
        subscribe: async (opts) => ({
          toJSON: () => ({
            endpoint: 'https://fcm.googleapis.com/fcm/send/new',
            keys: { p256dh: 'p', auth: 'a' },
            opts,
          }),
        }),
      },
    },
    clients: {
      matchAll: async () => windows,
      openWindow: async (url) => opened.push(url),
      claim: async () => {},
    },
    navigator: {
      setAppBadge: async (n) => badges.push(n),
      clearAppBadge: async () => badges.push(0),
    },
  }
  const context = vm.createContext({
    self,
    caches: { open: async () => ({}), keys: async () => [] },
    fetch: async (url, init) => fetched.push({ url, init }),
    URL,
    Response,
    Promise,
    JSON,
    Number,
    Date,
  })
  vm.runInContext(source, context)
  const fire = async (type, event) => {
    let pending = Promise.resolve()
    await listeners[type]({ ...event, waitUntil: (p) => (pending = p) })
    await pending
  }
  return { listeners, shown, opened, fetched, badges, fire, context }
}

const pushEvent = (payload) => ({
  data:
    payload === undefined
      ? null
      : {
          json: () =>
            typeof payload === 'string' ? JSON.parse(payload) : payload,
        },
})

test('existing offline, cache and update handlers are still registered', () => {
  const { listeners } = loadWorker()
  for (const type of [
    'install',
    'activate',
    'message',
    'fetch',
    'push',
    'notificationclick',
    'pushsubscriptionchange',
  ])
    assert.equal(typeof listeners[type], 'function', type)
  assert.match(source, /OFFLINE_URL = '\/offline\.html'/)
  assert.match(source, /SKIP_WAITING/)
})

test('a push always shows a branded notification with the safe destination', async () => {
  const w = loadWorker()
  await w.fire(
    'push',
    pushEvent({
      v: 1,
      id: ID,
      title: 'New message',
      body: 'You have a new message on Food4Love.',
      url: `/chat/${ID}`,
      tag: `f4l-messages-${ID}`,
      silent: true,
      badge: 3,
    }),
  )
  assert.equal(w.shown.length, 1)
  const { title, options } = w.shown[0]
  assert.equal(title, 'New message')
  assert.equal(options.icon, '/icons/icon-192.png')
  assert.equal(options.badge, '/icons/badge-96.png')
  assert.equal(options.silent, true)
  assert.equal(options.data.url, `/chat/${ID}`)
  assert.equal(options.data.id, ID)
  assert.deepEqual(w.badges, [3])
})

test('a push with no data or broken JSON still shows a generic notification (iOS rule)', async () => {
  for (const event of [
    pushEvent(undefined),
    {
      data: {
        json: () => {
          throw new Error('bad')
        },
      },
    },
    pushEvent('[1,2]'),
  ]) {
    const w = loadWorker()
    await w.fire('push', event)
    assert.equal(w.shown.length, 1)
    assert.equal(w.shown[0].options.data.url, '/notifications')
    assert.ok(w.shown[0].title)
  }
})

test('a malicious payload cannot set an external destination, huge text or a bad id', async () => {
  const w = loadWorker()
  await w.fire(
    'push',
    pushEvent({
      title: 'x'.repeat(500),
      body: 'y'.repeat(5000),
      url: 'https://evil.test',
      id: 'javascript:alert(1)',
      badge: -4,
    }),
  )
  const { title, options } = w.shown[0]
  assert.equal(options.data.url, '/notifications')
  assert.equal(options.data.id, null)
  assert.ok(title.length <= 80 && options.body.length <= 200)
  assert.deepEqual(w.badges, [])
})

test('the service worker URL rules match the Edge Function rules', () => {
  const { context } = loadWorker()
  for (const candidate of [
    '/chat',
    `/chat/${ID}`,
    `/bookings/${ID}?a=1`,
    '//evil',
    'https://evil',
    '/admin',
    '/cook/verification',
    '/chat/%2e%2e',
    `/cook/${ID}`,
    null,
  ])
    assert.equal(
      context.safePushUrl(candidate),
      coreSafeUrl(candidate),
      String(candidate),
    )
})

test('tapping a notification reuses an open Food4Love window', async () => {
  const messages = []
  let focused = false
  const win = {
    url: 'https://food4love.test/swipe',
    focus: async () => (focused = true),
    postMessage: (m) => messages.push(m),
  }
  const w = loadWorker({ windows: [win] })
  let closed = false
  await w.fire('notificationclick', {
    notification: {
      close: () => (closed = true),
      data: { url: `/bookings/${ID}`, id: ID },
    },
  })
  assert.ok(closed && focused)
  assert.deepEqual(JSON.parse(JSON.stringify(messages)), [
    { type: 'F4L_OPEN_NOTIFICATION', url: `/bookings/${ID}`, id: ID },
  ])
  assert.deepEqual(w.opened, [])
})

test('tapping with no window open opens the destination with the notification id', async () => {
  const w = loadWorker({
    windows: [
      {
        url: 'https://other-site.test/',
        focus: async () => {},
        postMessage: () => {},
      },
    ],
  })
  await w.fire('notificationclick', {
    notification: { close: () => {}, data: { url: `/chat/${ID}`, id: ID } },
  })
  assert.deepEqual(w.opened, [`/chat/${ID}?f4l_n=${ID}`])
})

test('tampered notification data on click is re-validated', async () => {
  const w = loadWorker()
  await w.fire('notificationclick', {
    notification: {
      close: () => {},
      data: { url: '//evil.test/x', id: '../x' },
    },
  })
  assert.deepEqual(w.opened, ['/notifications'])
})

test('an open window is told about new pushes so the bell refreshes', async () => {
  const messages = []
  const w = loadWorker({
    windows: [
      { url: 'https://food4love.test/', postMessage: (m) => messages.push(m) },
    ],
  })
  await w.fire('push', pushEvent({ title: 't', body: 'b' }))
  assert.deepEqual(JSON.parse(JSON.stringify(messages)), [
    { type: 'F4L_PUSH_RECEIVED' },
  ])
})

test('a rotated subscription is re-registered with the old endpoint for the swap', async () => {
  const w = loadWorker()
  await w.fire('pushsubscriptionchange', {
    oldSubscription: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/old',
      options: { applicationServerKey: new Uint8Array([4]) },
    },
  })
  assert.equal(w.fetched.length, 1)
  assert.equal(w.fetched[0].url, '/api/push/subscriptions')
  assert.equal(w.fetched[0].init.credentials, 'same-origin')
  assert.equal(
    JSON.parse(w.fetched[0].init.body).oldEndpoint,
    'https://fcm.googleapis.com/fcm/send/old',
  )
})

test('the badge icon the worker precaches exists (a missing file would break install)', () => {
  const list = /PRE_CACHE = \[([\s\S]*?)\]/.exec(source)[1]
  for (const [, path] of list.matchAll(/'(\/[^']+)'/g))
    readFileSync(join(root, 'public', path))
})
