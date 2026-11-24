// Run with: npm test
// Web Push core: payload privacy, safe click destinations, customer vs cook routing, response
// classification, the worker loop (multi-device, retries, duplicates), input validation and the
// browser capability matrix. Pure modules only: no network, no database.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  readFileSync,
  mkdtempSync,
  existsSync,
  readFileSync as rf,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

import {
  PUSH_CATEGORIES,
  PUSH_TOGGLE_CATEGORIES,
  buildPushPayload,
  classifyPushResponse,
  pushHref,
  pushOptionsFor,
  runDispatch,
  safePushUrl,
  timingSafeEqual,
} from '../supabase/functions/_shared/push-core.ts'
import { notificationHref } from '../src/lib/notificationRoutes.ts'
import {
  isAllowedPushEndpoint,
  parseSubscriptionInput,
  cleanLabel,
} from '../src/lib/push/subscriptionInput.ts'
import {
  detectPushSupport,
  deviceLabel,
  iosVersion,
  platformFromUserAgent,
  base64UrlToUint8Array,
} from '../src/lib/push/support.ts'
import {
  pushTestEventKey,
  isPushSchemaMissing,
} from '../src/lib/push/server.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const ID = '123e4567-e89b-12d3-a456-426614174000'
const ID2 = '223e4567-e89b-12d3-a456-426614174000'

const row = (over = {}) => ({
  delivery_id: 'd1',
  claim_token: 't1',
  attempts: 1,
  category: 'messages',
  endpoint: 'https://fcm.googleapis.com/fcm/send/x',
  p256dh: 'p',
  auth_secret: 'a',
  notification_id: ID,
  notification_type: 'message',
  notification_data: { match_id: ID2 },
  recipient_role: 'buyer',
  recipient_sound: true,
  unread_count: 3,
  ...over,
})

// ------------------------------------------------------------------ SQL <-> TypeScript drift
test('every category the SQL can produce is known to the Edge Function', () => {
  const sql = read('supabase-migration-web-push.sql')
  const fn = sql
    .split('food4love_notification_category(p_type text')[1]
    .split('$$')[1]
  const produced = new Set(
    [...fn.matchAll(/then '([a-z]+)'|else '([a-z]+)'/g)].map(
      (m) => m[1] ?? m[2],
    ),
  )
  assert.deepEqual([...produced].sort(), [...PUSH_CATEGORIES].sort())
})

test('the settings switches match the SQL preference keys', () => {
  const ui = read('src/components/notifications/PushNotificationSettings.tsx')
  for (const key of PUSH_TOGGLE_CATEGORIES)
    assert.match(ui, new RegExp(`key: '${key}'`))
})

// ------------------------------------------------------------------ customer vs cook destinations
test('push destinations agree with the in-app notification routes for customers and cooks', () => {
  const cases = [
    ['match', { match_id: ID }],
    ['match', {}],
    ['message', { match_id: ID }],
    ['message', {}],
    ['like', {}],
    ['request', {}],
    ['booking', { booking_id: ID }],
    ['booking', {}],
    ['system', { kind: 'verification' }],
    ['booking', { kind: 'interest' }],
    ['booking', { kind: 'interest_available', cook_id: ID }],
    ['booking', { kind: 'interest_available' }],
    ['review', {}],
    ['system', {}],
  ]
  for (const role of ['buyer', 'cook']) {
    for (const [type, data] of cases) {
      const inApp = notificationHref({ type, data }, role)
      assert.equal(
        pushHref(type, data, role),
        inApp ?? '/notifications',
        `${role} ${type} ${JSON.stringify(data)}`,
      )
    }
  }
})

test('cook-only destinations are never given to customers', () => {
  assert.equal(pushHref('request', {}, 'buyer'), '/notifications')
  assert.equal(
    pushHref('system', { kind: 'verification' }, 'buyer'),
    '/notifications',
  )
  assert.equal(pushHref('like', {}, 'buyer'), '/matches')
  assert.equal(pushHref('like', {}, 'cook'), '/requests')
})

// ------------------------------------------------------------------ safe click destinations
test('unsafe click destinations are replaced by /notifications', () => {
  for (const bad of [
    'https://evil.test/chat',
    '//evil.test/chat',
    '/\\evil.test',
    'javascript:alert(1)',
    '/chat/%2F%2Fevil.test',
    '/chat/../admin',
    '/admin',
    '/api/push/test',
    '/ /chat',
    '/chat/not-a-uuid',
    '',
    null,
    42,
    { url: '/chat' },
  ])
    assert.equal(safePushUrl(bad), '/notifications', String(bad))
})

test('safe destinations pass, with query and hash stripped', () => {
  assert.equal(safePushUrl(`/chat/${ID}`), `/chat/${ID}`)
  assert.equal(safePushUrl(`/bookings/${ID}?x=1#y`), `/bookings/${ID}`)
  assert.equal(safePushUrl('/cook/verification'), '/cook/verification')
})

test('a crafted id in notification data cannot build an unsafe URL', () => {
  const payload = buildPushPayload(
    row({
      notification_type: 'message',
      notification_data: { match_id: '../../admin' },
    }),
  )
  assert.equal(payload.url, '/chat')
})

// ------------------------------------------------------------------ payload privacy
test('lock-screen payloads use generic text, never the notification row text or data', () => {
  const secret = {
    match_id: ID2,
    preview: 'Meet me at 5 Secret Close',
    full_name: 'Chidi Okafor',
    amount: 25000,
  }
  for (const category of PUSH_CATEGORIES) {
    const payload = buildPushPayload(
      row({ category, notification_data: secret }),
    )
    const text = JSON.stringify(payload)
    assert.ok(
      !/Secret Close|Chidi|25000/.test(text),
      `${category} leaked: ${text}`,
    )
    assert.ok(payload.title.length > 0 && payload.body.length > 0)
    assert.ok(Buffer.byteLength(text) < 1000, 'well inside the 4 KB push limit')
  }
})

test('payload carries sound choice, badge and a per-conversation tag', () => {
  const p = buildPushPayload(
    row({ recipient_sound: false, unread_count: 5000 }),
  )
  assert.equal(p.silent, true)
  assert.equal(p.badge, 999)
  assert.equal(p.tag, `f4l-messages-${ID2}`)
  assert.equal(p.id, ID)
  assert.equal(
    buildPushPayload(row({ recipient_sound: null, unread_count: null })).silent,
    false,
  )
})

test('match, like and interest notifications get their own wording', () => {
  assert.equal(
    buildPushPayload(row({ category: 'matches', notification_type: 'match' }))
      .title,
    "It's a match!",
  )
  assert.equal(
    buildPushPayload(row({ category: 'matches', notification_type: 'like' }))
      .title,
    'Someone likes you',
  )
  assert.equal(
    buildPushPayload(
      row({
        category: 'bookings',
        notification_type: 'booking',
        notification_data: { kind: 'interest_available', cook_id: ID },
      }),
    ).url,
    `/cook/${ID}`,
  )
})

// ------------------------------------------------------------------ push service responses
test('push service responses map to the right outcome', () => {
  const expect = {
    201: 'sent',
    200: 'sent',
    202: 'sent',
    404: 'gone',
    410: 'gone',
    429: 'retry',
    408: 'retry',
    500: 'retry',
    503: 'retry',
    400: 'permanent',
    401: 'permanent',
    403: 'permanent',
    413: 'permanent',
  }
  for (const [status, outcome] of Object.entries(expect))
    assert.equal(classifyPushResponse(Number(status)), outcome, status)
  assert.equal(classifyPushResponse(null), 'retry')
})

test('delivery options: messages are urgent and short-lived, topics are valid', () => {
  assert.deepEqual(pushOptionsFor('messages'), {
    ttl: 3600,
    urgency: 'high',
    topic: 'messages',
  })
  for (const c of PUSH_CATEGORIES) {
    const o = pushOptionsFor(c)
    assert.match(o.topic, /^[a-z]{1,32}$/)
    assert.ok(o.ttl > 0 && o.ttl <= 86400)
  }
  assert.equal(pushOptionsFor('weird-category!').topic, 'updates')
})

test('secret comparison', () => {
  assert.equal(timingSafeEqual('abc', 'abc'), true)
  assert.equal(timingSafeEqual('abc', 'abd'), false)
  assert.equal(timingSafeEqual('abc', 'abcd'), false)
  assert.equal(timingSafeEqual('', ''), true)
  assert.equal(timingSafeEqual(undefined, 'x'), false)
})

// ------------------------------------------------------------------ the worker loop
function fakeQueue(rows, statusFor) {
  const queue = [...rows]
  const completed = []
  const sent = []
  return {
    completed,
    sent,
    deps: {
      now: () => Date.now(),
      claim: async (limit) => queue.splice(0, limit),
      complete: async (r, outcome, status, code) => {
        completed.push({ id: r.delivery_id, outcome, status, code })
      },
      send: async (r, payload, options) => {
        sent.push({ id: r.delivery_id, endpoint: r.endpoint, payload, options })
        const s = statusFor(r)
        if (s === 'throw') throw new Error('boom')
        return s
      },
    },
  }
}

test('one notification fans out to every device and each is completed exactly once', async () => {
  const rows = [1, 2, 3].map((n) =>
    row({
      delivery_id: `d${n}`,
      endpoint: `https://fcm.googleapis.com/fcm/send/${n}`,
    }),
  )
  const q = fakeQueue(rows, () => 201)
  const result = await runDispatch(q.deps)
  assert.equal(result.claimed, 3)
  assert.equal(result.sent, 3)
  assert.deepEqual(q.completed.map((c) => c.id).sort(), ['d1', 'd2', 'd3'])
  assert.equal(new Set(q.sent.map((s) => s.endpoint)).size, 3)
})

test('mixed results: sent, expired endpoint, retry, permanent, network error', async () => {
  const statuses = { d1: 201, d2: 410, d3: 503, d4: 403, d5: 'throw', d6: null }
  const rows = Object.keys(statuses).map((id) => row({ delivery_id: id }))
  const q = fakeQueue(rows, (r) => statuses[r.delivery_id])
  const result = await runDispatch(q.deps)
  const by = Object.fromEntries(q.completed.map((c) => [c.id, c]))
  assert.deepEqual(
    Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.outcome])),
    {
      d1: 'sent',
      d2: 'gone',
      d3: 'retry',
      d4: 'permanent',
      d5: 'retry',
      d6: 'retry',
    },
  )
  assert.equal(by.d3.code, 'http_503')
  assert.equal(by.d5.code, 'network')
  assert.equal(by.d1.code, null)
  assert.deepEqual(
    { ...result, stoppedEarly: undefined },
    {
      claimed: 6,
      sent: 1,
      gone: 1,
      retry: 3,
      permanent: 1,
      stoppedEarly: undefined,
    },
  )
})

test('a failure to record an outcome does not stop the other deliveries', async () => {
  const rows = [1, 2, 3].map((n) => row({ delivery_id: `d${n}` }))
  const q = fakeQueue(rows, () => 201)
  const original = q.deps.complete
  q.deps.complete = async (r, ...rest) => {
    if (r.delivery_id === 'd2') throw new Error('db down')
    return original(r, ...rest)
  }
  const result = await runDispatch(q.deps)
  assert.equal(result.sent, 3)
  assert.deepEqual(q.completed.map((c) => c.id).sort(), ['d1', 'd3'])
})

test('large queues are processed in batches and the time budget is respected', async () => {
  const rows = Array.from({ length: 120 }, (_, i) =>
    row({ delivery_id: `d${i}` }),
  )
  const q = fakeQueue(rows, () => 201)
  const all = await runDispatch(q.deps, { batchSize: 50 })
  assert.equal(all.claimed, 120)
  let t = 0
  const slow = fakeQueue(
    Array.from({ length: 200 }, (_, i) => row({ delivery_id: `s${i}` })),
    () => 201,
  )
  slow.deps.now = () => (t += 30_000)
  const partial = await runDispatch(slow.deps, {
    batchSize: 50,
    budgetMs: 40_000,
  })
  assert.equal(partial.stoppedEarly, true)
  assert.ok(partial.claimed < 200)
})

test('concurrency is bounded', async () => {
  let active = 0
  let peak = 0
  const rows = Array.from({ length: 30 }, (_, i) =>
    row({ delivery_id: `c${i}` }),
  )
  const q = fakeQueue(rows, () => 201)
  q.deps.send = async () => {
    active++
    peak = Math.max(peak, active)
    await new Promise((r) => setTimeout(r, 5))
    active--
    return 201
  }
  await runDispatch(q.deps, { concurrency: 4 })
  assert.ok(peak <= 4, `peak ${peak}`)
})

// ------------------------------------------------------------------ subscription input
const P256 = 'B' + 'A'.repeat(86)
const AUTH = 'A'.repeat(22)

test('only real browser push services are accepted as endpoints', () => {
  for (const good of [
    'https://fcm.googleapis.com/fcm/send/abc:def',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAA',
    'https://web.push.apple.com/QGuQyavXutnMH',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ])
    assert.equal(isAllowedPushEndpoint(good), true, good)
  for (const bad of [
    'http://fcm.googleapis.com/fcm/send/x',
    'https://fcm.googleapis.com.evil.test/x',
    'https://evil.test/fcm.googleapis.com/x',
    'https://user:pw@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'https://fcm.googleapis.com/',
    'https://localhost/x',
    'https://169.254.169.254/latest',
    'https://pnqjzlzcvrtkpzhonjft.supabase.co/rest/v1/x',
    'not a url',
    'https://fcm.googleapis.com/' + 'x'.repeat(1100),
    null,
  ])
    assert.equal(isAllowedPushEndpoint(bad), false, String(bad))
})

test('subscription body validation', () => {
  const ok = parseSubscriptionInput({
    subscription: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/1',
      keys: { p256dh: P256, auth: AUTH },
    },
    label: 'Chrome on Android',
    platform: 'android',
    installed: true,
    user_id: 'someone-else', // ignored: the server uses the session user
  })
  assert.equal(ok.ok, true)
  assert.equal(ok.value.platform, 'android')
  assert.equal('user_id' in ok.value, false)
  const base = {
    subscription: {
      endpoint: 'https://fcm.googleapis.com/fcm/send/1',
      keys: { p256dh: P256, auth: AUTH },
    },
  }
  assert.equal(
    parseSubscriptionInput({
      ...base,
      subscription: {
        ...base.subscription,
        keys: { p256dh: 'short', auth: AUTH },
      },
    }).error,
    'invalid_keys',
  )
  assert.equal(
    parseSubscriptionInput({
      ...base,
      subscription: { ...base.subscription, keys: { p256dh: P256, auth: 'x' } },
    }).error,
    'invalid_keys',
  )
  assert.equal(
    parseSubscriptionInput({ ...base, oldEndpoint: 'https://evil.test/x' })
      .error,
    'invalid_old_endpoint',
  )
  assert.equal(
    parseSubscriptionInput({ ...base, platform: 'toaster' }).value.platform,
    'other',
  )
  assert.equal(parseSubscriptionInput(null).ok, false)
})

test('device labels are cleaned and bounded', () => {
  assert.equal(
    cleanLabel('<script>alert(1)</script> Chrome'),
    'scriptalert(1)/script Chrome',
  )
  assert.equal(cleanLabel('x'.repeat(100)).length, 60)
  assert.equal(cleanLabel(''), 'This device')
  assert.equal(cleanLabel(42), 'This device')
})

// ------------------------------------------------------------------ browser capability matrix
const env = (over) => ({
  secureContext: true,
  hasServiceWorker: true,
  hasPushManager: true,
  hasNotification: true,
  permission: 'default',
  standalone: false,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36',
  maxTouchPoints: 5,
  platform: 'Linux armv8l',
  ...over,
})
const IPHONE_17 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1'
const IPHONE_15 =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 Version/15.7 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15'

test('Android Chrome can ask', () =>
  assert.equal(detectPushSupport(env()), 'supported'))
test('iPhone in a Safari tab must install first', () =>
  assert.equal(
    detectPushSupport(
      env({ userAgent: IPHONE_17, platform: 'iPhone', hasPushManager: false }),
    ),
    'needs-install-ios',
  ))
test('iPhone Home Screen app on 16.4+ can ask', () =>
  assert.equal(
    detectPushSupport(
      env({ userAgent: IPHONE_17, platform: 'iPhone', standalone: true }),
    ),
    'supported',
  ))
test('iPadOS reporting as a Mac is still treated as iPad', () =>
  assert.equal(
    detectPushSupport(
      env({
        userAgent: IPAD_DESKTOP_UA,
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ),
    'needs-install-ios',
  ))
test('real Mac Safari is not mistaken for an iPad', () =>
  assert.equal(
    detectPushSupport(
      env({
        userAgent: IPAD_DESKTOP_UA,
        platform: 'MacIntel',
        maxTouchPoints: 0,
      }),
    ),
    'supported',
  ))
test('iOS before 16.4 has no push', () =>
  assert.equal(
    detectPushSupport(
      env({ userAgent: IPHONE_15, platform: 'iPhone', standalone: true }),
    ),
    'ios-too-old',
  ))
test('blocked permission is reported, not re-asked', () =>
  assert.equal(detectPushSupport(env({ permission: 'denied' })), 'denied'))
test('http is refused', () =>
  assert.equal(detectPushSupport(env({ secureContext: false })), 'insecure'))
test('no PushManager on desktop = unsupported', () =>
  assert.equal(
    detectPushSupport(
      env({
        hasPushManager: false,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) Firefox/115.0',
        maxTouchPoints: 0,
        platform: 'Win32',
      }),
    ),
    'unsupported',
  ))

test('iOS version parsing and platform/label detection', () => {
  assert.equal(iosVersion(IPHONE_17), 17.04)
  assert.equal(iosVersion('Mozilla/5.0 (Windows NT 10.0)'), null)
  assert.equal(platformFromUserAgent(env()), 'android')
  assert.equal(
    platformFromUserAgent(env({ userAgent: IPHONE_17, platform: 'iPhone' })),
    'ios',
  )
  assert.equal(deviceLabel(env()), 'Chrome on Android')
  assert.equal(
    deviceLabel(
      env({ userAgent: IPHONE_17, platform: 'iPhone', standalone: true }),
    ),
    'Food4Love app on iPhone',
  )
  assert.equal(
    deviceLabel(
      env({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64) Chrome/131.0 Safari/537.36 Edg/131.0',
        platform: 'Win32',
        maxTouchPoints: 0,
      }),
    ),
    'Edge on Windows',
  )
})

test('VAPID public key decoding', () => {
  const bytes = base64UrlToUint8Array(
    Buffer.from([4, 255, 0, 251]).toString('base64url'),
  )
  assert.deepEqual([...bytes], [4, 255, 0, 251])
})

test('test-push event key collapses double presses within a minute', () => {
  assert.equal(
    pushTestEventKey('u', 60_000 * 5 + 10),
    pushTestEventKey('u', 60_000 * 5 + 50_000),
  )
  assert.notEqual(
    pushTestEventKey('u', 60_000 * 5),
    pushTestEventKey('u', 60_000 * 6),
  )
  assert.equal(isPushSchemaMissing({ code: 'PGRST205' }), true)
  assert.equal(isPushSchemaMissing({ code: '23505' }), false)
})

// ------------------------------------------------------------------ key generation script
test('VAPID generator writes a usable pair outside the repo and never overwrites', () => {
  const dir = mkdtempSync(join(tmpdir(), 'f4l-vapid-'))
  const out = execFileSync(
    process.execPath,
    [join(root, 'scripts/generate-vapid-keys.mjs'), dir, 'staging'],
    { encoding: 'utf8' },
  )
  const file = join(dir, 'food4love-staging-push-secrets.env')
  assert.ok(existsSync(file))
  const text = rf(file, 'utf8')
  const pub = /NEXT_PUBLIC_VAPID_PUBLIC_KEY=(\S+)/.exec(text)[1]
  const keys = JSON.parse(/VAPID_KEYS_JSON=(.+)/.exec(text)[1])
  assert.equal(Buffer.from(pub, 'base64url').length, 65)
  assert.equal(keys.privateKey.crv, 'P-256')
  assert.ok(keys.privateKey.d && !keys.publicKey.d)
  assert.match(/PUSH_DISPATCH_SECRET=(\S+)/.exec(text)[1], /^[0-9a-f]{64}$/)
  assert.ok(
    out.includes(pub) && !out.includes(keys.privateKey.d),
    'prints only the public key',
  )
  assert.throws(() =>
    execFileSync(
      process.execPath,
      [join(root, 'scripts/generate-vapid-keys.mjs'), dir, 'staging'],
      { stdio: 'pipe' },
    ),
  )
  assert.throws(() =>
    execFileSync(
      process.execPath,
      [
        join(root, 'scripts/generate-vapid-keys.mjs'),
        join(root, 'tmp-keys'),
        'staging',
      ],
      { stdio: 'pipe' },
    ),
  )
  assert.equal(existsSync(join(root, 'tmp-keys')), false)
})
