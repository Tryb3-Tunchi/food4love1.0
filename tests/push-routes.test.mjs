// Run with: npm test
// The REAL /api/push/* route handlers against the in-memory Supabase fake (tests/helpers): who may
// register, list, remove and test devices, and that one member can never reach another's devices.

import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { FakeSupabase } from './helpers/fake-supabase.mjs'

register('./helpers/alias-hooks.mjs', import.meta.url)
const { NextRequest } = await import('next/server')
const subscriptions = await import('../src/app/api/push/subscriptions/route.ts')
const device = await import('../src/app/api/push/subscriptions/[id]/route.ts')
const testPush = await import('../src/app/api/push/test/route.ts')

// The old env-variable gate must have no effect any more, even if someone sets it.
process.env.PUSH_ENROLLMENT = 'open'
process.env.PUSH_PILOT_USER_IDS = ''

const CUSTOMER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'customer@example.test',
}
const COOK = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'cook@example.test',
}
const P256 = 'B' + 'A'.repeat(86)
const AUTH = 'A'.repeat(22)

// By default both test accounts are in the pilot table; the gate tests pass their own list.
function setup({ pilot } = {}) {
  const db = new FakeSupabase({
    notifications: {
      uniques: [
        {
          name: 'notifications_event_key_once',
          key: (r) => `${r.user_id}|${r.data?.event_key ?? Math.random()}`,
        },
      ],
    },
  })
  const calls = []
  // a small model of food4love_push_register / _replace (the SQL itself is tested in the sandbox)
  db.rpcHandlers.food4love_push_register = (args) => {
    calls.push({ fn: 'register', args })
    const rows = db.rows('push_subscriptions')
    let rowFound = rows.find((r) => r.endpoint === args.p_endpoint)
    if (rowFound) Object.assign(rowFound, { user_id: args.p_user_id })
    else {
      rowFound = {
        id: crypto.randomUUID(),
        user_id: args.p_user_id,
        endpoint: args.p_endpoint,
        p256dh: args.p_p256dh,
        auth_secret: args.p_auth,
        label: args.p_label,
        platform: args.p_platform,
        installed: args.p_installed,
        last_seen_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        last_success_at: null,
      }
      rows.push(rowFound)
    }
    return rowFound.id
  }
  db.rpcHandlers.food4love_push_replace = (args) => {
    calls.push({ fn: 'replace', args })
    const rows = db.rows('push_subscriptions')
    const keep = rows.filter(
      (r) =>
        !(r.user_id === args.p_user_id && r.endpoint === args.p_old_endpoint),
    )
    rows.length = 0
    rows.push(...keep)
    return db.rpcHandlers.food4love_push_register(args)
  }
  for (const id of pilot ?? [CUSTOMER.id, COOK.id])
    db.rows('push_pilot_members').push({ user_id: id })
  globalThis.__f4lFakeAdmin = db
  return { db, calls }
}
const as = (user) => (globalThis.__f4lCurrentUser = user)
const post = (body) =>
  subscriptions.POST(
    new NextRequest('http://localhost/api/push/subscriptions', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  )
const sub = (n) => ({
  subscription: {
    endpoint: `https://fcm.googleapis.com/fcm/send/device-${n}`,
    keys: { p256dh: P256, auth: AUTH },
  },
  label: `Device ${n}`,
  platform: 'android',
})
const del = (id) =>
  device.DELETE(
    new Request(`http://localhost/api/push/subscriptions/${id}`, {
      method: 'DELETE',
    }),
    { params: { id } },
  )

test('signed-out visitors can do nothing', async () => {
  setup()
  as(null)
  assert.equal((await subscriptions.GET()).status, 401)
  assert.equal((await post(sub(1))).status, 401)
  assert.equal((await del(crypto.randomUUID())).status, 401)
  assert.equal((await testPush.POST()).status, 401)
})

test('a member registers devices only for themselves, whatever the body says', async () => {
  const { db, calls } = setup()
  as(CUSTOMER)
  const response = await post({
    ...sub(1),
    user_id: COOK.id,
    p_user_id: COOK.id,
  })
  assert.equal(response.status, 200)
  assert.equal(calls[0].args.p_user_id, CUSTOMER.id)
  assert.equal(db.rows('push_subscriptions')[0].user_id, CUSTOMER.id)
})

test('invalid or non-push endpoints are refused before reaching the database', async () => {
  const { calls } = setup()
  as(CUSTOMER)
  for (const endpoint of [
    'https://evil.test/x',
    'http://fcm.googleapis.com/fcm/send/1',
    'https://169.254.169.254/x',
  ]) {
    const r = await post({
      subscription: { endpoint, keys: { p256dh: P256, auth: AUTH } },
    })
    assert.equal(r.status, 400, endpoint)
  }
  const badJson = await subscriptions.POST(
    new NextRequest('http://localhost/api/push/subscriptions', {
      method: 'POST',
      body: '{nope',
    }),
  )
  assert.equal(badJson.status, 400)
  assert.equal(calls.length, 0)
})

test('multiple devices per member; each member lists only their own, without endpoints or keys', async () => {
  setup()
  as(CUSTOMER)
  await post(sub(1))
  await post(sub(2))
  as(COOK)
  await post(sub(3))
  as(CUSTOMER)
  const list = await (await subscriptions.GET()).json()
  assert.equal(list.devices.length, 2)
  for (const d of list.devices) {
    assert.deepEqual(Object.keys(d).sort(), [
      'created_at',
      'id',
      'installed',
      'label',
      'last_success_at',
      'latest_delivery',
      'platform',
    ])
    assert.ok(!JSON.stringify(d).includes('fcm.googleapis.com'))
  }
  as(COOK)
  assert.equal((await (await subscriptions.GET()).json()).devices.length, 1)
})

test("a member cannot remove another member's device, and cannot tell it exists", async () => {
  const { db } = setup()
  as(COOK)
  const cookDevice = (await (await post(sub(3))).json()).id
  as(CUSTOMER)
  const own = (await (await post(sub(1))).json()).id
  const attempt = await del(cookDevice)
  const missing = await del(crypto.randomUUID())
  assert.equal(attempt.status, 404)
  assert.equal(missing.status, 404)
  assert.deepEqual(await attempt.json(), await missing.json())
  assert.equal(db.rows('push_subscriptions').length, 2)
  assert.equal((await del('not-a-uuid')).status, 404)
  assert.equal((await del(own)).status, 200)
  assert.deepEqual(
    db.rows('push_subscriptions').map((r) => r.user_id),
    [COOK.id],
  )
})

test('a rotated subscription swaps the old endpoint for the new one (renewal)', async () => {
  const { db, calls } = setup()
  as(CUSTOMER)
  await post(sub(1))
  const r = await post({
    ...sub(9),
    oldEndpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
  })
  assert.equal(r.status, 200)
  assert.ok(
    calls.some(
      (c) => c.fn === 'replace' && c.args.p_old_endpoint.endsWith('device-1'),
    ),
  )
  assert.deepEqual(
    db.rows('push_subscriptions').map((x) => x.endpoint),
    ['https://fcm.googleapis.com/fcm/send/device-9'],
  )
})

test('the same browser registered by another account moves to that account (shared device)', async () => {
  const { db } = setup()
  as(CUSTOMER)
  await post(sub(1))
  as(COOK)
  await post(sub(1))
  assert.equal(db.rows('push_subscriptions').length, 1)
  assert.equal(db.rows('push_subscriptions')[0].user_id, COOK.id)
})

test('test push: needs a device, goes only to the caller, and a double press is one notification', async () => {
  const { db } = setup()
  as(CUSTOMER)
  assert.equal((await testPush.POST()).status, 409)
  await post(sub(1))
  assert.equal((await testPush.POST()).status, 200)
  assert.equal((await testPush.POST()).status, 200)
  const rows = db.rows('notifications')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].user_id, CUSTOMER.id)
  assert.equal(rows[0].data.kind, 'push_test')
})

test('before the migration is applied the routes degrade and fail closed', async () => {
  const db = new FakeSupabase({
    push_subscriptions: { missing: true },
    push_pilot_members: { missing: true },
  })
  globalThis.__f4lFakeAdmin = db
  as(CUSTOMER)
  const degraded = await (await subscriptions.GET()).json()
  assert.deepEqual(degraded.devices, [])
  assert.equal(degraded.enrolled, false)
  assert.equal(typeof degraded.server.publicKeyConfigured, 'boolean')
  const r = await post(sub(1))
  assert.equal(r.status, 503)
  assert.equal((await r.json()).code, 'enrollment_unavailable')
  assert.equal((await testPush.POST()).status, 503)
})

test('pilot gate fails closed: nobody is approved by default, and the old env vars do nothing', async () => {
  const { db, calls } = setup({ pilot: [] })
  // even with the retired variables set to their old "open" values
  process.env.PUSH_ENROLLMENT = 'open'
  process.env.PUSH_PILOT_USER_IDS = CUSTOMER.id
  try {
    as(CUSTOMER)
    const r = await post(sub(1))
    assert.equal(r.status, 403)
    assert.equal((await r.json()).code, 'not_enrolled')
    assert.equal(calls.length, 0)
    assert.equal(db.rows('push_subscriptions').length, 0)
    assert.equal((await (await subscriptions.GET()).json()).enrolled, false)
  } finally {
    process.env.PUSH_ENROLLMENT = 'open'
    process.env.PUSH_PILOT_USER_IDS = ''
  }
})

test('pilot gate: only accounts in the pilot table can register; nothing lists other members', async () => {
  const { db } = setup({ pilot: [CUSTOMER.id] })
  as(CUSTOMER)
  assert.equal((await post(sub(1))).status, 200)
  const mine = await (await subscriptions.GET()).json()
  assert.equal(mine.enrolled, true)
  assert.ok(!JSON.stringify(mine).includes(COOK.id))
  as(COOK)
  assert.equal((await post(sub(2))).status, 403)
  assert.equal((await (await subscriptions.GET()).json()).enrolled, false)
  assert.deepEqual(
    db.rows('push_subscriptions').map((r) => r.user_id),
    [CUSTOMER.id],
  )
})

test('nothing in the request can grant enrollment', async () => {
  setup({ pilot: [] })
  as(CUSTOMER)
  for (const extra of [
    { enrollment: 'open' },
    { enrolled: true },
    { pilot: true },
    { user_id: COOK.id },
    { p_user_id: CUSTOMER.id },
  ])
    assert.equal(
      (await post({ ...sub(5), ...extra })).status,
      403,
      JSON.stringify(extra),
    )
})

test('the database refusal (pilot trigger) is reported as not enrolled', async () => {
  const { db } = setup({ pilot: [CUSTOMER.id] })
  db.rpcHandlers.food4love_push_register = () => {
    throw new Error('unreachable')
  }
  db.rpc = async () => ({
    data: null,
    error: { code: 'P0001', message: 'not_enrolled' },
  })
  as(CUSTOMER)
  const r = await post(sub(1))
  assert.equal(r.status, 403)
  assert.equal((await r.json()).code, 'not_enrolled')
})

test('device list reports the key status and the latest delivery of each OWN device only', async () => {
  const { db } = setup()
  as(CUSTOMER)
  const mine = (await (await post(sub(1))).json()).id
  as(COOK)
  const cooks = (await (await post(sub(2))).json()).id
  db.rows('notification_push_deliveries').push(
    {
      id: 'd1',
      subscription_id: mine,
      user_id: CUSTOMER.id,
      status: 'failed',
      http_status: 503,
      error_code: 'http_503',
      created_at: '2026-11-25T09:00:00Z',
      sent_at: null,
    },
    {
      id: 'd2',
      subscription_id: mine,
      user_id: CUSTOMER.id,
      status: 'sent',
      http_status: 201,
      error_code: null,
      created_at: '2026-11-25T10:00:00Z',
      sent_at: '2026-11-25T10:00:01Z',
    },
    {
      id: 'd3',
      subscription_id: cooks,
      user_id: COOK.id,
      status: 'expired',
      http_status: 410,
      error_code: 'http_410',
      created_at: '2026-11-25T11:00:00Z',
      sent_at: null,
    },
  )
  as(CUSTOMER)
  const body = await (await subscriptions.GET()).json()
  assert.equal(body.devices.length, 1)
  assert.equal(body.devices[0].latest_delivery.status, 'sent')
  assert.equal(body.devices[0].latest_delivery.http_status, 201)
  const text = JSON.stringify(body)
  assert.ok(
    !text.includes('http_410') && !text.includes(COOK.id),
    'no deliveries of other members',
  )
  assert.ok(!text.includes('fcm.googleapis.com'), 'no endpoints')
})

test('the server reports a push key only for a known Food4Love Supabase project', async () => {
  setup()
  as(CUSTOMER)
  const saved = process.env.NEXT_PUBLIC_SUPABASE_URL
  try {
    for (const [url, expected] of [
      ['https://oynhaqpuqzvaymntnzqo.supabase.co', true],
      ['https://pnqjzlzcvrtkpzhonjft.supabase.co', true],
      ['https://abcdefghijklmnopqrst.supabase.co', false],
      ['http://localhost:54321', false],
      [undefined, false],
    ]) {
      if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
      else process.env.NEXT_PUBLIC_SUPABASE_URL = url
      assert.equal(
        (await (await subscriptions.GET()).json()).server.publicKeyConfigured,
        expected,
        String(url),
      )
    }
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = saved
  }
})
