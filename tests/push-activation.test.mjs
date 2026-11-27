// Run with: npm test
// "Turn on notifications" can never hang: each browser step is simulated hanging, failing, or
// finishing late. Uses tiny time limits; nothing touches a real browser or server.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  RegisterError,
  activationMessage,
  runActivation,
} from '../src/lib/push/activation.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const T = {
  permission: 40,
  service_worker: 40,
  subscription: 40,
  server: 40,
  after_permission: 1000,
}
const never = () => new Promise(() => {})
const later = (ms, value) => new Promise((r) => setTimeout(() => r(value), ms))

function fakes(overrides = {}) {
  const calls = {
    prompt: 0,
    subscribe: 0,
    unsubscribe: 0,
    register: [],
    stored: [],
    late: 0,
    pending: 0,
  }
  const deps = {
    keyStatus: () => 'ok',
    permissionState: () => 'default',
    requestPermission: async () => {
      calls.prompt++
      return 'granted'
    },
    activeRegistration: async () => ({ reg: true }),
    getSubscription: async () => null,
    keyMatches: () => true,
    unsubscribe: async () => {
      calls.unsubscribe++
    },
    subscribe: async () => {
      calls.subscribe++
      return { endpoint: 'new' }
    },
    register: async (sub) => {
      calls.register.push(sub.endpoint)
      return 'device-1'
    },
    beforeSubscribe: () => {
      calls.pending++
    },
    onRegistered: (id) => calls.stored.push(id),
    onLateSuccess: () => {
      calls.late++
    },
    isCurrentAccount: () => true,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    ...overrides,
  }
  return { deps, calls }
}

test('happy path: prompt once, subscribe, server confirms, then success', async () => {
  const { deps, calls } = fakes()
  const r = await runActivation(deps, T)
  assert.deepEqual(r, {
    ok: true,
    deviceId: 'device-1',
    reusedSubscription: false,
  })
  assert.equal(calls.prompt, 1)
  assert.deepEqual(calls.stored, ['device-1'])
  assert.equal(calls.pending, 1, 'the account is remembered before subscribing')
})

test('permission already granted: no prompt; existing subscription reused, no duplicate', async () => {
  const { deps, calls } = fakes({
    permissionState: () => 'granted',
    getSubscription: async () => ({ endpoint: 'existing' }),
  })
  const r = await runActivation(deps, T)
  assert.equal(r.ok, true)
  assert.equal(r.reusedSubscription, true)
  assert.equal(calls.prompt, 0)
  assert.equal(calls.subscribe, 0)
  assert.equal(calls.unsubscribe, 0, 'a valid subscription is never cancelled')
  assert.deepEqual(calls.register, ['existing'])
})

test('denied / dismissed are reported without subscribing', async () => {
  let r = await runActivation(
    fakes({ permissionState: () => 'denied' }).deps,
    T,
  )
  assert.equal(r.reason, 'denied')
  r = await runActivation(
    fakes({ requestPermission: async () => 'denied' }).deps,
    T,
  )
  assert.equal(r.reason, 'denied')
  const { deps, calls } = fakes({ requestPermission: async () => 'default' })
  r = await runActivation(deps, T)
  assert.equal(r.reason, 'dismissed')
  assert.equal(calls.subscribe, 0)
})

for (const [stage, override] of [
  ['permission', { requestPermission: never }],
  ['service_worker', { activeRegistration: never }],
  ['subscription', { getSubscription: never }],
  ['subscription', { subscribe: never }],
  ['server', { register: never }],
]) {
  test(`a hanging ${Object.keys(override)[0]}() ends in a timeout at "${stage}", never success`, async () => {
    const { deps, calls } = fakes(override)
    const started = Date.now()
    const r = await runActivation(deps, T)
    assert.equal(r.ok, false)
    assert.equal(r.reason, 'timeout')
    assert.equal(r.stage, stage)
    assert.ok(Date.now() - started < 1000)
    assert.deepEqual(calls.stored, [], 'nothing is marked as registered')
    assert.ok(activationMessage(r).length > 10)
  })
}

test('the server request is cancelled when it times out', async () => {
  let signal
  const { deps } = fakes({
    register: (_s, sig) => {
      signal = sig
      return never()
    },
  })
  await runActivation(deps, T)
  assert.equal(signal.aborted, true)
})

test('no service worker -> service_unavailable; rejected subscribe -> failed', async () => {
  const none = await runActivation(
    fakes({ activeRegistration: async () => null }).deps,
    T,
  )
  assert.equal(none.reason, 'service_unavailable')
  const r = await runActivation(
    fakes({
      subscribe: async () => {
        throw new Error('AbortError')
      },
    }).deps,
    T,
  )
  assert.equal(r.reason, 'failed')
})

test('server refusals map to accurate reasons', async () => {
  const fail = (code, status) =>
    fakes({
      register: async () => {
        throw new RegisterError(code, status)
      },
    }).deps
  assert.equal(
    (await runActivation(fail('not_enrolled', 403), T)).reason,
    'not_enrolled',
  )
  assert.equal(
    (await runActivation(fail('enrollment_unavailable', 503), T)).reason,
    'enrollment_unavailable',
  )
  const r = await runActivation(fail('http_500', 500), T)
  assert.deepEqual([r.reason, r.status], ['register_failed', 500])
  assert.equal(
    activationMessage(r),
    'Unable to register this device. Please retry.',
  )
  const net = await runActivation(
    fakes({
      register: async () => {
        throw new TypeError('Failed to fetch')
      },
    }).deps,
    T,
  )
  assert.equal(net.reason, 'register_failed')
})

test('a subscription that completes AFTER the time limit is registered in the background', async () => {
  const { deps, calls } = fakes({
    subscribe: () => later(80, { endpoint: 'late' }),
  })
  const r = await runActivation(deps, T)
  assert.equal(r.reason, 'timeout')
  assert.equal(r.stage, 'subscription')
  assert.deepEqual(calls.stored, [])
  await later(150)
  assert.deepEqual(calls.register, ['late'])
  assert.deepEqual(calls.stored, ['device-1'])
  assert.equal(calls.late, 1)
})

test('retry after a timeout reuses the subscription the browser created (no second subscribe)', async () => {
  let held = null
  const getSubscription = async () => held
  const first = fakes({
    getSubscription,
    subscribe: async () => {
      held = { endpoint: 'made' }
      return held
    },
    register: never,
  })
  assert.equal((await runActivation(first.deps, T)).stage, 'server')
  const second = fakes({ permissionState: () => 'granted', getSubscription })
  const r = await runActivation(second.deps, T)
  assert.equal(r.ok, true)
  assert.equal(r.reusedSubscription, true)
  assert.equal(second.calls.subscribe, 0)
  assert.equal(second.calls.prompt, 0)
  assert.deepEqual(second.calls.register, ['made'])
})

test('a subscription made for another key is replaced, not reused', async () => {
  const { deps, calls } = fakes({
    getSubscription: async () => ({ endpoint: 'old-key' }),
    keyMatches: (s) => s.endpoint !== 'old-key',
  })
  const r = await runActivation(deps, T)
  assert.equal(r.ok, true)
  assert.equal(calls.unsubscribe, 1)
  assert.deepEqual(calls.register, ['new'])
})

test('wiring: button released before the refresh; automatic recovery only for the same account', () => {
  const hook = read('src/hooks/usePushNotifications.ts')
  const turnOn = hook.slice(
    hook.indexOf('const turnOn = async'),
    hook.indexOf('const turnOff'),
  )
  assert.match(turnOn, /return await enablePush\(userId, setBusyStage\)/)
  assert.match(
    turnOn,
    /finally \{[\s\S]*setBusy\(false\)[\s\S]*void refreshLocal\(\)/,
  )
  assert.doesNotMatch(turnOn, /await refreshLocal|await reloadDevices/)
  assert.match(hook, /PUSH_REGISTERED_EVENT/)
  const client = read('src/lib/push/client.ts')
  const resync = client.slice(
    client.indexOf('export async function resyncThisDevice'),
    client.indexOf('// Turns push off'),
  )
  assert.match(resync, /!mayRecoverFor\(userId\)\) return false/)
  assert.doesNotMatch(resync, /requestPermission|pushManager\.subscribe/)
  assert.match(client, /if \(existing\?\.active\) return existing/)
  assert.match(client, /signal,\n/)
})

// ---- races: sign-out, account switch, overlapping taps, slow server ----

test('late subscription after a sign-out / account switch is cancelled, never registered', async () => {
  let account = 'A'
  const { deps, calls } = fakes({
    subscribe: () => later(80, { endpoint: 'late' }),
    isCurrentAccount: () => account === 'A',
  })
  const r = await runActivation(deps, T)
  assert.equal(r.stage, 'subscription')
  account = 'B' // A signs out, B signs in before the browser finishes
  await later(150)
  assert.deepEqual(calls.register, [], 'nothing sent with B’s session')
  assert.deepEqual(calls.stored, [])
  assert.equal(calls.unsubscribe, 1, 'the orphaned subscription is cancelled')
  assert.equal(calls.late, 0)
})

test('account switched while the server request was in flight: no success, nothing stored', async () => {
  let account = 'A'
  const { deps, calls } = fakes({
    register: async (sub) => {
      calls.register.push(sub.endpoint)
      account = 'B'
      return 'device-1'
    },
    isCurrentAccount: () => account === 'A',
  })
  const r = await runActivation(deps, T)
  assert.deepEqual(r, { ok: false, reason: 'account_changed' })
  assert.deepEqual(calls.stored, [])
})

test('account changed before the request: nothing is sent', async () => {
  const { deps, calls } = fakes({ isCurrentAccount: () => false })
  const r = await runActivation(deps, T)
  assert.equal(r.reason, 'account_changed')
  assert.deepEqual(calls.register, [])
})

test('server refusing a mismatched session maps to account_changed', async () => {
  const { deps } = fakes({
    register: async () => {
      throw new RegisterError('account_changed', 409)
    },
  })
  const r = await runActivation(deps, T)
  assert.equal(r.reason, 'account_changed')
  assert.match(activationMessage(r), /different account/)
})

test('late subscription whose registration also hangs: aborted, nothing stored, no success', async () => {
  let signal
  const { deps, calls } = fakes({
    subscribe: () => later(60, { endpoint: 'late' }),
    register: (_s, sig) => {
      signal = sig
      return never()
    },
  })
  await runActivation(deps, T)
  await later(200)
  assert.equal(signal.aborted, true)
  assert.deepEqual(calls.stored, [])
  assert.equal(calls.late, 0)
})

test('a request that timed out but succeeded on the server is recovered by a retry, same device', async () => {
  // the server stores by endpoint: the first (aborted) request created the row, the retry gets it back
  const rows = new Map()
  const register = (sub) => {
    if (!rows.has(sub.endpoint))
      rows.set(sub.endpoint, `device-${rows.size + 1}`)
    return Promise.resolve(rows.get(sub.endpoint))
  }
  let held = { endpoint: 'made' }
  const slow = fakes({
    permissionState: () => 'granted',
    getSubscription: async () => held,
    register: (sub) => later(80).then(() => register(sub)),
  })
  assert.equal((await runActivation(slow.deps, T)).stage, 'server')
  await later(120) // ...and the server finished anyway
  const retry = fakes({
    permissionState: () => 'granted',
    getSubscription: async () => held,
    register,
  })
  const r = await runActivation(retry.deps, T)
  assert.deepEqual([r.ok, r.deviceId], [true, 'device-1'])
  assert.equal(rows.size, 1, 'no duplicate device')
})

test('a synchronously throwing browser API rejects (enablePush turns it into a result)', async () => {
  const { deps } = fakes({
    subscribe: () => {
      throw new Error('boom')
    },
  })
  await assert.rejects(runActivation(deps, T))
  const client = read('src/lib/push/client.ts')
  assert.match(
    client,
    /runActivation\(activationDeps\(userId, onStage\)\)\.catch\(/,
  )
})

test('one attempt at a time; expected account sent; button bound to busy', () => {
  const client = read('src/lib/push/client.ts')
  assert.match(
    client,
    /if \(attempt\) return \{ ok: false, reason: 'in_progress' \}/,
  )
  assert.match(client, /finally \{\n\s*attempt = null/)
  assert.match(client, /expectedUserId,\n/)
  assert.match(
    client,
    /isCurrentAccount: \(\) => useAuthStore\.getState\(\)\.profile\?\.id === userId/,
  )
  const resync = client.slice(
    client.indexOf('export async function resyncThisDevice'),
  )
  assert.match(
    resync,
    /sendToServer\(subscription, userId, controller\.signal\)/,
  )
  const ui = read('src/components/notifications/PushNotificationSettings.tsx')
  assert.match(ui, /disabled=\{push\.busy\}/)
})

// ---- waiting time ----

test('one overall budget after the permission answer: slow steps cannot add up', async () => {
  const budget = {
    ...T,
    service_worker: 400,
    subscription: 400,
    server: 400,
    after_permission: 120,
  }
  const { deps } = fakes({
    activeRegistration: () => later(70, { reg: true }),
    getSubscription: () => later(70, null),
    register: never,
  })
  const started = Date.now()
  const r = await runActivation(deps, budget)
  assert.equal(r.reason, 'timeout')
  assert.ok(Date.now() - started < 260, `waited ${Date.now() - started} ms`)
})

test('the button is told when it is waiting for the person vs setting up', async () => {
  const stages = []
  await runActivation(fakes({ onStage: (s) => stages.push(s) }).deps, T)
  assert.deepEqual(stages, ['permission', 'setting_up'])
  const granted = []
  await runActivation(
    fakes({ permissionState: () => 'granted', onStage: (s) => granted.push(s) })
      .deps,
    T,
  )
  assert.deepEqual(
    granted,
    ['setting_up'],
    'no prompt stage when already granted',
  )
})

test('default limits: at most ~25 s after Allow, prompt keeps its own limit', async () => {
  const { ACTIVATION_TIMEOUTS } = await import('../src/lib/push/activation.ts')
  assert.equal(ACTIVATION_TIMEOUTS.after_permission, 25_000)
  assert.ok(ACTIVATION_TIMEOUTS.permission >= 45_000)
  for (const k of ['service_worker', 'subscription', 'server'])
    assert.ok(ACTIVATION_TIMEOUTS[k] <= ACTIVATION_TIMEOUTS.after_permission)
})
