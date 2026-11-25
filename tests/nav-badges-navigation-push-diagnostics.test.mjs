// Run with: npm test
// Regression tests for: navigation badges (each tab counts its own thing), route loading
// boundaries (instant page shell), the shared notification Realtime channel, and the Web Push
// "Check this device" diagnostics.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

import {
  navBadgeFor,
  countNewMatches,
  countPendingBookings,
} from '../src/lib/navBadges.ts'
import { pushDiagnostics } from '../src/lib/push/diagnostics.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

// ------------------------------------------------------------------ badges
const NONE = {
  unreadMessages: 0,
  newMatches: 0,
  pendingBookings: 0,
  pendingLikeRequests: 0,
}

test('three unread notifications do NOT become three chats, matches or requests', () => {
  // The notification total is not even an input: tabs cannot borrow it.
  const counts = { ...NONE, notificationsUnread: 3 }
  for (const role of ['buyer', 'cook'])
    for (const href of [
      '/chat',
      '/matches',
      '/requests',
      '/swipe',
      '/profile',
      '/map',
      '/stories',
    ])
      assert.equal(navBadgeFor(href, role, counts), 0, `${role} ${href}`)
})

test('chat shows unread received messages only', () => {
  assert.equal(navBadgeFor('/chat', 'buyer', { ...NONE, unreadMessages: 2 }), 2)
  assert.equal(navBadgeFor('/chat', 'cook', { ...NONE, unreadMessages: 5 }), 5)
  assert.equal(navBadgeFor('/chat', 'buyer', { ...NONE, newMatches: 4 }), 0)
})

test('matches shows new matches for food lovers, never for cooks', () => {
  assert.equal(navBadgeFor('/matches', 'buyer', { ...NONE, newMatches: 1 }), 1)
  assert.equal(navBadgeFor('/matches', 'cook', { ...NONE, newMatches: 1 }), 0)
  assert.equal(
    navBadgeFor('/matches', 'buyer', { ...NONE, unreadMessages: 9 }),
    0,
  )
})

test('requests shows pending bookings + unanswered likes for cooks only', () => {
  const c = { ...NONE, pendingBookings: 2, pendingLikeRequests: 3 }
  assert.equal(navBadgeFor('/requests', 'cook', c), 5)
  assert.equal(navBadgeFor('/requests', 'buyer', c), 0)
})

test('bad numbers never render as a badge', () => {
  for (const v of [-1, NaN, Infinity, '3', null, undefined])
    assert.equal(
      navBadgeFor('/chat', 'buyer', { unreadMessages: v }),
      0,
      String(v),
    )
  assert.equal(navBadgeFor('/chat', 'buyer', { unreadMessages: 2.7 }), 2)
})

test('a match needs attention only while no message exists', () => {
  assert.equal(
    countNewMatches([
      { messages: [] },
      { messages: [{ id: 'm' }] },
      { messages: null },
      {},
    ]),
    3,
  )
  assert.equal(countNewMatches(null), 0)
  assert.equal(
    countPendingBookings([
      { status: 'pending' },
      { status: 'confirmed' },
      { status: 'pending' },
    ]),
    2,
  )
})

test('BottomNav no longer feeds the notification total to its tabs', () => {
  const nav = read('src/components/layout/BottomNav.tsx')
  assert.doesNotMatch(nav, /NavBadge count=\{unreadCount\}/)
  assert.doesNotMatch(nav, /badge: 'notifications'/)
  assert.match(nav, /navBadgeFor\(link\.href, profile\?\.role, navCounts\)/)
  assert.match(nav, /<NavBadge count=\{badgeCount\} \/>/)
})

test('chat badge query counts only messages the member received and has not read', () => {
  const hook = read('src/hooks/useNavCounts.ts')
  assert.match(
    hook,
    /\.from\('messages'\)[\s\S]*head: true[\s\S]*\.neq\('sender_id', userId!\)[\s\S]*\.is\('read_at', null\)/,
  )
  // shares the Requests page cache instead of fetching twice
  const page = read('src/app/(app)/requests/page.tsx')
  assert.match(page, /\['cook-bookings', cookId\]/)
  assert.match(page, /\['match-requests', cookId\]/)
  assert.match(hook, /queryKey: \['cook-bookings', userId\]/)
  assert.match(hook, /queryKey: \['match-requests', userId\]/)
  // refreshed by the existing ['matches'] invalidations (no new channel, no polling)
  assert.match(hook, /queryKey: \['matches', 'nav-unread-messages', userId\]/)
  assert.doesNotMatch(hook, /refetchInterval|\.channel\(/)
})

test('one notification Realtime channel per member, shared by every component', () => {
  const src = read('src/hooks/useNotifications.ts')
  assert.match(src, /const liveChannels = new Map/)
  assert.match(src, /shared\.refs\+\+/)
  assert.match(src, /function releaseLiveChannel/)
  assert.match(src, /kind === 'message'[\s\S]*queryKey: \['matches'\]/)
})

// ------------------------------------------------------------------ navigation
test('every priority route has an instant loading shell with no fake data', () => {
  for (const route of [
    '',
    'swipe',
    'matches',
    'requests',
    'chat',
    'chat/[matchId]',
    'notifications',
    'profile',
    'settings',
    'bookings',
    'bookings/[id]',
  ]) {
    const file = join(root, 'src/app/(app)', route, 'loading.tsx')
    assert.ok(existsSync(file), `missing loading.tsx for /${route}`)
    assert.match(readFileSync(file, 'utf8'), /RouteSkeleton/)
  }
  const sk = read('src/components/ui/RouteSkeleton.tsx')
  assert.match(sk, /role="status"/)
  assert.match(sk, /aria-busy="true"/)
  assert.doesNotMatch(sk, /\d{2,}\s*(likes|matches|messages)|John|Jane|Lorem/i)
})

test('authentication is not weakened: the app layout still verifies the user', () => {
  const layout = read('src/app/(app)/layout.tsx')
  assert.match(layout, /auth\.getUser\(\)/)
  assert.match(layout, /redirect\('\/login'\)/)
  assert.match(read('src/middleware.ts'), /auth\.getUser\(\)/)
})

// ------------------------------------------------------------------ push diagnostics
const base = {
  support: 'supported',
  keyInApp: 'ok',
  keyOnServer: true,
  enrolled: true,
  permission: 'granted',
  serviceWorkerActive: true,
  browserSubscribed: true,
  serverKnowsThisDevice: true,
  latestDelivery: null,
  lastShownAt: null,
}
const stage = (input, key) =>
  pushDiagnostics({ ...base, ...input }).find((s) => s.key === key)

test('diagnostics: a fully working device ticks every stage only with real evidence', () => {
  const t = '2026-11-25T10:00:00.000Z'
  const all = pushDiagnostics({
    ...base,
    latestDelivery: {
      status: 'sent',
      http_status: 201,
      error_code: null,
      created_at: t,
    },
    lastShownAt: '2026-11-25T10:00:03.000Z',
  })
  assert.deepEqual(
    all.map((s) => s.state),
    ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'],
  )
})

test('diagnostics: accepted by the push service is NOT reported as displayed', () => {
  const s = stage(
    {
      latestDelivery: {
        status: 'sent',
        http_status: 201,
        error_code: null,
        created_at: '2026-11-25T10:00:00Z',
      },
      lastShownAt: null,
    },
    'shown',
  )
  assert.equal(s.state, 'waiting')
})

test('diagnostics: each break in the chain is named', () => {
  assert.equal(stage({ support: 'needs-install-ios' }, 'support').state, 'fail')
  assert.match(
    stage({ support: 'needs-install-ios' }, 'support').detail,
    /Home Screen/,
  )
  assert.match(
    stage({ keyInApp: 'missing', keyOnServer: false }, 'key').detail,
    /Supabase project without a Food4Love push key/,
  )
  assert.match(
    stage({ keyInApp: 'missing', keyOnServer: true }, 'key').detail,
    /older version of Food4Love/,
  )
  assert.match(
    stage({ keyInApp: 'invalid', keyOnServer: false }, 'key').detail,
    /not a valid key/,
  )
  assert.equal(stage({ enrolled: false }, 'enrolled').state, 'fail')
  assert.equal(stage({ permission: 'denied' }, 'permission').state, 'fail')
  assert.equal(stage({ permission: 'default' }, 'permission').state, 'waiting')
  assert.equal(
    stage({ serverKnowsThisDevice: false }, 'registered').state,
    'waiting',
  )
  assert.equal(
    stage(
      { serviceWorkerActive: false, browserSubscribed: false },
      'registered',
    ).state,
    'fail',
  )
  assert.equal(
    stage(
      {
        latestDelivery: {
          status: 'expired',
          http_status: 410,
          error_code: 'http_410',
          created_at: 'x',
        },
      },
      'accepted',
    ).state,
    'fail',
  )
  assert.match(
    stage(
      {
        latestDelivery: {
          status: 'failed',
          http_status: 503,
          error_code: 'http_503',
          created_at: 'x',
        },
      },
      'accepted',
    ).detail,
    /HTTP 503/,
  )
  assert.equal(
    stage(
      {
        latestDelivery: {
          status: 'queued',
          http_status: null,
          error_code: null,
          created_at: 'x',
        },
      },
      'accepted',
    ).state,
    'waiting',
  )
})

// ------------------------------------------------------------------ service worker records display
test('the service worker records a displayed push (for diagnostics) only after showing it', async () => {
  const source = read('public/sw.js')
  const listeners = {}
  const puts = []
  let shown = 0
  const self = {
    location: { origin: 'https://food4love.test' },
    addEventListener: (t, fn) => (listeners[t] = fn),
    registration: {
      showNotification: async () => {
        shown++
      },
    },
    clients: { matchAll: async () => [] },
    navigator: {},
  }
  const caches = {
    open: async () => ({
      put: async (key, res) => puts.push({ key, body: await res.json() }),
    }),
    keys: async () => [],
  }
  vm.runInContext(
    source,
    vm.createContext({
      self,
      caches,
      Response,
      URL,
      JSON,
      Number,
      Date,
      Promise,
      fetch: async () => {},
    }),
  )
  let pending
  await listeners.push({
    data: {
      json: () => ({
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 't',
        body: 'b',
        url: '/chat',
      }),
    },
    waitUntil: (p) => (pending = p),
  })
  await pending
  assert.equal(shown, 1)
  assert.equal(puts.length, 1)
  assert.equal(puts[0].key, '/__f4l/push-last-shown')
  assert.equal(puts[0].body.id, '123e4567-e89b-12d3-a456-426614174000')
  assert.ok(!Number.isNaN(Date.parse(puts[0].body.at)))
  assert.deepEqual(Object.keys(puts[0].body).sort(), ['at', 'id'])
})
