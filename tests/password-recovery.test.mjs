// Run with: npm test
//
// "Forgot password", end to end against an in-memory Supabase/Resend (tests/helpers), never a real
// service. The real routes, the real recovery rules and the real email template run; only the network
// edges are fakes.
//   1. the pure rules
//   2. requesting a reset (no account enumeration, cooldown, rate limits, trusted address)
//   3. completing a reset (one-time token, passwords, sessions)
//   4. how recovery interacts with invitations, profiles and admin rights
//   5. wiring (pages, links, no secrets)

process.env.NODE_ENV = 'test' // the response-time floor is skipped in tests only

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { register } from 'node:module'
import { fileURLToPath } from 'node:url'

import {
  GENERIC_RECOVERY_MESSAGE,
  MIN_RECOVERY_RESPONSE_MS,
  RECOVERY_COOLDOWN_MS,
  canRecoverAccount,
  looksLikeRecoveryToken,
  normalizeRecoveryEmail,
  recoveryBucket,
  withMinimumDuration,
} from '../src/lib/auth/recovery.ts'
import { passwordRecoveryEmail } from '../src/lib/email/templates.ts'
import {
  FakeSupabase,
  fakeSession,
  installResend,
  productionLikeConfig,
} from './helpers/fake-supabase.mjs'

register('./helpers/alias-hooks.mjs', import.meta.url)
const { NextRequest } = await import('next/server')
const recoverRoute = await import('../src/app/api/auth/recover/route.ts')
const resetRoute = await import('../src/app/api/auth/reset-password/route.ts')
const invitations = await import('../src/lib/invitations/server.ts')
const acceptInvitation = await import('../src/lib/invitations/accept.ts')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const APP = 'https://app.example.test'
const GOOD = 'Tomato-stew-2026'

// ============================================================================== 1. pure rules
test('rules: only plausible email addresses are accepted, normalised', () => {
  assert.equal(
    normalizeRecoveryEmail('  Ngozi@Example.COM '),
    'ngozi@example.com',
  )
  for (const bad of [
    '',
    ' ',
    'plain',
    'a@b',
    'a@b.c',
    '@example.com',
    'a b@example.com',
    'a@exa mple.com',
    'a@@example.com',
    'a<script>@example.com',
    'a,b@example.com',
    'x@example.com\nBcc: evil@example.com',
    'a@example.com\u0000',
    `${'a'.repeat(250)}@example.com`,
    null,
    undefined,
    42,
    {},
    [],
    true,
  ])
    assert.equal(normalizeRecoveryEmail(bad), null, JSON.stringify(bad))
})

test('rules: only a confirmed account can be recovered', () => {
  assert.equal(canRecoverAccount({ confirmed: true }), true)
  for (const no of [{ confirmed: false }, null, undefined, 'unknown'])
    assert.equal(canRecoverAccount(no), false, JSON.stringify(no))
})

test('rules: tokens must look like a one-time token, nothing else reaches Supabase', () => {
  assert.equal(looksLikeRecoveryToken('a'.repeat(56)), true)
  assert.equal(looksLikeRecoveryToken('Ab-_12345678901234567890'), true)
  for (const bad of [
    '',
    'short',
    'a'.repeat(201),
    'has space in it 1234567890',
    'semi;colon-1234567890',
    "quote'1234567890123456",
    null,
    undefined,
    7,
    {},
  ])
    assert.equal(looksLikeRecoveryToken(bad), false, JSON.stringify(bad))
})

test('rules: one bucket per cooldown window; every answer takes at least the floor', async () => {
  assert.equal(recoveryBucket(0), recoveryBucket(RECOVERY_COOLDOWN_MS - 1))
  assert.notEqual(recoveryBucket(0), recoveryBucket(RECOVERY_COOLDOWN_MS))
  let clock = 1000
  const slept = []
  const sleep = async (ms) => {
    slept.push(ms)
    clock += ms
  }
  // a FAST path (no such account) is padded up to the floor...
  await withMinimumDuration(
    MIN_RECOVERY_RESPONSE_MS,
    async () => {
      clock += 5
    },
    sleep,
    () => clock,
  )
  assert.equal(slept[0], MIN_RECOVERY_RESPONSE_MS - 5)
  // ...a SLOW path (email sent) is not padded further, so both end at about the same moment
  await withMinimumDuration(
    MIN_RECOVERY_RESPONSE_MS,
    async () => {
      clock += 1400
    },
    sleep,
    () => clock,
  )
  assert.equal(slept[1], MIN_RECOVERY_RESPONSE_MS - 1400)
  await withMinimumDuration(
    MIN_RECOVERY_RESPONSE_MS,
    async () => {
      clock += 2000
    },
    sleep,
    () => clock,
  )
  assert.equal(slept.length, 2, 'already slow enough: no extra wait')
  // a failure inside is swallowed and the caller still waits
  await withMinimumDuration(
    MIN_RECOVERY_RESPONSE_MS,
    async () => {
      throw new Error('boom')
    },
    sleep,
    () => clock,
  )
  assert.equal(slept.length, 3)
})

test('the reset email says nothing about the account and carries one link', () => {
  const mail = passwordRecoveryEmail({
    resetUrl: 'https://app.example.test/reset-password#token=abc123',
  })
  assert.equal(mail.subject, 'Reset your Food4Love password')
  assert.match(mail.text, /reset-password#token=abc123/)
  assert.match(
    mail.html,
    /href="https:\/\/app\.example\.test\/reset-password#token=abc123"/,
  )
  assert.equal((mail.html.match(/href=/g) ?? []).length, 1, 'exactly one link')
  assert.doesNotMatch(
    mail.html + mail.text,
    /Ngozi|Dear|Hi [A-Z]/,
    'no name: nothing that hints the address is registered',
  )
  assert.match(mail.text, /ignore this email/i)
  assert.doesNotMatch(mail.subject, /[\r\n]/)
})

// ============================================================================== 2. requesting a reset
let counter = 0
let ipCounter = 0
const nextIp = () => {
  ipCounter++
  return `10.${Math.floor(ipCounter / 250) + 1}.${Math.floor(ipCounter / 250) % 250}.${(ipCounter % 250) + 1}`
}
function setup(resendMode = 'ok') {
  counter++
  const db = new FakeSupabase(productionLikeConfig())
  globalThis.__f4lFakeAdmin = db
  const mail = installResend(resendMode)
  process.env.NEXT_PUBLIC_APP_URL = APP
  process.env.ACCOUNT_UPDATES_FROM_EMAIL = 'Food4Love <updates@example.test>'
  const session = fakeSession(db)
  globalThis.__f4lFakeSession = session
  db.rpcHandlers.admin_lookup_auth_user = ({ p_email }) => {
    const user = db.auth.admin.users.find((u) => u.email === p_email)
    return user
      ? [
          {
            id: user.id,
            confirmed: !!user.email_confirmed_at,
            signed_in_before: !!user.last_sign_in_at,
            has_profile: db.rows('profiles').some((p) => p.id === user.id),
          },
        ]
      : []
  }
  return { db, mail, session }
}
let people = 0
function member(db, over = {}) {
  people++
  const idn = `e0000000-0000-4000-8000-${String(people).padStart(12, '0')}`
  const email = over.email ?? `member${counter}x${people}@example.test`
  db.auth.admin.users.push({
    id: idn,
    email,
    email_confirmed_at: '2026-01-01T00:00:00.000Z',
    last_sign_in_at: '2026-02-01T00:00:00.000Z',
    app_metadata: over.app_metadata ?? { provider: 'email' },
    user_metadata: {},
    has_password: true,
    password: 'Old-password-1',
  })
  db.rows('profiles').push({
    id: idn,
    full_name: over.name ?? 'Ngozi Eze',
    role: 'buyer',
    onboarding_complete: true,
    kyc_status: 'unverified',
    suspended: false,
  })
  return { id: idn, email }
}

const askFor = (body, { ip, origin = APP } = {}) =>
  recoverRoute.POST(
    new NextRequest(`${APP}/api/auth/recover`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(origin ? { origin } : {}),
        'x-forwarded-for': ip ?? nextIp(),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
const resetWith = (body, { ip, origin = APP } = {}) =>
  resetRoute.POST(
    new NextRequest(`${APP}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(origin ? { origin } : {}),
        'x-forwarded-for': ip ?? nextIp(),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
const tokenFromMail = (mail, index = mail.requests.length - 1) =>
  mail.requests[index].text.match(/#token=([A-Za-z0-9_-]+)/)[1]
const json = async (response) => ({
  status: response.status,
  body: await response.json(),
  cache: response.headers.get('cache-control'),
})

test('request: a confirmed account gets ONE branded email with a one-time link; the visitor is told the generic sentence', async () => {
  const { db, mail } = setup()
  const { email } = member(db)
  const r = await json(await askFor({ email }))
  assert.equal(r.status, 200)
  assert.deepEqual(r.body, { ok: true, message: GENERIC_RECOVERY_MESSAGE })
  assert.equal(r.cache, 'no-store')
  assert.equal(mail.requests.length, 1)
  assert.deepEqual(mail.requests[0].to, [email])
  assert.equal(mail.requests[0].subject, 'Reset your Food4Love password')
  assert.match(
    mail.requests[0].from,
    /updates@example\.test/,
    'sent from the account-updates sender',
  )
  const token = tokenFromMail(mail)
  assert.match(
    mail.requests[0].text,
    new RegExp(`${APP.replace(/\./g, '\\.')}/reset-password#token=${token}`),
    'link built from the configured address, token in the fragment',
  )
  assert.ok(
    db.auth.admin.tokens.has(token),
    "the token is Supabase's own recovery token (no custom token system)",
  )
  assert.equal(db.auth.admin.tokens.get(token).type, 'recovery')
  assert.doesNotMatch(mail.requests[0].html + mail.requests[0].text, /Ngozi/)
  const row = db
    .rows('email_deliveries')
    .find((d) => d.kind === 'password_recovery')
  assert.equal(row.status, 'accepted')
  assert.doesNotMatch(
    JSON.stringify(row),
    new RegExp(email.split('@')[0]),
    'the address itself is not stored',
  )
})

test('request: an UNKNOWN address gets the identical answer, sends nothing and writes nothing', async () => {
  const known = setup()
  const { email } = member(known.db)
  const a = await json(await askFor({ email }))

  const unknown = setup()
  const b = await json(await askFor({ email: 'nobody-here@example.test' }))
  assert.deepEqual(
    b,
    a,
    'status, body and headers are identical: no way to tell the two apart',
  )
  assert.equal(unknown.mail.requests.length, 0)
  assert.equal(
    unknown.db.rows('email_deliveries').length,
    0,
    'no tracking row for addresses with no account',
  )
  assert.equal(unknown.db.auth.admin.tokens.size, 0, 'no token created')
  assert.equal(unknown.db.auth.admin.users.length, 0, 'no account created')
})

test('request: bad input is rejected the same way for everyone and changes nothing', async () => {
  const { db, mail } = setup()
  for (const body of [
    {},
    { email: '' },
    { email: 'plain' },
    { email: 5 },
    { email: ['a@example.test'] },
    { email: 'a@b' },
    '{not json',
    'null',
    '[]',
  ]) {
    const r = await json(await askFor(body))
    assert.equal(r.status, 400, JSON.stringify(body))
    assert.deepEqual(r.body, { error: 'Enter a valid email address.' })
  }
  assert.equal(mail.requests.length, 0)
  assert.equal(db.rows('email_deliveries').length, 0)
})

test('request: an account that was invited but never accepted can NOT use recovery to get in', async () => {
  const { db, mail } = setup()
  const created = await invitations.createInvitation(db, {
    value: {
      full_name: 'Funmi Pending',
      email: 'funmi@example.test',
      preferred_username: null,
      access_type: 'beta_tester',
      personal_message: null,
    },
    actorId: 'a0000000-0000-4000-8000-000000000001',
    appUrl: APP,
  })
  assert.equal(created.kind, 'created')
  const invitedUser = db.auth.admin.users.find(
    (u) => u.email === 'funmi@example.test',
  )
  assert.equal(invitedUser.email_confirmed_at, null)
  const before = mail.requests.length
  const tokensBefore = db.auth.admin.tokens.size
  const r = await json(await askFor({ email: 'funmi@example.test' }))
  assert.equal(r.status, 200, 'same generic answer')
  assert.equal(
    mail.requests.length,
    before,
    'no reset email for an unconfirmed (invited) account',
  )
  assert.equal(
    db.auth.admin.tokens.size,
    tokensBefore,
    'no recovery token minted',
  )
  assert.equal(
    invitedUser.email_confirmed_at,
    null,
    'still unconfirmed: recovery did not confirm it',
  )
  assert.equal(invitedUser.has_password, false)
})

test('request: asking twice in the window sends ONE email and does not kill the first link', async () => {
  const { db, mail } = setup()
  const { email } = member(db)
  await askFor({ email })
  const first = tokenFromMail(mail)
  const second = await json(await askFor({ email }))
  assert.equal(second.status, 200)
  assert.equal(
    mail.requests.length,
    1,
    'no second email inside the cooldown window',
  )
  assert.ok(
    db.auth.admin.tokens.has(first),
    'the first link still works (a second request must not invalidate it)',
  )
  assert.equal(db.auth.admin.tokens.size, 1, 'no second token was minted')
})

test('request: three simultaneous requests for one address still send exactly one email', async () => {
  const { db, mail } = setup()
  const { email } = member(db)
  const answers = await Promise.all([
    askFor({ email }),
    askFor({ email }),
    askFor({ email }),
  ])
  assert.ok(answers.every((a) => a.status === 200))
  assert.equal(mail.requests.length, 1)
  assert.equal(db.auth.admin.tokens.size, 1)
  assert.equal(
    db.rows('email_deliveries').filter((d) => d.kind === 'password_recovery')
      .length,
    1,
  )
})

test('request: a failed send does not lock the person out of trying again', async () => {
  const { db, mail } = setup('fail')
  const { email } = member(db)
  const a = await json(await askFor({ email }))
  assert.equal(a.status, 200, 'the visitor is not told it failed (same answer)')
  assert.equal(mail.messages.size, 0)
  assert.equal(
    db.rows('email_deliveries').filter((d) => d.kind === 'password_recovery')
      .length,
    0,
    'the unaccepted slot was released',
  )
  mail.mode = 'ok'
  await askFor({ email })
  assert.equal(mail.messages.size, 1, 'the next try goes through')
})

test('request: it still works when delivery tracking is unavailable (degraded, not broken)', async () => {
  const { db, mail } = setup()
  db.config.email_deliveries = { missing: true }
  const { email } = member(db)
  assert.equal((await askFor({ email })).status, 200)
  assert.equal(mail.messages.size, 1)
})

test('request: configuration problems say so for EVERY address alike and send nothing', async () => {
  const { db, mail } = setup()
  const { email } = member(db)
  const key = process.env.RESEND_API_KEY
  delete process.env.RESEND_API_KEY
  try {
    const known = await json(await askFor({ email }))
    const unknown = await json(await askFor({ email: 'ghost@example.test' }))
    assert.equal(known.status, 503)
    assert.deepEqual(
      known,
      unknown,
      'a configuration error reveals nothing about any address',
    )
  } finally {
    process.env.RESEND_API_KEY = key
  }
  assert.equal(mail.requests.length, 0)
  assert.equal(db.auth.admin.tokens.size, 0)
})

test("request: in production the link uses ONLY the configured address, never the request's Host", async () => {
  const { db, mail } = setup()
  const { email } = member(db)
  process.env.NODE_ENV = 'production'
  process.env.NEXT_PUBLIC_APP_URL = 'https://food4love.example'
  try {
    assert.equal((await askFor({ email })).status, 200)
  } finally {
    process.env.NODE_ENV = 'test'
  }
  assert.match(
    mail.requests[0].text,
    /https:\/\/food4love\.example\/reset-password#token=/,
  )
  assert.doesNotMatch(mail.requests[0].text, /app\.example\.test/)
  // and with NO configured address in production nothing is sent at all (no reset-link poisoning)
  const second = setup()
  const other = member(second.db)
  delete process.env.NEXT_PUBLIC_APP_URL
  process.env.NODE_ENV = 'production'
  try {
    const r = await json(await askFor({ email: other.email }))
    assert.equal(r.status, 503)
  } finally {
    process.env.NODE_ENV = 'test'
    process.env.NEXT_PUBLIC_APP_URL = APP
  }
  assert.equal(second.mail.requests.length, 0)
})

test('request: other websites cannot trigger it (same-origin only)', async () => {
  const { db, mail } = setup()
  const { email } = member(db)
  for (const origin of [
    'https://evil.example',
    'http://app.example.test',
    'null',
    null,
  ]) {
    const r = await json(await askFor({ email }, { origin }))
    assert.equal(r.status, 403, String(origin))
  }
  assert.equal(mail.requests.length, 0)
  assert.equal(db.auth.admin.tokens.size, 0)
})

test('request: brute force is slowed per visitor and per address', async () => {
  const { db, mail } = setup()
  const ip = '10.9.9.9'
  const statuses = []
  for (let i = 0; i < 7; i++)
    statuses.push(
      (await askFor({ email: `spray${counter}x${i}@example.test` }, { ip }))
        .status,
    )
  assert.deepEqual(
    statuses,
    [200, 200, 200, 200, 200, 429, 429],
    'one visitor: 5 per window, then 429 (for unknown addresses too)',
  )
  const { email } = member(db)
  const per = []
  for (let i = 0; i < 5; i++) per.push((await askFor({ email })).status)
  assert.deepEqual(
    per,
    [200, 200, 200, 429, 429],
    'one address: 3 per hour from any number of visitors',
  )
  assert.equal(mail.requests.length, 1)
})

test('request: a crash inside never changes the answer or leaks the cause', async () => {
  const { db } = setup()
  const { email } = member(db)
  globalThis.__f4lFakeAdmin = {
    from() {
      throw new Error(`secret-detail ${email}`)
    },
    auth: db.auth,
    rpc: db.rpc.bind(db),
  }
  const logged = []
  const original = console.error
  console.error = (...a) => logged.push(a.join(' '))
  try {
    const r = await json(await askFor({ email }))
    assert.equal(r.status, 200)
    assert.deepEqual(r.body, { ok: true, message: GENERIC_RECOVERY_MESSAGE })
  } finally {
    console.error = original
    globalThis.__f4lFakeAdmin = db
  }
  assert.ok(
    logged.every((l) => !/secret-detail|@/.test(l)),
    logged.join('|'),
  )
})

// ============================================================================== 3. completing a reset
async function startReset(env = setup(), who = {}) {
  const person = member(env.db, who)
  await askFor({ email: person.email })
  return { ...env, ...person, token: tokenFromMail(env.mail) }
}

test('reset: a valid link and a good password update the password, end every session, and allow a normal sign-in', async () => {
  const env = await startReset()
  const { db, session, token, email, id } = env
  const profilesBefore = JSON.stringify(db.rows('profiles'))
  const r = await json(await resetWith({ token, password: GOOD }))
  assert.equal(r.status, 200)
  assert.deepEqual(r.body, { ok: true, redirectTo: '/login?reset=1' })
  assert.equal(r.cache, 'no-store')
  assert.doesNotMatch(
    JSON.stringify(r.body),
    new RegExp(`${token}|${GOOD}`),
    'neither the token nor the password is ever echoed',
  )
  const user = db.auth.admin.users.find((u) => u.id === id)
  assert.equal(user.password, GOOD)
  assert.ok(!db.auth.admin.tokens.has(token), 'the one-time token was consumed')
  assert.ok(
    db.auth.admin.globalSignOuts.includes(id),
    'every session of the account was ended',
  )
  assert.equal(session.user, null, 'this browser is left signed out')
  assert.equal(
    JSON.stringify(db.rows('profiles')),
    profilesBefore,
    'no profile was created, changed or duplicated',
  )
  // sign in normally
  const fresh = fakeSession(db)
  assert.equal(
    (await fresh.auth.signInWithPassword({ email, password: 'Old-password-1' }))
      .error?.code,
    'invalid_credentials',
    'the OLD password no longer works',
  )
  assert.equal(
    (await fresh.auth.signInWithPassword({ email, password: GOOD })).error,
    null,
    'the new password works',
  )
})

test('reset: a link works exactly once', async () => {
  const { db, token, id } = await startReset()
  assert.equal((await resetWith({ token, password: GOOD })).status, 200)
  const again = await json(
    await resetWith({ token, password: 'Another-pass-99' }),
  )
  assert.equal(again.status, 410)
  assert.equal(again.body.code, 'invalid_link')
  assert.equal(
    db.auth.admin.users.find((u) => u.id === id).password,
    GOOD,
    'the second use changed nothing',
  )
})

test('reset: unknown, expired, malformed or missing links are all refused the same way', async () => {
  const { db } = await startReset()
  const before = JSON.stringify(db.auth.admin.users)
  for (const token of [
    'x'.repeat(56),
    'expired-token-0000000000',
    '',
    'short',
    null,
    undefined,
    123,
    "a'b-0000000000000000",
    'a'.repeat(300),
  ]) {
    const r = await json(await resetWith({ token, password: GOOD }))
    assert.equal(r.status, 410, String(token))
    assert.equal(r.body.code, 'invalid_link')
  }
  assert.equal((await resetWith('{broken')).status, 400)
  assert.equal(JSON.stringify(db.auth.admin.users), before, 'nothing changed')
})

test('reset: an expired link (token no longer known to Supabase) is refused', async () => {
  const { db, token, id } = await startReset()
  db.auth.admin.tokens.delete(token) // what expiry does at Supabase
  assert.equal((await resetWith({ token, password: GOOD })).status, 410)
  assert.equal(
    db.auth.admin.users.find((u) => u.id === id).password,
    'Old-password-1',
  )
})

test('reset: weak passwords are refused BEFORE the one-time link is used up', async () => {
  const { db, token, id } = await startReset()
  for (const password of [
    'short1',
    'longenoughbutnodigits',
    '12345678901234',
    'password123',
    'Password123',
    'Food4Love123',
    'a1'.repeat(70),
    '',
    null,
    12345678901,
    {},
  ]) {
    const r = await json(await resetWith({ token, password }))
    assert.equal(r.status, 422, String(password))
    assert.equal(r.body.code, 'weak_password')
  }
  assert.ok(
    db.auth.admin.tokens.has(token),
    'the link survived every rejected attempt',
  )
  assert.equal(
    db.auth.admin.users.find((u) => u.id === id).password,
    'Old-password-1',
  )
  assert.equal(
    (await resetWith({ token, password: GOOD })).status,
    200,
    'and still works with a good password',
  )
})

test("reset: a password that contains the person's email name is refused, and the session is ended", async () => {
  const env = await startReset(setup(), {
    email: 'oluwaseun.adeyemi@example.test',
  })
  const r = await json(
    await resetWith({ token: env.token, password: 'Oluwaseun.adeyemi-2026' }),
  )
  assert.equal(r.status, 422)
  assert.match(r.body.error, /email/i)
  assert.match(r.body.error, /request a new one/i)
  assert.equal(env.session.user, null)
  assert.equal(
    env.db.auth.admin.users.find((u) => u.id === env.id).password,
    'Old-password-1',
  )
})

test('reset: Supabase rejecting the password (its own policy) leaves it unchanged and signed out', async () => {
  const env = await startReset()
  const original = env.session.auth.updateUser
  env.session.auth.updateUser = async () => ({
    data: null,
    error: { code: 'weak_password', message: 'x' },
  })
  let r = await json(await resetWith({ token: env.token, password: GOOD }))
  assert.equal(r.status, 422)
  assert.equal(env.session.user, null)
  assert.equal(
    env.db.auth.admin.users.find((u) => u.id === env.id).password,
    'Old-password-1',
  )

  const second = await startReset()
  second.session.auth.updateUser = async () => ({
    data: null,
    error: { code: 'unexpected', message: 'x' },
  })
  r = await json(await resetWith({ token: second.token, password: GOOD }))
  assert.equal(r.status, 502)
  assert.equal(second.session.user, null)
  env.session.auth.updateUser = original
})

test('reset: a link of another kind (an invitation) cannot reset a password', async () => {
  const { db } = setup()
  const created = await invitations.createInvitation(db, {
    value: {
      full_name: 'Tester Two',
      email: 'tester2@example.test',
      preferred_username: null,
      access_type: 'beta_tester',
      personal_message: null,
    },
    actorId: 'a0000000-0000-4000-8000-000000000001',
    appUrl: APP,
  })
  assert.equal(created.kind, 'created')
  const invite = await db.auth.admin.generateLink({
    type: 'invite',
    email: 'tester2@example.test',
  })
  const r = await json(
    await resetWith({
      token: invite.data.properties.hashed_token,
      password: GOOD,
    }),
  )
  assert.equal(r.status, 410, 'an invitation token is not a recovery token')
  assert.equal(
    db.auth.admin.users.find((u) => u.email === 'tester2@example.test')
      .has_password,
    false,
  )
})

test('reset: other websites cannot post here, and attempts are rate limited', async () => {
  const { db, token } = await startReset()
  for (const origin of ['https://evil.example', null])
    assert.equal(
      (await resetWith({ token, password: GOOD }, { origin })).status,
      403,
    )
  assert.ok(
    db.auth.admin.tokens.has(token),
    'a cross-site post could not burn the link',
  )
  const ip = '10.8.8.8'
  const statuses = []
  for (let i = 0; i < 12; i++)
    statuses.push(
      (await resetWith({ token: 'z'.repeat(56), password: GOOD }, { ip }))
        .status,
    )
  assert.deepEqual(statuses, [...Array(10).fill(410), 429, 429])
})

test('reset: a different person already signed in on this browser is not left signed in', async () => {
  const env = await startReset()
  env.session.user = { id: 'someone-else', email: 'someone@example.test' } // session confusion: A is signed in, B opens B\'s link
  assert.equal(
    (await resetWith({ token: env.token, password: GOOD })).status,
    200,
  )
  assert.equal(
    env.session.user,
    null,
    'no session remains: nobody ends up signed in as the wrong person',
  )
  assert.ok(
    env.db.auth.admin.globalSignOuts.includes(env.id),
    'the account that was reset has every session ended',
  )
})

// ============================================================================== 4. invitation + account interplay
test('interplay: after accepting an invitation a tester can recover, and recovery changes nothing about who they are', async () => {
  const { db, mail, session } = setup()
  const created = await invitations.createInvitation(db, {
    value: {
      full_name: 'Adaeze Okonkwo',
      email: 'adaeze@example.test',
      preferred_username: null,
      access_type: 'cook_tester',
      personal_message: null,
    },
    actorId: 'a0000000-0000-4000-8000-000000000001',
    appUrl: APP,
  })
  assert.equal(created.kind, 'created')
  const inviteToken = mail.requests
    .at(-1)
    .text.match(/#token=([A-Za-z0-9_-]{43})/)[1]
  const done = await acceptInvitation.completeInvitation({
    admin: db,
    session,
    rawToken: inviteToken,
    password: 'First-password-77',
  })
  assert.equal(done.kind, 'ok')
  const user = db.auth.admin.users.find(
    (u) => u.email === 'adaeze@example.test',
  )
  const profile = db.rows('profiles').find((p) => p.id === user.id)
  const invitationBefore = JSON.stringify(db.rows('tester_invitations'))
  const metadataBefore = JSON.stringify(user.app_metadata)
  const profilesBefore = db.rows('profiles').length

  session.user = null
  await askFor({ email: 'adaeze@example.test' })
  const token = tokenFromMail(mail)
  assert.equal((await resetWith({ token, password: GOOD })).status, 200)

  assert.equal(
    JSON.stringify(user.app_metadata),
    metadataBefore,
    'tester_type / invitation_id untouched',
  )
  assert.ok(
    !('role' in user.app_metadata) &&
      !('admin_permissions' in user.app_metadata),
    'no administrative rights appear',
  )
  assert.equal(db.rows('profiles').length, profilesBefore, 'no second profile')
  assert.equal(
    profile.kyc_status,
    'unverified',
    'a Cook Tester stays unverified',
  )
  assert.equal(
    JSON.stringify(db.rows('tester_invitations')),
    invitationBefore,
    'the accepted invitation is unchanged and still final',
  )
  // the invitation link cannot be used again, whatever happened with the password
  const replay = await acceptInvitation.completeInvitation({
    admin: db,
    session: fakeSession(db),
    rawToken: inviteToken,
    password: 'Sneaky-password-55',
  })
  assert.equal(replay.kind, 'token')
  assert.equal(replay.reason, 'used')
})

test('interplay: a revoked or expired invitation leaves nothing to recover or accept', async () => {
  const { db, mail } = setup()
  const created = await invitations.createInvitation(db, {
    value: {
      full_name: 'Kunle Revoked',
      email: 'kunle@example.test',
      preferred_username: null,
      access_type: 'beta_tester',
      personal_message: null,
    },
    actorId: 'a0000000-0000-4000-8000-000000000001',
    appUrl: APP,
  })
  const inviteToken = mail.requests
    .at(-1)
    .text.match(/#token=([A-Za-z0-9_-]{43})/)[1]
  await invitations.revokeInvitation(db, {
    id: created.invitation.id,
    actorId: 'a0000000-0000-4000-8000-000000000001',
  })
  const sent = mail.requests.length
  const r = await json(await askFor({ email: 'kunle@example.test' }))
  assert.equal(r.status, 200)
  assert.equal(
    mail.requests.length,
    sent,
    'no reset email: the never-used invited account was removed on revoke',
  )
  const accepted = await acceptInvitation.completeInvitation({
    admin: db,
    session: fakeSession(db),
    rawToken: inviteToken,
    password: GOOD,
  })
  assert.equal(accepted.kind, 'token')
  assert.equal(accepted.reason, 'revoked')

  const exp = await invitations.createInvitation(db, {
    value: {
      full_name: 'Emeka Expired',
      email: 'emeka@example.test',
      preferred_username: null,
      access_type: 'beta_tester',
      personal_message: null,
    },
    actorId: 'a0000000-0000-4000-8000-000000000001',
    appUrl: APP,
  })
  const expToken = mail.requests
    .at(-1)
    .text.match(/#token=([A-Za-z0-9_-]{43})/)[1]
  db
    .rows('tester_invitations')
    .find((i) => i.id === exp.invitation.id).expires_at = new Date(
    Date.now() - 1000,
  ).toISOString()
  const before = mail.requests.length
  await askFor({ email: 'emeka@example.test' })
  assert.equal(
    mail.requests.length,
    before,
    'an expired, never-accepted invitation cannot be bypassed with recovery either',
  )
  assert.equal(
    (
      await acceptInvitation.completeInvitation({
        admin: db,
        session: fakeSession(db),
        rawToken: expToken,
        password: GOOD,
      })
    ).reason,
    'expired',
  )
})

test('interplay: an administrator can recover their password, but recovery never adds or removes admin rights', async () => {
  const env = setup()
  const admin = member(env.db, {
    app_metadata: {
      provider: 'email',
      role: 'admin',
      admin_permissions: ['users:manage'],
    },
  })
  await askFor({ email: admin.email })
  assert.equal(
    (await resetWith({ token: tokenFromMail(env.mail), password: GOOD }))
      .status,
    200,
  )
  const user = env.db.auth.admin.users.find((u) => u.id === admin.id)
  assert.deepEqual(user.app_metadata, {
    provider: 'email',
    role: 'admin',
    admin_permissions: ['users:manage'],
  })
  // and an ordinary member / tester cannot become one
  const tester = member(env.db, {
    app_metadata: { provider: 'email', tester_type: 'beta_tester' },
  })
  await askFor({ email: tester.email })
  await resetWith({ token: tokenFromMail(env.mail), password: GOOD })
  assert.deepEqual(
    env.db.auth.admin.users.find((u) => u.id === tester.id).app_metadata,
    { provider: 'email', tester_type: 'beta_tester' },
  )
})

test('interplay: a signed-in member visiting the recovery routes gains nothing (no session is read or trusted)', async () => {
  const env = setup()
  const a = member(env.db)
  const b = member(env.db)
  globalThis.__f4lCurrentUser = { id: a.id }
  await askFor({ email: b.email })
  const token = tokenFromMail(env.mail)
  assert.deepEqual(
    env.mail.requests.at(-1).to,
    [b.email],
    'the email goes to the address asked about, never the signed-in member',
  )
  assert.equal((await resetWith({ token, password: GOOD })).status, 200)
  assert.equal(
    env.db.auth.admin.users.find((u) => u.id === a.id).password,
    'Old-password-1',
    "the signed-in member's own password was not touched",
  )
  globalThis.__f4lCurrentUser = null
})

// ============================================================================== 5. wiring
test('both login pages offer "Forgot password?" and show the "password updated" notice', () => {
  for (const file of [
    'src/app/(auth)/login/page.tsx',
    'src/app/(auth)/login/cook/page.tsx',
  ]) {
    const src = read(file)
    assert.match(src, /href="\/forgot-password"/, file)
    assert.match(src, /Forgot password\?/, file)
    assert.match(src, /get\('reset'\) === '1'/, file)
    assert.match(src, /Your password has been updated/, file)
  }
})

test('the pages read the token once from the fragment, never log it, and never redirect anywhere dynamic', () => {
  const reset = read('src/app/(auth)/reset-password/page.tsx')
  assert.match(
    reset,
    /useRef<string \| null \| undefined>\(undefined\)/,
    'read once, survives the double effect',
  )
  assert.match(
    reset,
    /window\.history\.replaceState\(null, '', window\.location\.pathname\)/,
    'fragment removed from the address bar',
  )
  assert.doesNotMatch(reset, /console\.(log|info|error)/)
  assert.doesNotMatch(
    reset,
    /localStorage|sessionStorage|document\.cookie/,
    'the token is only held in memory',
  )
  assert.doesNotMatch(
    reset,
    /useSearchParams|next=|location.assign|router.(push|replace)/,
    'no open redirect surface',
  )
  assert.match(reset, /href="\/login\?reset=1"/)
  assert.match(reset, /tokenRef\.current = null/, 'dropped once used')
  const forgot = read('src/app/(auth)/forgot-password/page.tsx')
  assert.match(
    forgot,
    /If an account uses that email address/,
    'generic wording only',
  )
  assert.doesNotMatch(
    forgot,
    /no account|not found|not registered|does not exist|unknown email/i,
  )
})

test('the routes are wired safely', () => {
  const recover = read('src/app/api/auth/recover/route.ts')
  assert.match(
    recover,
    /request\.headers\.get\('origin'\) !== request\.nextUrl\.origin/,
  )
  assert.match(recover, /resolveTrustedAppUrl\(/)
  assert.doesNotMatch(
    recover,
    /resolveAppUrl\(/,
    'never the untrusted request address',
  )
  assert.doesNotMatch(recover, /console\.(log|info)|SERVICE_ROLE/)
  const server = read('src/lib/auth/recoveryServer.ts')
  assert.match(server, /type: 'recovery'/)
  assert.match(server, /signOut\(\{ scope: 'global' \}\)/)
  assert.doesNotMatch(
    server,
    /randomBytes|createHmac|jwt|sign\(/,
    "no custom token system: Supabase's recovery token only",
  )
  assert.doesNotMatch(server, /console\.(log|info|error)/)
  const resetSrc = read('src/app/api/auth/reset-password/route.ts')
  assert.match(
    resetSrc,
    /request\.headers\.get\('origin'\) !== request\.nextUrl\.origin/,
  )
  assert.match(resetSrc, /'Cache-Control': 'no-store'/)
  assert.match(
    read('src/lib/appUrl.ts'),
    /NODE_ENV === 'production'\s*\n?\s*\? null/,
  )
})

test('the migration allows the new email kind and keeps recovery out of the retry queue', () => {
  assert.match(
    read('supabase-migration-interest-verification-email.sql'),
    /'tester_invitation', 'password_recovery', 'referral_reward'\)/,
  )
  assert.match(
    read('src/lib/admin/intelligence/server/email.ts'),
    /d\.kind !== 'password_recovery'/,
  )
  assert.match(
    read('src/app/api/email/retry/route.ts'),
    /\.in\('kind', \['welcome', 'waitlist_confirmation'\]\)/,
    'the generic retry never touches recovery emails',
  )
})
