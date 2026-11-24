// Run with: npm test   (Node's built-in test runner; no extra dependencies)
//
// "Notify me when this cook is verified", end to end:
//   1. the copy customers see (exact wording) and the rules for who may be emailed
//   2. the shipped SQL (trigger, outbox, constraints) and UI source
//   3. BEHAVIOUR: the real /api/booking-interests route and the real email worker, run
//      against an in-memory fake of Supabase and Resend (tests/helpers), never a real
//      database or mailbox.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { register } from 'node:module'
import { fileURLToPath } from 'node:url'

import * as copy from '../src/lib/booking/interestCopy.ts'
import { decideInterestEmail } from '../src/lib/notifications/interestRules.ts'
import {
  DEFAULT_RETRY_POLICY,
  classifyFailure,
  isRetryDue,
  parseRetryAfterMs,
  retryDelayMs,
} from '../src/lib/email/retryPolicy.ts'
import { interestVerifiedEmail } from '../src/lib/email/templates.ts'
import {
  FakeSupabase,
  installResend,
  productionLikeConfig,
} from './helpers/fake-supabase.mjs'

register('./helpers/alias-hooks.mjs', import.meta.url)
const { NextRequest } = await import('next/server')
const route = await import('../src/app/api/booking-interests/route.ts')
const worker = await import('../src/lib/notifications/interestEmails.ts')
const transactional = await import('../src/lib/email/transactional.ts')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

// ================================================================== 1. copy and rules
test('the customer-facing messages are exactly the approved wording', () => {
  assert.equal(
    copy.INTEREST_SAVED_MESSAGE,
    "You're on the list! ❤️ We'll notify you as soon as this cook completes verification and becomes available for bookings.",
  )
  assert.equal(
    copy.INTEREST_DUPLICATE_MESSAGE,
    "You've already requested to be notified about this cook. We'll let you know when they're verified.",
  )
  assert.equal(
    copy.INTEREST_FAILED_MESSAGE,
    "We couldn't save your request right now. Please try again.",
  )
  assert.equal(copy.INTEREST_AVAILABLE_TITLE, 'Good news! ❤️')
  assert.equal(
    copy.INTEREST_AVAILABLE_BODY,
    'The cook you were interested in has completed Food4Love verification and is now eligible to receive booking requests. You can visit their profile and make a booking.',
  )
})

test('the in-app notification the database writes uses the same wording (no drift)', () => {
  const sql = read('supabase-migration-interest-verification-email.sql')
  assert.ok(sql.includes(`'${copy.INTEREST_AVAILABLE_TITLE}'`))
  assert.ok(sql.includes(`'${copy.INTEREST_AVAILABLE_BODY}'`))
  assert.match(
    sql,
    /'kind', 'interest_available', 'cook_id', new\.id/,
    'it carries the cook id the link needs',
  )
})

const baseFacts = (over = {}) => ({
  interest: { notify_when_verified: true },
  cook: { role: 'cook', kyc_status: 'verified', suspended: false },
  customer: { role: 'buyer', suspended: false, notification_preferences: null },
  email: { address: 'a@example.com', confirmed: true },
  ...over,
})

test('who may be emailed: consent, current verification, and the customer account', () => {
  assert.deepEqual(decideInterestEmail(baseFacts()), { send: true })
  const why = (over) => decideInterestEmail(baseFacts(over)).reason
  assert.equal(why({ interest: null }), 'no_interest')
  assert.equal(why({ interest: { notify_when_verified: false } }), 'no_consent')
  assert.equal(why({ cook: null }), 'cook_no_longer_verified')
  assert.equal(
    why({ cook: { role: 'cook', kyc_status: 'unverified' } }),
    'cook_no_longer_verified',
  )
  assert.equal(
    why({ cook: { role: 'cook', kyc_status: 'pending' } }),
    'cook_no_longer_verified',
  )
  assert.equal(
    why({ cook: { role: 'cook', kyc_status: 'verified', suspended: true } }),
    'cook_no_longer_verified',
  )
  assert.equal(
    why({ cook: { role: 'buyer', kyc_status: 'verified' } }),
    'cook_no_longer_verified',
  )
  assert.equal(why({ customer: null }), 'customer_unavailable')
  assert.equal(
    why({ customer: { role: 'buyer', suspended: true } }),
    'customer_unavailable',
  )
  assert.equal(
    why({ customer: { role: 'cook', suspended: false } }),
    'customer_unavailable',
  )
  assert.equal(
    why({
      customer: {
        role: 'buyer',
        notification_preferences: { bookings: false },
      },
    }),
    'email_opt_out',
  )
  assert.equal(why({ email: { address: null, confirmed: true } }), 'no_email')
  assert.equal(
    why({ email: { address: 'a@example.com', confirmed: false } }),
    'unconfirmed_email',
  )
  // "bookings: true" or unset does not opt out
  assert.deepEqual(
    decideInterestEmail(
      baseFacts({
        customer: {
          role: 'buyer',
          notification_preferences: { bookings: true },
        },
      }),
    ),
    { send: true },
  )
})

test('consent comes first: no consent means no email whatever else is true', () => {
  const r = decideInterestEmail(
    baseFacts({
      interest: { notify_when_verified: false },
      cook: null,
      customer: null,
    }),
  )
  assert.equal(r.reason, 'no_consent')
})

// ---- retry policy: pure, so every case is deterministic (the random source is injected)
const NO_JITTER = () => 0 // 0 removes nothing: the full backoff ceiling
const MAX_JITTER = () => 0.999999 // removes (almost) the whole jitter fraction

test('retry policy: exponential backoff, capped, with a hard attempt limit', () => {
  const p = DEFAULT_RETRY_POLICY
  const at = (n, extra = {}) =>
    retryDelayMs(n, { random: NO_JITTER, errorCode: 'http_500', ...extra })
  assert.equal(at(1), p.baseMs)
  assert.equal(at(2), p.baseMs * 2)
  assert.equal(at(3), p.baseMs * 4)
  assert.equal(at(4), p.baseMs * 8)
  assert.equal(retryDelayMs(p.maxAttempts), null, 'gives up at the limit')
  assert.equal(retryDelayMs(p.maxAttempts + 1), null)
  assert.equal(retryDelayMs(99), null)
  assert.equal(retryDelayMs(Number.NaN), null, 'garbage in means stop')
  const tight = { maxAttempts: 40, baseMs: 1000, maxMs: 5000, jitter: 0.5 }
  assert.equal(
    retryDelayMs(10, { policy: tight, random: NO_JITTER }),
    5000,
    'never waits past the cap',
  )
  assert.equal(
    retryDelayMs(35, { policy: tight, random: NO_JITTER }),
    5000,
    'a huge attempt count cannot overflow the exponent',
  )
  assert.ok(Number.isFinite(retryDelayMs(1, { policy: tight })))
})

test('retry policy: jitter spreads retries but never leaves the allowed band', () => {
  const p = DEFAULT_RETRY_POLICY // jitter 0.5: a delay is 50%..100% of the ceiling
  for (let n = 1; n < p.maxAttempts; n++) {
    const ceiling = Math.min(p.baseMs * 2 ** (n - 1), p.maxMs)
    const longest = retryDelayMs(n, { random: NO_JITTER })
    const shortest = retryDelayMs(n, { random: MAX_JITTER })
    assert.equal(longest, ceiling)
    assert.ok(shortest >= ceiling * 0.5 - 1 && shortest < ceiling)
  }
  // the dice really change the answer, and the cap holds whatever they say
  assert.notEqual(
    retryDelayMs(3, { random: NO_JITTER }),
    retryDelayMs(3, { random: () => 0.5 }),
  )
  const wild = [Number.NaN, -5, 7, Infinity, -Infinity]
  for (const value of wild) {
    const d = retryDelayMs(3, { random: () => value })
    assert.ok(
      Number.isFinite(d) && d >= p.baseMs * 4 * 0.5 && d <= p.baseMs * 4,
      `a faulty random source (${value}) cannot break the band`,
    )
  }
  // 100 emails that failed in the same instant do not all come back together
  const spread = new Set()
  let seed = 1
  const lcg = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 100; i++) spread.add(retryDelayMs(1, { random: lcg }))
  assert.ok(spread.size > 90, 'retries are spread out')
  // jitter 0 is honoured (an operator can switch it off)
  assert.equal(
    retryDelayMs(1, {
      policy: { ...p, jitter: 0 },
      random: MAX_JITTER,
    }),
    p.baseMs,
  )
})

test('retry policy: failures that can never succeed stop at once; credential problems wait', () => {
  const p = DEFAULT_RETRY_POLICY
  for (const code of [
    'http_400',
    'http_404',
    'http_405',
    'http_413',
    'http_422',
  ]) {
    assert.equal(classifyFailure(code), 'permanent', code)
    assert.equal(retryDelayMs(1, { errorCode: code }), null, code)
  }
  for (const code of ['http_401', 'http_403']) {
    assert.equal(classifyFailure(code), 'config', code)
    // not a reason to burn attempts in minutes: the slow cap, from the first failure
    assert.equal(
      retryDelayMs(1, { errorCode: code, random: NO_JITTER }),
      p.maxMs,
      code,
    )
  }
  for (const code of [
    'http_429',
    'http_500',
    'http_502',
    'http_503',
    'http_409',
    'timeout',
    'network',
    'processing_error',
    'something_new',
    null,
    undefined,
  ]) {
    assert.equal(classifyFailure(code), 'transient', String(code))
    assert.ok(retryDelayMs(1, { errorCode: code }) > 0, String(code))
  }
})

test("retry policy: a provider's Retry-After is honoured, but never past the cap", () => {
  const p = DEFAULT_RETRY_POLICY
  const base = retryDelayMs(1, { random: NO_JITTER }) // 5 minutes
  assert.equal(
    retryDelayMs(1, { random: NO_JITTER, retryAfterMs: 30 * 60 * 1000 }),
    30 * 60 * 1000,
    'waits as long as the provider asked',
  )
  assert.equal(
    retryDelayMs(1, { random: NO_JITTER, retryAfterMs: 1000 }),
    base,
    'a shorter hint never shortens our own backoff',
  )
  assert.equal(
    retryDelayMs(1, { random: NO_JITTER, retryAfterMs: 999 * 60 * 60 * 1000 }),
    p.maxMs,
    'bounded by the cap',
  )
  for (const junk of [null, undefined, Number.NaN, -1, Infinity]) {
    assert.equal(
      retryDelayMs(1, { random: NO_JITTER, retryAfterMs: junk }),
      base,
      String(junk),
    )
  }
  const now = new Date('2026-11-17T12:00:00Z')
  assert.equal(parseRetryAfterMs('120', now), 120_000)
  assert.equal(parseRetryAfterMs(' 5 ', now), 5000)
  assert.equal(parseRetryAfterMs('Tue, 17 Nov 2026 12:10:00 GMT', now), 600_000)
  assert.equal(parseRetryAfterMs('Tue, 17 Nov 2026 11:00:00 GMT', now), 0)
  assert.equal(parseRetryAfterMs('soon', now), null)
  assert.equal(parseRetryAfterMs('', now), null)
  assert.equal(parseRetryAfterMs(null, now), null)
  assert.equal(
    parseRetryAfterMs('999999999', now),
    86_400_000,
    'capped at a day',
  )
})

test('retry policy: a schedule is data, and a failed row with no time is finished', () => {
  const now = new Date('2026-11-17T12:00:00Z')
  assert.equal(isRetryDue({ next_attempt_at: null }, now), true)
  assert.equal(
    isRetryDue({ status: 'queued', next_attempt_at: null }, now),
    true,
  )
  assert.equal(
    isRetryDue({ next_attempt_at: '2026-11-17T12:00:01Z' }, now),
    false,
  )
  assert.equal(
    isRetryDue({ next_attempt_at: '2026-11-17T11:59:59Z' }, now),
    true,
  )
  assert.equal(
    isRetryDue(
      { status: 'failed', next_attempt_at: '2026-11-17T11:59:59Z' },
      now,
    ),
    true,
  )
  assert.equal(
    isRetryDue({ status: 'failed', next_attempt_at: null }, now),
    false,
    'the policy gave up on it',
  )
  assert.equal(
    isRetryDue({ status: 'failed', next_attempt_at: 'not a date' }, now),
    false,
    'an unreadable time never means "now"',
  )
})

test('the verification email: right facts, safe markup, one link, nothing private', () => {
  const mail = interestVerifiedEmail({
    customerName: 'Ngozi Eze',
    cookName: 'Chef <b>Ada</b> Obi',
    profileUrl: 'https://app.example.test/cook/abc',
  })
  assert.match(
    mail.subject,
    /^Good news! Chef <b>Ada<\/b> Obi is now verified on Food4Love/,
  )
  assert.doesNotMatch(mail.subject, /[\r\n]/)
  assert.match(mail.text, /^Hi Ngozi,/)
  assert.match(mail.text, /eligible to receive booking requests/)
  assert.match(mail.text, /https:\/\/app\.example\.test\/cook\/abc/)
  assert.match(mail.html, /href="https:\/\/app\.example\.test\/cook\/abc"/)
  assert.doesNotMatch(
    mail.html,
    /<b>Ada/,
    'the cook name is escaped in the HTML',
  )
  assert.match(mail.html, /&lt;b&gt;Ada/)
  assert.match(mail.html, /Nothing has been booked or charged/)
  // no customer detail beyond a first name for the greeting
  assert.doesNotMatch(mail.html + mail.text, /Eze/)
  const header = interestVerifiedEmail({
    customerName: null,
    cookName: 'Ada\r\nBcc: x@y.z',
    profileUrl: 'https://x.test/c',
  })
  assert.doesNotMatch(header.subject, /[\r\n]/)
  assert.match(header.text, /^Hello,/)
})

test('email kinds: the sender and states exist for the new emails', () => {
  assert.equal(typeof transactional.senderFor, 'function')
  process.env.WELCOME_FROM_EMAIL = 'welcome@example.test'
  process.env.ACCOUNT_UPDATES_FROM_EMAIL = 'updates@example.test'
  process.env.RESEND_FROM_EMAIL = 'fallback@example.test'
  delete process.env.BOOKING_FROM_EMAIL
  assert.equal(
    transactional.senderFor('interest_verified'),
    'updates@example.test',
  )
  assert.equal(
    transactional.senderFor('tester_invitation'),
    'welcome@example.test',
  )
  assert.equal(transactional.senderFor('welcome'), 'welcome@example.test')
  delete process.env.WELCOME_FROM_EMAIL
  delete process.env.ACCOUNT_UPDATES_FROM_EMAIL
  assert.equal(
    transactional.senderFor('interest_verified'),
    'fallback@example.test',
  )
  assert.equal(
    transactional.senderFor('tester_invitation'),
    'fallback@example.test',
  )
})

// ================================================================== 2. shipped SQL and UI
test('the migration: hard stops, one queued email per interest, never blocks a verification', () => {
  const sql = read('supabase-migration-interest-verification-email.sql')
  assert.match(sql, /public\.booking_interests is missing/)
  assert.match(sql, /public\.email_deliveries is missing/)
  // idempotent outbox: a repeated trigger can not queue a second email for the same interest
  assert.match(
    sql,
    /insert into public\.email_deliveries \(kind, recipient_key, status\)[\s\S]*on conflict \(kind, recipient_key\) do nothing/,
  )
  assert.match(sql, /'interest_verified', i\.id::text, 'queued'/)
  // a failing outbox write can not roll back the cook's approval (it is logged, not silent)
  assert.match(
    sql,
    /begin\s+insert into public\.email_deliveries[\s\S]*exception when others then[\s\S]*raise warning[\s\S]*end;/,
  )
  // in-app: only customers who asked, once per interest
  assert.match(
    sql,
    /i\.status = 'active' and i\.notify_when_verified\s+on conflict do nothing/,
  )
  assert.match(
    sql,
    /'event_key', 'interest:' \|\| i\.id::text \|\| ':verified'/,
  )
  // only on a real change to 'verified'
  assert.match(
    sql,
    /new\.kyc_status is not distinct from old\.kyc_status then\s+return new/,
  )
  // new kinds and states, and a persisted retry schedule
  assert.match(sql, /'interest_verified', 'tester_invitation'/)
  assert.match(sql, /'processing'[\s\S]*'cancelled'/)
  assert.match(sql, /add column if not exists next_attempt_at timestamptz/)
  assert.match(sql, /Production has the base email_deliveries table/)
  assert.match(sql, /ROLLBACK/)
})

test('the status and kind lists in SQL match the TypeScript types', () => {
  const sql = read('supabase-migration-interest-verification-email.sql')
  const ts = read('src/lib/email/transactional.ts')
  for (const status of [
    'queued',
    'processing',
    'accepted',
    'delivered',
    'bounced',
    'failed',
    'cancelled',
  ]) {
    assert.ok(sql.includes(`'${status}'`), `SQL missing ${status}`)
    assert.ok(ts.includes(`| '${status}'`), `TS missing ${status}`)
  }
  for (const kind of [
    'waitlist_confirmation',
    'welcome',
    'interest_verified',
    'tester_invitation',
  ]) {
    assert.ok(sql.includes(`'${kind}'`), `SQL missing ${kind}`)
    assert.ok(ts.includes(`'${kind}'`), `TS missing ${kind}`)
  }
})

test('approval and the retry route both drain the queue, and neither lets email block approval', () => {
  const kyc = read('src/app/api/admin/kyc/route.ts')
  assert.match(
    kyc,
    /if \(approved\) \{\s*try \{\s*await Promise\.race\(\[\s*processInterestEmails\(/,
  )
  assert.match(kyc, /setTimeout\(resolve, 8000\)/)
  const approveIndex = kyc.indexOf(
    "finishAdminAudit(audit.admin, audit.auditId, 'succeeded')",
  )
  assert.ok(
    approveIndex > 0 && approveIndex < kyc.indexOf('processInterestEmails('),
    'sent only after the approval is committed',
  )

  const retry = read('src/app/api/email/retry/route.ts')
  assert.match(retry, /processInterestEmails\(admin/)
  assert.match(
    retry,
    /\.in\('kind', \['welcome', 'waitlist_confirmation'\]\)/,
    'old kinds keep their own loop; new kinds are not double-handled',
  )
})

test('the panel: one honest button, live status region, no hidden consent checkbox', () => {
  const ui = read('src/components/booking/CookBookingPanel.tsx')
  assert.match(ui, /Notify me when \$\{first\} is verified/)
  assert.doesNotMatch(ui, /type="checkbox"/)
  assert.doesNotMatch(ui, /I’m interested in booking/)
  assert.match(ui, /notify_when_verified: true/)
  assert.match(ui, /role="status" aria-live="polite"/)
  assert.match(ui, /disabled=\{ask\.isPending\}/)
  assert.match(ui, /INTEREST_FAILED_MESSAGE/)
  assert.match(ui, /\/login\?next=\$\{encodeURIComponent\(here\)\}/)
})

test('the login redirect only honours same-site destinations for finished accounts', () => {
  const src = read('src/lib/auth/postLoginRedirect.ts')
  assert.match(src, /safeNextPath\(intended, '\/swipe'\)/)
  // unfinished onboarding is decided BEFORE the intended page is ever considered
  const useOfIntended = src.lastIndexOf('safeNextPath(')
  assert.ok(src.indexOf("'/onboarding/role'") < useOfIntended)
  assert.ok(src.indexOf("'/onboarding/setup'") < useOfIntended)
})

// ================================================================== 3. behaviour
const CUSTOMER = 'c0000000-0000-4000-8000-000000000001'
const COOK = 'c0000000-0000-4000-8000-000000000002'
const APP = 'https://app.example.test'

function world() {
  testAddress += 1
  const db = new FakeSupabase(productionLikeConfig())
  globalThis.__f4lFakeAdmin = db
  const mail = installResend('ok')
  process.env.NEXT_PUBLIC_APP_URL = APP
  addMember(db, {
    id: CUSTOMER,
    role: 'buyer',
    name: 'Ngozi Eze',
    email: 'ngozi@example.com',
  })
  addMember(db, {
    id: COOK,
    role: 'cook',
    name: 'Chef Ada Obi',
    email: 'ada@example.com',
    kyc: 'unverified',
  })
  globalThis.__f4lCurrentUser = { id: CUSTOMER }
  return { db, mail }
}

function addMember(
  db,
  {
    id,
    role,
    name,
    email,
    kyc = 'unverified',
    age = '2026-01-01T00:00:00.000Z',
  },
) {
  db.rows('profiles').push({
    id,
    role,
    full_name: name,
    suspended: false,
    onboarding_complete: true,
    kyc_status: kyc,
    age_confirmed_at: age,
    notification_preferences: null,
  })
  db.auth.admin.users.push({
    id,
    email,
    email_confirmed_at: '2026-01-01T00:00:00.000Z',
    last_sign_in_at: null,
    app_metadata: {},
    user_metadata: {},
  })
}

// The route has a per-process in-memory limiter keyed by user + address. Every test gets its
// own "address" so one test's presses never count against another's.
let testAddress = 0
const post = async (body, headers = {}) => {
  const response = await route.POST(
    new NextRequest('https://app.example.test/api/booking-interests', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': `10.0.0.${testAddress}`,
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  )
  return { status: response.status, body: await response.json() }
}
const withdraw = async (body) => {
  const response = await route.DELETE(
    new NextRequest('https://app.example.test/api/booking-interests', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return { status: response.status, body: await response.json() }
}
const active = (db) =>
  db.rows('booking_interests').filter((r) => r.status === 'active')

// What the database trigger does when a cook becomes verified, mirrored from
// supabase-migration-interest-verification-email.sql (the SQL itself is checked above).
function approve(db, cookId = COOK) {
  const cook = db.rows('profiles').find((p) => p.id === cookId)
  if (cook.kyc_status === 'verified') return
  cook.kyc_status = 'verified'
  for (const i of db
    .rows('booking_interests')
    .filter(
      (r) =>
        r.cook_id === cookId && r.status === 'active' && r.notify_when_verified,
    )) {
    const note = {
      user_id: i.customer_id,
      type: 'booking',
      title: copy.INTEREST_AVAILABLE_TITLE,
      body: copy.INTEREST_AVAILABLE_BODY,
      data: {
        kind: 'interest_available',
        cook_id: cookId,
        event_key: `interest:${i.id}:verified`,
      },
    }
    const violation = db.violation('notifications', { id: 'x', ...note }, null)
    if (!violation)
      db.rows('notifications').push({
        id: `n-${db.rows('notifications').length}`,
        ...note,
      })
    const exists = db
      .rows('email_deliveries')
      .some((d) => d.kind === 'interest_verified' && d.recipient_key === i.id)
    if (!exists)
      db.rows('email_deliveries').push({
        id: `d-${db.rows('email_deliveries').length}`,
        kind: 'interest_verified',
        recipient_key: i.id,
        status: 'queued',
        attempts: 0,
        next_attempt_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
  }
  for (const i of db
    .rows('booking_interests')
    .filter((r) => r.cook_id === cookId && r.status === 'active')) {
    i.status = 'fulfilled'
    // what the trigger records: when a consenting customer was told
    if (i.notify_when_verified)
      i.customer_notified_at = new Date().toISOString()
  }
}

// ---- the route
test('a signed-out visitor cannot register interest', async () => {
  const { db } = world()
  globalThis.__f4lCurrentUser = null
  const r = await post({ cook_id: COOK, notify_when_verified: true })
  assert.equal(r.status, 401)
  assert.equal(db.rows('booking_interests').length, 0)
})

test('pressing "Notify me" saves the request for the signed-in customer and says so exactly', async () => {
  const { db } = world()
  const r = await post({ cook_id: COOK, notify_when_verified: true })
  assert.equal(r.status, 201)
  assert.equal(r.body.duplicate, false)
  assert.equal(r.body.message, copy.INTEREST_SAVED_MESSAGE)
  const [row] = db.rows('booking_interests')
  assert.equal(row.customer_id, CUSTOMER)
  assert.equal(row.cook_id, COOK)
  assert.equal(row.status, 'active')
  assert.equal(row.notify_when_verified, true)
  assert.ok(row.created_at)
  // it is NOT a booking, a payment or a reservation
  for (const table of ['bookings', 'payments', 'wallet_transactions'])
    assert.equal(db.rows(table).length, 0, table)
})

test('the cook hears that someone is interested, never who', async () => {
  const { db } = world()
  await post({ cook_id: COOK, notify_when_verified: true })
  const notes = db.rows('notifications').filter((n) => n.user_id === COOK)
  assert.equal(notes.length, 1)
  assert.doesNotMatch(
    JSON.stringify(notes[0]),
    /Ngozi|Eze|ngozi@|c0000000-0000-4000-8000-000000000001/,
  )
  assert.equal(db.rows('booking_interests')[0].cook_notified_at != null, true)
})

test('a repeat press is a clear "already requested", not an error and not a second row', async () => {
  const { db } = world()
  await post({ cook_id: COOK, notify_when_verified: true })
  const again = await post({ cook_id: COOK, notify_when_verified: true })
  assert.equal(again.status, 200)
  assert.equal(again.body.duplicate, true)
  assert.equal(again.body.message, copy.INTEREST_DUPLICATE_MESSAGE)
  assert.equal(active(db).length, 1)
  assert.equal(
    db.rows('notifications').filter((n) => n.user_id === COOK).length,
    1,
    'the cook is not told twice',
  )
})

test('two presses at the same instant still leave exactly one request', async () => {
  const { db } = world()
  const results = await Promise.all([
    post({ cook_id: COOK, notify_when_verified: true }),
    post({ cook_id: COOK, notify_when_verified: true }),
  ])
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 201])
  assert.equal(results.filter((r) => r.body.duplicate).length, 1)
  assert.equal(active(db).length, 1)
  assert.equal(
    db.rows('notifications').filter((n) => n.user_id === COOK).length,
    1,
  )
})

test('a request saved WITHOUT notifications (the old button) is switched on by one press', async () => {
  const { db } = world()
  db.rows('booking_interests').push({
    id: 'old',
    customer_id: CUSTOMER,
    cook_id: COOK,
    status: 'active',
    notify_when_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  const r = await post({ cook_id: COOK, notify_when_verified: true })
  assert.equal(r.status, 200)
  assert.equal(r.body.duplicate, false)
  assert.equal(r.body.message, copy.INTEREST_SAVED_MESSAGE)
  assert.equal(db.rows('booking_interests').length, 1)
  assert.equal(db.rows('booking_interests')[0].notify_when_verified, true)
})

test('the customer comes from the session, never from the request body', async () => {
  const { db } = world()
  addMember(db, {
    id: 'c0000000-0000-4000-8000-000000000009',
    role: 'buyer',
    name: 'Someone Else',
    email: 'else@example.com',
  })
  const r = await post({
    cook_id: COOK,
    notify_when_verified: true,
    customer_id: 'c0000000-0000-4000-8000-000000000009',
    status: 'fulfilled',
    notify_when_verified_for: 'x',
  })
  assert.equal(r.status, 201)
  assert.equal(db.rows('booking_interests')[0].customer_id, CUSTOMER)
  assert.equal(
    db.rows('booking_interests')[0].status,
    'active',
    'status can not be chosen either',
  )
})

test('only real, unverified cooks can be asked about', async () => {
  const { db } = world()
  assert.equal(
    (await post({ cook_id: 'not-a-uuid', notify_when_verified: true })).status,
    400,
  )
  assert.equal(
    (
      await post({
        cook_id: 'c0000000-0000-4000-8000-0000000000ff',
        notify_when_verified: true,
      })
    ).status,
    400,
    'unknown cook',
  )
  assert.equal(
    (await post({ cook_id: CUSTOMER, notify_when_verified: true })).status,
    400,
    'a buyer is not a cook',
  )
  assert.equal(
    (await post({ cook_id: COOK })).status,
    400,
    'consent must be stated, never assumed',
  )
  db.rows('profiles').find((p) => p.id === COOK).suspended = true
  assert.equal(
    (await post({ cook_id: COOK, notify_when_verified: true })).status,
    400,
    'suspended',
  )
  db.rows('profiles').find((p) => p.id === COOK).suspended = false
  db.rows('profiles').find((p) => p.id === COOK).kyc_status = 'verified'
  const verified = await post({ cook_id: COOK, notify_when_verified: true })
  assert.equal(verified.status, 409)
  assert.equal(verified.body.code, 'already_bookable')
  assert.equal(db.rows('booking_interests').length, 0)
})

test('customers only: cooks and unfinished or suspended accounts are refused', async () => {
  const { db } = world()
  globalThis.__f4lCurrentUser = { id: COOK }
  assert.equal(
    (await post({ cook_id: COOK, notify_when_verified: true })).status,
    400,
    'not yourself',
  )
  const other = 'c0000000-0000-4000-8000-000000000003'
  addMember(db, {
    id: other,
    role: 'cook',
    name: 'Other Cook',
    email: 'o@example.com',
  })
  assert.equal(
    (await post({ cook_id: other, notify_when_verified: true })).status,
    403,
    'a cook is not a customer',
  )
  globalThis.__f4lCurrentUser = { id: CUSTOMER }
  db.rows('profiles').find((p) => p.id === CUSTOMER).onboarding_complete = false
  assert.equal(
    (await post({ cook_id: COOK, notify_when_verified: true })).status,
    403,
  )
  db.rows('profiles').find((p) => p.id === CUSTOMER).onboarding_complete = true
  db.rows('profiles').find((p) => p.id === CUSTOMER).suspended = true
  assert.equal(
    (await post({ cook_id: COOK, notify_when_verified: true })).status,
    403,
  )
})

test('the adult-confirmation rule applies here exactly as it does to matching', async () => {
  const { db } = world()
  db.rows('profiles').find((p) => p.id === CUSTOMER).age_confirmed_at = null
  const r = await post({ cook_id: COOK, notify_when_verified: true })
  assert.equal(r.status, 403)
  assert.equal(db.rows('booking_interests').length, 0)
})

test('withdrawing is limited to your own request, and asking again straight away is paced', async () => {
  const { db } = world()
  await post({ cook_id: COOK, notify_when_verified: true })
  globalThis.__f4lCurrentUser = { id: 'c0000000-0000-4000-8000-0000000000aa' }
  assert.equal(
    (await withdraw({ cook_id: COOK })).status,
    404,
    "someone else's request is untouched",
  )
  assert.equal(active(db).length, 1)
  globalThis.__f4lCurrentUser = { id: CUSTOMER }
  assert.equal((await withdraw({ cook_id: COOK })).status, 200)
  assert.equal(active(db).length, 0)
  const again = await post({ cook_id: COOK, notify_when_verified: true })
  assert.equal(again.status, 429)
  assert.equal(again.body.code, 'recently_withdrawn')
})

test('a flood is stopped by the database count, not by memory on one server', async () => {
  const { db } = world()
  for (let i = 0; i < 20; i++)
    db.rows('booking_interests').push({
      id: `r${i}`,
      customer_id: CUSTOMER,
      cook_id: `c0000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`,
      status: 'active',
      notify_when_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  const r = await post({ cook_id: COOK, notify_when_verified: true })
  assert.equal(r.status, 429)
  assert.equal(r.body.code, 'rate_limited')
})

test('with the table missing the customer is told the plain failure, never a fake success', async () => {
  const { db } = world()
  db.config.booking_interests.missing = true
  const original = console.error
  const logged = []
  console.error = (...args) => logged.push(args.join(' '))
  try {
    const r = await post({ cook_id: COOK, notify_when_verified: true })
    assert.equal(r.status, 503)
    assert.equal(r.body.error, copy.INTEREST_FAILED_MESSAGE)
    assert.equal(r.body.code, 'unavailable')
    assert.ok(
      logged.some((l) =>
        /supabase-migration-booking-verification\.sql/.test(l),
      ),
      'the team is told which migration is missing',
    )
  } finally {
    console.error = original
  }
})

// ---- the email worker
const customerEmail = (n) => ({
  id: `c0000000-0000-4000-8000-00000000a0${n}`,
  email: `buyer${n}@example.com`,
})

async function interested(db, who = [{ id: CUSTOMER }]) {
  for (const w of who) {
    globalThis.__f4lCurrentUser = { id: w.id }
    const r = await post({ cook_id: COOK, notify_when_verified: true })
    assert.equal(r.status, 201)
  }
}
const run = (db, over = {}) =>
  worker.processInterestEmails(db, { appUrl: APP, ...over })
const delivery = (db) =>
  db.rows('email_deliveries').filter((d) => d.kind === 'interest_verified')

test('approval: the interested customer gets ONE branded email with a link to the cook', async () => {
  const { db, mail } = world()
  await interested(db)
  approve(db)
  assert.equal(
    db.rows('notifications').filter((n) => n.user_id === CUSTOMER).length,
    1,
    'in-app notification written',
  )
  const summary = await run(db, { cookId: COOK })
  assert.deepEqual(summary, {
    checked: 1,
    sent: 1,
    cancelled: 0,
    failed: 0,
    notConfigured: 0,
    reconciled: 0,
  })
  assert.equal(mail.requests.length, 1)
  assert.deepEqual(mail.requests[0].to, ['ngozi@example.com'])
  assert.match(mail.requests[0].subject, /Chef Ada Obi is now verified/)
  assert.ok(mail.requests[0].text.includes(`${APP}/cook/${COOK}`))
  assert.equal(delivery(db)[0].status, 'accepted')
  assert.equal(delivery(db)[0].attempts, 1)
  // "accepted by the provider" is recorded as exactly that, never as delivered
  assert.notEqual(delivery(db)[0].status, 'delivered')
})

test('running the worker again, or approving again, never sends a second email', async () => {
  const { db, mail } = world()
  await interested(db)
  approve(db)
  await run(db, { cookId: COOK })
  await run(db, { cookId: COOK })
  await run(db)
  assert.equal(mail.requests.length, 1)
  // a repeated approval event: the trigger's outbox insert and notification are both no-ops
  for (const i of db.rows('booking_interests')) i.status = 'active'
  db.rows('profiles').find((p) => p.id === COOK).kyc_status = 'unverified'
  approve(db)
  assert.equal(
    delivery(db).length,
    1,
    'still one outbox row for the one interest',
  )
  assert.equal(
    db.rows('notifications').filter((n) => n.user_id === CUSTOMER).length,
    1,
    'still one in-app notification',
  )
  await run(db)
  assert.equal(mail.messages.size, 1)
})

test('even if the "sent" status is lost, the provider still refuses to send it twice', async () => {
  const { db, mail } = world()
  await interested(db)
  approve(db)
  await run(db)
  delivery(db)[0].status = 'queued' // simulate a lost update after the send
  delivery(db)[0].attempts = 0
  await run(db)
  assert.equal(
    mail.messages.size,
    1,
    'the idempotency key made it a no-op at the provider',
  )
})

test('no consent: nothing is queued, and a manually queued row is cancelled, not sent', async () => {
  const { db, mail } = world()
  db.rows('booking_interests').push({
    id: 'i1',
    customer_id: CUSTOMER,
    cook_id: COOK,
    status: 'active',
    notify_when_verified: false,
  })
  approve(db)
  assert.equal(
    delivery(db).length,
    0,
    'the trigger queues only for customers who asked',
  )
  assert.equal(db.rows('notifications').length, 0)
  db.rows('email_deliveries').push({
    id: 'd',
    kind: 'interest_verified',
    recipient_key: 'i1',
    status: 'queued',
    attempts: 0,
    next_attempt_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  const summary = await run(db)
  assert.equal(summary.cancelled, 1)
  assert.equal(delivery(db)[0].status, 'cancelled')
  assert.equal(delivery(db)[0].last_error_code, 'no_consent')
  assert.equal(mail.requests.length, 0)
})

test('a cook who lost verification before the email went out is not announced as available', async () => {
  const { db, mail } = world()
  await interested(db)
  approve(db)
  db.rows('profiles').find((p) => p.id === COOK).kyc_status = 'unverified' // revoked in between
  const summary = await run(db)
  assert.equal(summary.cancelled, 1)
  assert.equal(delivery(db)[0].last_error_code, 'cook_no_longer_verified')
  assert.equal(mail.requests.length, 0)
  assert.equal(
    db.rows('booking_interests')[0].status,
    'fulfilled',
    'the history is kept',
  )
})

test('opt-outs and unusable accounts are respected at send time', async () => {
  const cases = [
    [
      'email_opt_out',
      (db) =>
        (db
          .rows('profiles')
          .find((p) => p.id === CUSTOMER).notification_preferences = {
          bookings: false,
        }),
    ],
    [
      'customer_unavailable',
      (db) =>
        (db.rows('profiles').find((p) => p.id === CUSTOMER).suspended = true),
    ],
    [
      'unconfirmed_email',
      (db) =>
        (db.auth.admin.users.find((u) => u.id === CUSTOMER).email_confirmed_at =
          null),
    ],
    [
      'no_email',
      (db) => (db.auth.admin.users.find((u) => u.id === CUSTOMER).email = null),
    ],
  ]
  for (const [reason, change] of cases) {
    const { db, mail } = world()
    await interested(db)
    approve(db)
    change(db)
    const summary = await run(db)
    assert.equal(summary.cancelled, 1, reason)
    assert.equal(delivery(db)[0].last_error_code, reason)
    assert.equal(mail.requests.length, 0, reason)
  }
})

test('a provider failure is recorded, scheduled for retry, and later succeeds without duplicating', async () => {
  const { db, mail } = world()
  await interested(db)
  approve(db)
  mail.mode = 'fail'
  const first = await run(db)
  assert.equal(first.failed, 1)
  const row = delivery(db)[0]
  assert.equal(row.status, 'failed')
  assert.equal(row.attempts, 1)
  assert.equal(row.last_error_code, 'http_500')
  assert.ok(
    new Date(row.next_attempt_at).getTime() > Date.now(),
    'a retry time was stored',
  )
  assert.equal(mail.messages.size, 0)

  mail.mode = 'ok'
  const early = await run(db)
  assert.equal(early.checked, 0, 'not due yet, so not retried early')
  assert.equal(mail.requests.length, 1)

  row.next_attempt_at = new Date(Date.now() - 1000).toISOString() // time passes
  const retry = await run(db)
  assert.equal(retry.sent, 1)
  assert.equal(delivery(db)[0].status, 'accepted')
  assert.equal(delivery(db)[0].attempts, 2)
  assert.equal(mail.messages.size, 1)
})

test('after the retry limit it gives up and stops trying', async () => {
  const { db, mail } = world()
  await interested(db)
  approve(db)
  mail.mode = 'fail'
  for (let i = 0; i < 8; i++) {
    // time passes: whatever retry time was stored has arrived
    if (delivery(db)[0].next_attempt_at)
      delivery(db)[0].next_attempt_at = new Date(
        Date.now() - 1000,
      ).toISOString()
    await run(db)
  }
  assert.equal(delivery(db)[0].attempts, transactional.MAX_ATTEMPTS)
  assert.equal(delivery(db)[0].status, 'failed')
  assert.equal(
    delivery(db)[0].next_attempt_at,
    null,
    'the last failure stores no further retry time: it is finished',
  )
  const calls = mail.requests.length
  assert.equal(
    calls,
    transactional.MAX_ATTEMPTS,
    'exactly the allowed attempts',
  )
  await run(db)
  assert.equal(
    mail.requests.length,
    calls,
    'no more attempts once it has given up',
  )
})

test('every retry time the worker stores is in the future and inside the backoff band', async () => {
  const { db, mail } = world()
  await interested(db)
  approve(db)
  mail.mode = 'fail'
  const p = DEFAULT_RETRY_POLICY
  for (let attempt = 1; attempt < p.maxAttempts; attempt++) {
    const before = Date.now()
    await run(db)
    const row = delivery(db)[0]
    assert.equal(row.attempts, attempt)
    const wait = new Date(row.next_attempt_at).getTime() - before
    const ceiling = Math.min(p.baseMs * 2 ** (attempt - 1), p.maxMs)
    assert.ok(
      wait >= ceiling * (1 - p.jitter) - 50 && wait <= ceiling + 2000,
      `attempt ${attempt}: waited ${wait}ms, expected ${ceiling * 0.5}..${ceiling}`,
    )
    row.next_attempt_at = new Date(Date.now() - 1000).toISOString()
  }
})

test('a request the provider rejects as invalid is not retried', async () => {
  const { db, mail } = world()
  await interested(db)
  approve(db)
  mail.mode = 'fail'
  mail.failStatus = 422
  const first = await run(db)
  assert.equal(first.failed, 1)
  const row = delivery(db)[0]
  assert.equal(row.status, 'failed')
  assert.equal(row.last_error_code, 'http_422', 'the reason stays visible')
  assert.equal(row.attempts, 1, 'the history of the attempt is kept as it was')
  assert.equal(row.next_attempt_at, null, 'no retry is scheduled')
  mail.mode = 'ok'
  const again = await run(db)
  assert.equal(again.checked, 0)
  assert.equal(mail.requests.length, 1, 'never sent a second time')
})

test("a provider's Retry-After pushes the retry out, and a credentials problem waits at the cap", async () => {
  const p = DEFAULT_RETRY_POLICY
  {
    const { db, mail } = world()
    await interested(db)
    approve(db)
    mail.mode = 'fail'
    mail.failStatus = 429
    mail.retryAfter = '7200' // two hours
    const before = Date.now()
    await run(db)
    const wait = new Date(delivery(db)[0].next_attempt_at).getTime() - before
    assert.ok(
      wait >= 7200_000 - 50 && wait <= 7200_000 + 2000,
      `waited ${wait}`,
    )
  }
  {
    const { db, mail } = world()
    await interested(db)
    approve(db)
    mail.mode = 'fail'
    mail.failStatus = 403
    const before = Date.now()
    await run(db)
    const row = delivery(db)[0]
    assert.equal(row.attempts, 1)
    const wait = new Date(row.next_attempt_at).getTime() - before
    assert.ok(
      wait >= p.maxMs * (1 - p.jitter) - 50 && wait <= p.maxMs + 2000,
      'waits hours, not minutes, so a fixable setting is not used up in an hour',
    )
  }
})

test('one customer failing does not stop the others (partial delivery)', async () => {
  const { db, mail } = world()
  const people = [customerEmail(1), customerEmail(2), customerEmail(3)]
  for (const p of people)
    addMember(db, {
      id: p.id,
      role: 'buyer',
      name: `Buyer ${p.id.slice(-1)}`,
      email: p.email,
    })
  await interested(db, people)
  approve(db)
  mail.failFor.add('buyer2@example.com')
  const summary = await run(db)
  assert.equal(summary.sent, 2)
  assert.equal(summary.failed, 1)
  const states = Object.fromEntries(
    delivery(db).map((d) => [
      db
        .rows('booking_interests')
        .find((i) => i.id === d.recipient_key)
        .customer_id.slice(-1),
      d.status,
    ]),
  )
  assert.deepEqual(states, { 1: 'accepted', 2: 'failed', 3: 'accepted' })
})

test('two workers at once send each email exactly once', async () => {
  const { db, mail } = world()
  const people = [
    customerEmail(1),
    customerEmail(2),
    customerEmail(3),
    customerEmail(4),
  ]
  for (const p of people)
    addMember(db, { id: p.id, role: 'buyer', name: 'B', email: p.email })
  await interested(db, people)
  approve(db)
  const [a, b] = await Promise.all([run(db), run(db)])
  assert.equal(a.sent + b.sent, 4)
  assert.equal(
    new Set(mail.requests.map((r) => r.key)).size,
    mail.requests.length,
    'no key was used twice',
  )
  assert.equal(mail.requests.length, 4)
  assert.equal(mail.messages.size, 4)
})

test('a worker that died mid-send is taken over; one that is still working is left alone', async () => {
  const { db, mail } = world()
  const people = [customerEmail(1), customerEmail(2)]
  for (const p of people)
    addMember(db, { id: p.id, role: 'buyer', name: 'B', email: p.email })
  await interested(db, people)
  approve(db)
  const [stale, fresh] = delivery(db)
  stale.status = 'processing'
  stale.updated_at = new Date(Date.now() - 11 * 60 * 1000).toISOString()
  fresh.status = 'processing'
  fresh.updated_at = new Date(Date.now() - 60 * 1000).toISOString()
  const summary = await run(db)
  assert.equal(summary.sent, 1, 'only the abandoned one')
  assert.equal(stale.status, 'accepted')
  assert.equal(fresh.status, 'processing', 'the live one is untouched')
  assert.equal(mail.requests.length, 1)
})

test('email not configured: nothing is lost, no attempt is burned, and it sends once configured', async () => {
  const { db, mail } = world()
  await interested(db)
  approve(db)
  const key = process.env.RESEND_API_KEY
  delete process.env.RESEND_API_KEY
  const first = await run(db)
  assert.equal(first.notConfigured, 1)
  assert.equal(delivery(db)[0].status, 'queued')
  assert.equal(delivery(db)[0].attempts, 0)
  assert.equal(mail.requests.length, 0)
  process.env.RESEND_API_KEY = key
  assert.equal((await run(db)).sent, 1)
})

test("restricting to one cook only sends that cook's emails", async () => {
  const { db, mail } = world()
  const cookB = 'c0000000-0000-4000-8000-0000000000b2'
  addMember(db, {
    id: cookB,
    role: 'cook',
    name: 'Chef Bola',
    email: 'bola@example.com',
  })
  await interested(db)
  globalThis.__f4lCurrentUser = { id: CUSTOMER }
  assert.equal(
    (await post({ cook_id: cookB, notify_when_verified: true })).status,
    201,
  )
  approve(db, COOK)
  approve(db, cookB)
  const summary = await run(db, { cookId: cookB })
  assert.equal(summary.sent, 1)
  assert.match(mail.requests[0].subject, /Chef Bola/)
  assert.equal(
    delivery(db).filter((d) => d.status === 'queued').length,
    1,
    "the other cook's email is still queued",
  )
})

test('the delivery table missing means nothing is queued and nothing breaks', async () => {
  const { db, mail } = world()
  await interested(db)
  db.config.email_deliveries = { missing: true }
  const summary = await run(db)
  assert.deepEqual(summary, {
    checked: 0,
    sent: 0,
    cancelled: 0,
    failed: 0,
    notConfigured: 0,
    reconciled: 0,
  })
  assert.equal(mail.requests.length, 0)
})

// ================================================================== 4. scheduled processing
// The scheduler (Vercel Cron, GitHub Actions, pg_cron) calls this route with a bearer secret.
// There is no session, so the secret IS the access control; these tests pin that.
import { verifyCronRequest } from '../src/lib/cron/auth.ts'

const cronRoute =
  await import('../src/app/api/cron/process-notifications/route.ts')
const CRON_SECRET = 'cron-test-secret-0123456789abcdef0123456789'

function cronCall(method = 'GET', headers = {}, query = '') {
  return cronRoute[method](
    new Request(
      `https://app.example.test/api/cron/process-notifications${query}`,
      { method, headers },
    ),
  )
}
const asScheduler = (method = 'GET') =>
  cronCall(method, { authorization: `Bearer ${CRON_SECRET}` })

async function withCronSecret(value, fn) {
  const before = process.env.CRON_SECRET
  if (value === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = value
  try {
    return await fn()
  } finally {
    if (before === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = before
  }
}

test('scheduler auth: only the exact bearer secret passes, and no secret means nobody passes', () => {
  assert.equal(verifyCronRequest(`Bearer ${CRON_SECRET}`, CRON_SECRET), 'ok')
  assert.equal(
    verifyCronRequest(`Bearer ${CRON_SECRET}`, `  ${CRON_SECRET}\n`),
    'ok',
    'whitespace around the stored value is ignored',
  )
  for (const header of [
    null,
    undefined,
    '',
    'Bearer',
    'Bearer ',
    CRON_SECRET, // no scheme
    `Basic ${CRON_SECRET}`,
    `bearer ${CRON_SECRET}`,
    `Bearer ${CRON_SECRET}x`,
    `Bearer x${CRON_SECRET}`,
    `Bearer ${CRON_SECRET.slice(0, -1)}`,
    `Bearer ${CRON_SECRET} extra`,
    'Bearer wrong-secret-wrong-secret-wrong-secret',
  ]) {
    assert.equal(
      verifyCronRequest(header, CRON_SECRET),
      'unauthorized',
      String(header),
    )
  }
  // fail closed: a missing, blank or guessable-short secret never authenticates anything
  for (const secret of [undefined, null, '', '   ', 'short', 'x'.repeat(31)]) {
    assert.equal(
      verifyCronRequest(`Bearer ${secret}`, secret),
      'not_configured',
      String(secret),
    )
    assert.equal(verifyCronRequest(null, secret), 'not_configured')
  }
})

test('scheduled processing: refuses everyone when no secret is configured, even with a header', async () => {
  const { db, mail } = world()
  await interested(db)
  approve(db)
  await withCronSecret(undefined, async () => {
    for (const method of ['GET', 'POST']) {
      const response = await cronCall(method, {
        authorization: `Bearer ${CRON_SECRET}`,
      })
      assert.equal(response.status, 503)
      assert.deepEqual(await response.json(), {
        error: 'Scheduled processing is not configured',
      })
    }
  })
  assert.equal(mail.requests.length, 0)
  assert.equal(delivery(db)[0].status, 'queued', 'nothing was touched')
})

test('scheduled processing: wrong, missing or misplaced secrets get 401 and change nothing', async () => {
  const { db, mail } = world()
  await interested(db)
  approve(db)
  await withCronSecret(CRON_SECRET, async () => {
    const attempts = [
      cronCall('GET'),
      cronCall('POST'),
      cronCall('GET', { authorization: 'Bearer nope' }),
      cronCall('GET', { authorization: CRON_SECRET }),
      // the secret in the address is never accepted (addresses are logged)
      cronCall('GET', {}, `?secret=${CRON_SECRET}&token=${CRON_SECRET}`),
      cronCall('GET', { 'x-cron-secret': CRON_SECRET }),
      cronCall('GET', { cookie: `CRON_SECRET=${CRON_SECRET}` }),
    ]
    for (const response of await Promise.all(attempts)) {
      assert.equal(response.status, 401)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.deepEqual(await response.json(), { error: 'Unauthorized' })
    }
  })
  assert.equal(mail.requests.length, 0)
  assert.equal(delivery(db)[0].status, 'queued')
})

test('scheduled processing: the right secret drains the queue, returns counts only, and is idempotent', async () => {
  const { db, mail } = world()
  const people = [customerEmail(1), customerEmail(2)]
  for (const p of people)
    addMember(db, { id: p.id, role: 'buyer', name: 'B', email: p.email })
  await interested(db, [{ id: CUSTOMER }, ...people])
  approve(db)
  await withCronSecret(CRON_SECRET, async () => {
    const first = await asScheduler('GET')
    assert.equal(first.status, 200)
    assert.equal(first.headers.get('cache-control'), 'no-store')
    const body = await first.json()
    assert.equal(body.ok, true)
    assert.equal(body.sent, 3)
    assert.deepEqual(
      Object.keys(body).sort(),
      [
        'batches',
        'cancelled',
        'checked',
        'failed',
        'notConfigured',
        'ok',
        'reconciled',
        'referral_rewards',
        'sent',
      ],
      'counts only: no addresses, names or ids',
    )
    assert.doesNotMatch(JSON.stringify(body), /@|c0000000|Ngozi/)
    assert.equal(mail.messages.size, 3)

    // the scheduler fires again, by GET and by POST: nothing new is sent
    for (const method of ['GET', 'POST', 'GET']) {
      const again = await (await asScheduler(method)).json()
      assert.equal(again.sent, 0)
      assert.equal(again.checked, 0)
    }
  })
  assert.equal(mail.requests.length, 3, 'one provider call per customer, ever')
  assert.ok(delivery(db).every((d) => d.status === 'accepted'))
})

test('scheduled processing: ten runs firing at the same instant send each email once', async () => {
  const { db, mail } = world()
  const people = [1, 2, 3, 4, 5].map(customerEmail)
  for (const p of people)
    addMember(db, { id: p.id, role: 'buyer', name: 'B', email: p.email })
  await interested(db, people)
  approve(db)
  await withCronSecret(CRON_SECRET, async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => asScheduler('POST')),
    )
    assert.ok(results.every((r) => r.status === 200))
    const sent = (await Promise.all(results.map((r) => r.json()))).reduce(
      (n, b) => n + b.sent,
      0,
    )
    assert.equal(sent, 5, 'exactly one run owned each email')
  })
  assert.equal(mail.messages.size, 5)
  assert.equal(
    new Set(mail.requests.map((r) => r.key)).size,
    mail.requests.length,
    'not even a duplicate provider request was made',
  )
})

test('scheduled processing: also covers cooks verified by hand, retries, and crashed workers', async () => {
  const { db, mail } = world()
  const people = [customerEmail(1), customerEmail(2), customerEmail(3)]
  for (const p of people)
    addMember(db, { id: p.id, role: 'buyer', name: 'B', email: p.email })
  await interested(db, people)
  approve(db) // verified by any path: the trigger queued the emails, nobody called the worker
  const [crashed, waiting, failedDue] = delivery(db)
  crashed.status = 'processing' // a worker died holding this one
  crashed.updated_at = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  waiting.status = 'failed' // not due yet: must be left alone
  waiting.attempts = 1
  waiting.next_attempt_at = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  failedDue.status = 'failed' // due: must be retried
  failedDue.attempts = 2
  failedDue.next_attempt_at = new Date(Date.now() - 1000).toISOString()
  await withCronSecret(CRON_SECRET, async () => {
    const body = await (await asScheduler()).json()
    assert.equal(body.sent, 2)
  })
  assert.equal(crashed.status, 'accepted')
  assert.equal(failedDue.status, 'accepted')
  assert.equal(waiting.status, 'failed', 'its retry time has not come')
  assert.equal(mail.messages.size, 2)
})

test('scheduled processing: rows that are not ready can never starve the ones that are', async () => {
  const { db, mail } = world()
  await interested(db)
  approve(db)
  const old = '2026-01-01T00:00:00.000Z'
  for (let i = 0; i < 60; i++) {
    db.rows('email_deliveries').push({
      id: `junk-${i}`,
      kind: 'interest_verified',
      recipient_key: `ghost-${i}`,
      // half are waiting for a retry time, half were given up on (permanent failure)
      status: 'failed',
      attempts: 1,
      last_error_code: i % 2 ? 'http_422' : 'http_500',
      next_attempt_at:
        i % 2 ? null : new Date(Date.now() + 3600_000).toISOString(),
      created_at: old, // older than the real email, so they sort first
      updated_at: old,
    })
  }
  await withCronSecret(CRON_SECRET, async () => {
    const body = await (await asScheduler()).json()
    assert.equal(body.sent, 1, 'the ready email went out')
    assert.equal(body.checked, 1)
  })
  assert.equal(mail.messages.size, 1)
  const junk = delivery(db).filter((d) => d.id.startsWith('junk'))
  assert.equal(junk.length, 60)
  assert.ok(
    junk.every((d) => d.status === 'failed' && d.attempts === 1),
    'the others were left exactly as they were',
  )
})

test('scheduled processing: a run cannot loop forever when email is not configured', async () => {
  const { db, mail } = world()
  await interested(db)
  approve(db)
  const key = process.env.RESEND_API_KEY
  delete process.env.RESEND_API_KEY
  try {
    await withCronSecret(CRON_SECRET, async () => {
      const body = await (await asScheduler()).json()
      assert.equal(body.sent, 0)
      assert.equal(body.notConfigured, 1)
      assert.equal(body.batches, 1, 'stopped after a batch with no progress')
    })
  } finally {
    process.env.RESEND_API_KEY = key
  }
  assert.equal(delivery(db)[0].status, 'queued', 'waits, loses nothing')
  assert.equal(delivery(db)[0].attempts, 0)
  assert.equal(mail.requests.length, 0)
  await withCronSecret(CRON_SECRET, async () => {
    assert.equal((await (await asScheduler()).json()).sent, 1)
  })
})

test('scheduled processing: it will not build links from an unconfigured address, and a crash leaks nothing', async () => {
  const { db, mail } = world()
  await interested(db)
  approve(db)
  await withCronSecret(CRON_SECRET, async () => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    delete process.env.NEXT_PUBLIC_APP_URL
    const noUrl = await asScheduler()
    process.env.NEXT_PUBLIC_APP_URL = appUrl
    assert.equal(noUrl.status, 503)
    assert.equal(mail.requests.length, 0, 'no email with a guessed link')

    const original = console.error
    console.error = () => {}
    globalThis.__f4lFakeAdmin = {
      from() {
        throw new Error(`boom service-role-key-123 ${CRON_SECRET}`)
      },
    }
    try {
      const broken = await asScheduler()
      assert.equal(broken.status, 500)
      const text = await broken.text()
      assert.equal(text, JSON.stringify({ error: 'Processing failed' }))
      assert.doesNotMatch(text, /boom|service-role|cron-test-secret/)
    } finally {
      console.error = original
      globalThis.__f4lFakeAdmin = db
    }
  })
})

test('the scheduler route is wired safely: no session shortcuts, no secret in logs, outside the session middleware', () => {
  const src = read('src/app/api/cron/process-notifications/route.ts')
  assert.match(src, /verifyCronRequest\(/)
  assert.match(src, /process\.env\.CRON_SECRET/)
  assert.doesNotMatch(
    src,
    /searchParams|nextUrl|new URL\(/,
    'never reads the URL',
  )
  assert.doesNotMatch(
    src,
    /console\.(log|info|error)\([^)]*(secret|authorization)/i,
  )
  assert.doesNotMatch(
    src,
    /SERVICE_ROLE/,
    'the service key stays in the admin client',
  )
  assert.match(src, /export const GET = handle/)
  assert.match(src, /export const POST = handle/)
  assert.match(src, /dynamic = 'force-dynamic'/)
  assert.match(read('src/middleware.ts'), /api\/cron\//)
  const vercel = JSON.parse(read('vercel.json'))
  assert.deepEqual(vercel.git.deploymentEnabled, {
    '*': false,
    develop: true,
  })
  assert.deepEqual(
    vercel.crons.map((c) => c.path),
    ['/api/cron/process-notifications', '/api/cron/process-email-campaigns'],
  )
  // Vercel's free plan only accepts crons that run at most once a day. A faster schedule
  // there makes the whole deployment fail, so the committed one must be a daily floor.
  for (const cron of vercel.crons) {
    const [minute, hour, dayOfMonth, month, dayOfWeek] =
      cron.schedule.split(' ')
    assert.match(minute, /^\d+$/, 'a fixed minute')
    assert.match(hour, /^\d+$/, 'a fixed hour, so it runs once a day at most')
    assert.equal([dayOfMonth, month, dayOfWeek].join(' '), '* * *')
  }
  const campaigns = read('src/app/api/cron/process-email-campaigns/route.ts')
  assert.match(campaigns, /verifyCronRequest\(/)
  assert.match(campaigns, /process\.env\.CRON_SECRET/)
  assert.match(campaigns, /scheduled_at/)
  assert.doesNotMatch(
    campaigns,
    /console\.(log|info|error)\([^)]*(secret|authorization)/i,
  )
  assert.match(
    read('.env.example'),
    /^CRON_SECRET=$/m,
    'documented, with no value',
  )
})

// ================================================================== 5. SQL safety (static)
// No Postgres is available to run the migrations here, so these pin what can be checked by
// reading them: order/prerequisites, atomicity, and that the diagnostic can never write.
const stripSql = (sql) =>
  sql
    .replace(/--[^\n]*/g, '') // comments
    .replace(/'(?:[^']|'')*'/g, "''") // string literals

test('the readiness diagnostic is read-only and never selects personal data', () => {
  const sql = read('supabase-diagnostic-readiness-check.sql')
  const code = stripSql(sql)
  assert.doesNotMatch(
    code,
    /\b(insert|update|delete|create|alter|drop|grant|revoke|truncate|copy|call|execute|vacuum|reindex|set|reset|do|merge)\b/i,
    'only SELECT statements',
  )
  assert.match(code, /^\s*select /i, 'starts with a select')
  assert.doesNotMatch(
    code,
    /\b(email|full_name|phone|password|encrypted_password|token|raw_user_meta_data)\b/i,
    'no personal columns',
  )
  // every optional Part B statement is commented out, so pasting the whole file runs Part A only
  assert.equal((code.match(/;/g) ?? []).length, 1, 'exactly one statement runs')
})

test('migrations: ordered prerequisites, atomic, and nothing destructive', () => {
  for (const file of [
    'supabase-migration-interest-verification-email.sql',
    'supabase-migration-tester-invitations.sql',
  ]) {
    const code = stripSql(read(file))
    assert.match(code, /^\s*begin;/im, `${file} runs in one transaction`)
    assert.match(code, /^\s*commit;/im, file)
    assert.doesNotMatch(
      code,
      /\b(drop\s+table|truncate|delete\s+from)\b/i,
      `${file} never removes data`,
    )
    assert.doesNotMatch(code, /disable\s+row\s+level\s+security/i, file)
    assert.doesNotMatch(
      code,
      /\bto\s+(anon|public)\b/i,
      `${file} grants nothing to browsers`,
    )
  }
  const interest = read('supabase-migration-interest-verification-email.sql')
  assert.match(interest, /to_regclass\('public\.booking_interests'\) is null/)
  assert.match(interest, /to_regclass\('public\.email_deliveries'\) is null/)
  assert.ok(
    interest.indexOf('to_regclass') < interest.indexOf('drop constraint'),
    'prerequisites are checked before anything is changed',
  )
  assert.match(
    interest,
    /raise warning 'interest_verified outbox insert failed/,
    'a failed outbox insert is logged, never silent',
  )
  assert.match(
    interest,
    /exception when others then/,
    'and still never blocks verification',
  )
  // the order the handover tells the owner to apply them in really is what the files require
  assert.match(
    read('supabase-migration-tester-invitations.sql'),
    /interest-verification-email\.sql first/,
  )
})

// ================================================================== 6. Resend webhook and the new email kinds
// "Accepted by Resend" is not "in the inbox". The webhook is what moves an email on from
// accepted to delivered or bounced, matching by the provider's message id. These tests run
// the REAL webhook route with a correctly signed fake event (no network, no real Resend).
import { createHmac } from 'node:crypto'

const webhook = await import('../src/app/api/webhooks/resend/route.ts')
const WEBHOOK_SECRET = `whsec_${Buffer.from('webhook-test-key-0123456789ab').toString('base64')}`

function signedEvent(
  type,
  messageId,
  {
    id = `evt-${type}-${messageId}`,
    secret = WEBHOOK_SECRET,
    tamper = false,
  } = {},
) {
  const body = JSON.stringify({
    type,
    created_at: new Date().toISOString(),
    data: { email_id: messageId },
  })
  const timestamp = String(Math.floor(Date.now() / 1000))
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const signature = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64')
  return new Request('https://app.example.test/api/webhooks/resend', {
    method: 'POST',
    headers: {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${tamper ? 'AAAA' + signature.slice(4) : signature}`,
    },
    body,
  })
}

async function withWebhookSecret(value, fn) {
  const before = process.env.RESEND_WEBHOOK_SECRET
  if (value === undefined) delete process.env.RESEND_WEBHOOK_SECRET
  else process.env.RESEND_WEBHOOK_SECRET = value
  try {
    return await fn()
  } finally {
    if (before === undefined) delete process.env.RESEND_WEBHOOK_SECRET
    else process.env.RESEND_WEBHOOK_SECRET = before
  }
}

test('webhook: delivered and bounced move "verified cook" emails on, and a late event never undoes a bounce', async () => {
  const { db } = world()
  await interested(db)
  approve(db)
  await run(db)
  const row = delivery(db)[0]
  assert.equal(
    row.status,
    'accepted',
    'accepted is the most we know without the webhook',
  )
  assert.ok(row.provider_message_id, 'the provider id was stored for matching')

  await withWebhookSecret(WEBHOOK_SECRET, async () => {
    const delivered = await webhook.POST(
      signedEvent('email.delivered', row.provider_message_id),
    )
    assert.equal(delivered.status, 200)
    assert.equal(row.status, 'delivered')

    const bounced = await webhook.POST(
      signedEvent('email.bounced', row.provider_message_id),
    )
    assert.equal(bounced.status, 200)
    assert.equal(row.status, 'bounced')

    await webhook.POST(
      signedEvent('email.delivered', row.provider_message_id, {
        id: 'evt-late',
      }),
    )
    assert.equal(
      row.status,
      'bounced',
      'a late "delivered" cannot hide a bounce',
    )
  })
  // and the worker never tries a bounced address again
  const again = await run(db)
  assert.equal(again.checked, 0)
})

test('webhook: replays, forgeries and a missing secret change nothing', async () => {
  const { db } = world()
  await interested(db)
  approve(db)
  await run(db)
  const row = delivery(db)[0]
  const id = row.provider_message_id

  await withWebhookSecret(WEBHOOK_SECRET, async () => {
    const forged = await webhook.POST(
      signedEvent('email.delivered', id, { tamper: true }),
    )
    assert.equal(forged.status, 400)
    const wrongKey = await webhook.POST(
      signedEvent('email.delivered', id, {
        secret: `whsec_${Buffer.from('some-other-secret-0123456789').toString('base64')}`,
      }),
    )
    assert.equal(wrongKey.status, 400)
    assert.equal(row.status, 'accepted', 'unsigned events do nothing')

    const first = await webhook.POST(
      signedEvent('email.delivered', id, { id: 'evt-same' }),
    )
    const replay = await webhook.POST(
      signedEvent('email.delivered', id, { id: 'evt-same' }),
    )
    assert.equal(first.status, 200)
    assert.equal(replay.status, 200)
    assert.equal(
      db.rows('email_events').filter((e) => e.provider_event_id === 'evt-same')
        .length,
      1,
      'the same webhook id is recorded once',
    )
  })
  await withWebhookSecret(undefined, async () => {
    const response = await webhook.POST(signedEvent('email.bounced', id))
    assert.equal(
      response.status,
      503,
      'unconfigured means it refuses, never "accepts anything"',
    )
  })
  assert.equal(row.status, 'delivered')
})

test('webhook: invitation emails are tracked the same way, and the admin table words each state honestly', async () => {
  const { db } = world()
  const { describeEmailDelivery } =
    await import('../src/lib/invitations/rules.ts')
  db.rows('email_deliveries').push({
    id: 'inv-1',
    kind: 'tester_invitation',
    recipient_key: 'some-invitation:1',
    status: 'accepted',
    attempts: 1,
    provider_message_id: 'msg-invite-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  const row = db.rows('email_deliveries')[0]
  assert.equal(
    describeEmailDelivery(1, row).label,
    'Accepted by email provider',
  )
  await withWebhookSecret(WEBHOOK_SECRET, async () => {
    await webhook.POST(signedEvent('email.delivered', 'msg-invite-1'))
  })
  assert.equal(describeEmailDelivery(1, row).label, 'Delivered')
  row.status = 'bounced'
  assert.equal(describeEmailDelivery(1, row).label, 'Bounced')
  assert.equal(describeEmailDelivery(1, row).tone, 'bad')
  // "accepted" must never be worded as delivered
  for (const status of [
    'queued',
    'processing',
    'accepted',
    'failed',
    'cancelled',
  ]) {
    assert.notEqual(
      describeEmailDelivery(1, { status }).label,
      'Delivered',
      status,
    )
  }
})

// ================================================================== 7. recovering emails the outbox missed
// The trigger must never block a verification, so very rarely a customer gets the in-app notice but
// no email row. Reconciliation queues the missing row; the normal worker sends or cancels it.
const { reconcileMissedInterestEmails, RECONCILE_WINDOW_DAYS } =
  await import('../src/lib/notifications/reconcile.ts')

const DAY = 24 * 60 * 60 * 1000
const setCutover = (db, daysAgo = 3) =>
  db.rows('interest_email_cutover').push({
    id: true,
    applied_at: new Date(Date.now() - daysAgo * DAY).toISOString(),
  })
// A consenting request, fulfilled by approval, whose email row the outbox never wrote.
async function missedEmail(db, { notifiedAgoMs = 60 * 60 * 1000 } = {}) {
  await interested(db)
  approve(db)
  const interest = db.rows('booking_interests')[0]
  interest.customer_notified_at = new Date(
    Date.now() - notifiedAgoMs,
  ).toISOString()
  db.rows('email_deliveries').length = 0 // the outbox insert that failed
  return interest
}
const reconcile = (db, over = {}) => reconcileMissedInterestEmails(db, over)

test('recovery: a customer the outbox missed gets exactly one queued row, then the normal email', async () => {
  const { db, mail } = world()
  setCutover(db)
  const interest = await missedEmail(db)
  const r = await reconcile(db)
  assert.deepEqual(r, { candidates: 1, queued: 1 })
  const rows = delivery(db)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].recipient_key, interest.id)
  assert.equal(rows[0].status, 'queued')
  assert.equal(
    rows[0].last_error_code,
    'reconciled',
    'the row says why it exists',
  )
  assert.equal((await run(db)).sent, 1, 'the normal worker sends it')
  assert.equal(mail.requests.length, 1)
  assert.equal(delivery(db)[0].status, 'accepted')
  assert.equal(
    delivery(db)[0].last_error_code,
    null,
    'the marker clears once it is sent',
  )
  // running again, or the worker again, can never produce a second email
  assert.deepEqual(await reconcile(db), { candidates: 0, queued: 0 })
  await run(db)
  assert.equal(mail.requests.length, 1)
  assert.equal(delivery(db).length, 1)
  const note = db.rows('ops_events').at(-1)
  assert.equal(
    note.code,
    'interest_email_reconciled',
    'the recovery action is recorded',
  )
  assert.doesNotMatch(
    JSON.stringify(note),
    /@|ngozi|Ada/i,
    'counts only, no personal data',
  )
})

test('recovery: nothing happens before the outbox migration (no cutover row)', async () => {
  const { db, mail } = world()
  await missedEmail(db)
  assert.deepEqual(await reconcile(db), { candidates: 0, queued: 0 })
  assert.equal(delivery(db).length, 0)
  const unapplied = world()
  unapplied.db.config.interest_email_cutover = { missing: true }
  assert.deepEqual(await reconcile(unapplied.db), { candidates: 0, queued: 0 })
  assert.equal(mail.requests.length, 0)
})

test('recovery: HISTORICAL requests (fulfilled before the outbox went live) are never emailed', async () => {
  const { db, mail } = world()
  setCutover(db, 1) // outbox went live a day ago
  await missedEmail(db, { notifiedAgoMs: 5 * DAY }) // customer was told 5 days ago: before the cutover
  assert.deepEqual(await reconcile(db), { candidates: 0, queued: 0 })
  await run(db, { reconcile: true })
  assert.equal(delivery(db).length, 0)
  assert.equal(mail.requests.length, 0)
})

test(`recovery: requests older than ${RECONCILE_WINDOW_DAYS} days are too stale to announce`, async () => {
  const { db, mail } = world()
  setCutover(db, 60)
  await missedEmail(db, { notifiedAgoMs: (RECONCILE_WINDOW_DAYS + 1) * DAY })
  assert.deepEqual(await reconcile(db), { candidates: 0, queued: 0 })
  const fresh = world()
  setCutover(fresh.db, 60)
  await missedEmail(fresh.db, {
    notifiedAgoMs: (RECONCILE_WINDOW_DAYS - 1) * DAY,
  })
  assert.equal(
    (await reconcile(fresh.db)).queued,
    1,
    'inside the window it is recovered',
  )
  assert.equal(mail.requests.length, 0)
})

test('recovery: only consenting, fulfilled requests are considered', async () => {
  const { db } = world()
  setCutover(db)
  const interest = await missedEmail(db)
  for (const change of [
    { notify_when_verified: false },
    { status: 'withdrawn' },
    { status: 'active' },
  ]) {
    Object.assign(
      interest,
      { notify_when_verified: true, status: 'fulfilled' },
      change,
    )
    assert.deepEqual(
      await reconcile(db),
      { candidates: 0, queued: 0 },
      JSON.stringify(change),
    )
  }
  Object.assign(interest, {
    notify_when_verified: true,
    status: 'fulfilled',
    customer_notified_at: null,
  })
  assert.deepEqual(
    await reconcile(db),
    { candidates: 0, queued: 0 },
    'a request never marked as notified',
  )
})

test('recovery: anyone with an email row in ANY state is left alone (no spam, history kept)', async () => {
  for (const status of [
    'queued',
    'processing',
    'accepted',
    'delivered',
    'bounced',
    'failed',
    'cancelled',
  ]) {
    const { db } = world()
    setCutover(db)
    const interest = await missedEmail(db)
    db.rows('email_deliveries').push({
      id: `d-${status}`,
      kind: 'interest_verified',
      recipient_key: interest.id,
      status,
      attempts: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    assert.deepEqual(await reconcile(db), { candidates: 0, queued: 0 }, status)
    assert.equal(delivery(db).length, 1, status)
    assert.equal(delivery(db)[0].status, status, `${status} row untouched`)
  }
})

test('recovery: eligibility is re-checked at send time, so an outdated notice is cancelled, not sent', async () => {
  const cases = [
    [
      'cook_no_longer_verified',
      (db) =>
        (db.rows('profiles').find((p) => p.id === COOK).kyc_status =
          'unverified'),
    ],
    [
      'email_opt_out',
      (db) =>
        (db
          .rows('profiles')
          .find((p) => p.id === CUSTOMER).notification_preferences = {
          bookings: false,
        }),
    ],
    [
      'customer_unavailable',
      (db) =>
        (db.rows('profiles').find((p) => p.id === CUSTOMER).suspended = true),
    ],
  ]
  for (const [reason, change] of cases) {
    const { db, mail } = world()
    setCutover(db)
    await missedEmail(db)
    change(db)
    assert.equal((await reconcile(db)).queued, 1, reason)
    const summary = await run(db)
    assert.equal(summary.cancelled, 1, reason)
    assert.equal(delivery(db)[0].status, 'cancelled', reason)
    assert.equal(delivery(db)[0].last_error_code, reason)
    assert.equal(mail.requests.length, 0, `${reason}: no email`)
    assert.equal(db.rows('bookings').length, 0, 'never creates a booking')
  }
})

test('recovery: two runs at once, and a partial failure, still produce one row per customer', async () => {
  const { db } = world()
  setCutover(db)
  const people = [customerEmail(1), customerEmail(2), customerEmail(3)]
  for (const p of people)
    addMember(db, { id: p.id, role: 'buyer', name: 'B', email: p.email })
  await interested(db, people)
  approve(db)
  for (const i of db.rows('booking_interests'))
    i.customer_notified_at = new Date().toISOString()
  db.rows('email_deliveries').length = 0
  const [a, b] = await Promise.all([reconcile(db), reconcile(db)])
  assert.equal(
    a.queued + b.queued,
    3,
    'each customer was queued by exactly one of the two runs',
  )
  assert.equal(delivery(db).length, 3)
  assert.equal(new Set(delivery(db).map((d) => d.recipient_key)).size, 3)

  // partial failure: the insert fails once, nothing is queued, the next run recovers everything
  const second = world()
  setCutover(second.db)
  await missedEmail(second.db)
  const realFrom = second.db.from.bind(second.db)
  let failures = 1
  second.db.from = (table) => {
    const q = realFrom(table)
    if (table === 'email_deliveries') {
      const upsert = q.upsert.bind(q)
      q.upsert = (...args) => {
        if (failures-- > 0) {
          q.then = (resolve) =>
            resolve({
              data: null,
              error: { code: 'XX000', message: 'simulated outage' },
            })
          return q
        }
        return upsert(...args)
      }
    }
    return q
  }
  assert.deepEqual(
    await reconcile(second.db),
    { candidates: 1, queued: 0 },
    'failed insert: nothing queued, no throw',
  )
  assert.equal(delivery(second.db).length, 0)
  assert.equal(
    (await reconcile(second.db)).queued,
    1,
    'the next run recovers it',
  )
  assert.equal(delivery(second.db).length, 1)
})

test('recovery: a large backlog of already-handled requests cannot hide a missed one', async () => {
  const { db } = world()
  setCutover(db)
  const missed = await missedEmail(db)
  missed.customer_notified_at = new Date(Date.now() - 1000).toISOString() // the NEWEST request
  for (let i = 0; i < 450; i++) {
    const id = `old-${i}`
    db.rows('booking_interests').push({
      id,
      customer_id: `cust-${i}`,
      cook_id: COOK,
      status: 'fulfilled',
      notify_when_verified: true,
      customer_notified_at: new Date(
        Date.now() - 2 * DAY + i * 1000,
      ).toISOString(),
    })
    db.rows('email_deliveries').push({
      id: `d-old-${i}`,
      kind: 'interest_verified',
      recipient_key: id,
      status: 'accepted',
      attempts: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
  assert.deepEqual(await reconcile(db), { candidates: 1, queued: 1 })
})

test('recovery: the scheduled run and the admin retry both recover and send in one pass', async () => {
  const { db, mail } = world()
  setCutover(db)
  await missedEmail(db)
  const summary = await worker.drainInterestEmails(db, { appUrl: APP })
  assert.equal(summary.reconciled, 1)
  assert.equal(summary.sent, 1)
  assert.equal(mail.requests.length, 1)
  assert.match(read('src/app/api/email/retry/route.ts'), /reconcile: true/)
  // and the per-cook call right after an approval does not reconcile
  assert.doesNotMatch(read('src/app/api/admin/kyc/route.ts'), /reconcile: true/)
})

// ================================================================== 8. migration order safeguard (static)
// The behaviour is proven in a real in-memory Postgres by the PGlite harness (engineering folder);
// these pin the text, so an edit that removes the safeguard fails CI.
test('booking-verification cannot put the older verification trigger back over the newer one', () => {
  const a = read('supabase-migration-booking-verification.sql')
  const guard = a.slice(
    a.indexOf('do $guard$'),
    a.indexOf('$guard$;', a.indexOf('do $guard$')),
  )
  assert.ok(guard.length > 200, 'the guard block exists')
  assert.match(
    guard,
    /prosrc like '%interest_verified%'/,
    'it detects the newer function by what it queues',
  )
  assert.match(
    guard,
    /f4l\.allow_trigger_downgrade/,
    'going back needs an explicit opt-in',
  )
  assert.match(guard, /raise notice/, 'and says what it did')
  assert.match(
    guard,
    /execute \$fn\$[\s\S]*create or replace function public\.booking_interest_on_verification\(\)/,
    'the original function is still installed on a first run',
  )
  assert.equal(
    (
      a.match(
        /create or replace function public\.booking_interest_on_verification\(\)/g,
      ) ?? []
    ).length,
    1,
    'and it is ONLY created inside the guard',
  )
  // the original behaviour is preserved: still notifies the cook and fulfils requests
  for (const phrase of [
    "'You are verified'",
    "'interest_available'",
    "status = 'fulfilled'",
    "'Verification removed'",
  ])
    assert.ok(guard.includes(phrase), phrase)
})

test('the verification-email migration records its cutover once and never moves it', () => {
  const c = read('supabase-migration-interest-verification-email.sql')
  assert.match(c, /create table if not exists public\.interest_email_cutover/)
  assert.match(
    c,
    /id boolean primary key default true check \(id\)/,
    'one row at most',
  )
  assert.match(
    c,
    /insert into public\.interest_email_cutover \(id\) values \(true\) on conflict \(id\) do nothing/,
    'a re-run never changes the date',
  )
  assert.match(
    c,
    /revoke all on public\.interest_email_cutover from anon, authenticated/,
  )
  assert.match(c, /enable row level security/)
})

test('the readiness diagnostic knows about the safeguard objects and splits recoverable from historical', () => {
  const d = read('supabase-diagnostic-readiness-check.sql')
  assert.match(d, /'interest_email_cutover'/)
  assert.match(d, /'password_recovery'/)
  assert.match(d, /-- B8\./)
  assert.match(d, /historical_before_cutover/)
})

// ================================================================== 9. diagnostic security review (static)
// Part A is one SELECT; Part B is commented out and pasted one block at a time, so BOTH must be checked as code.
const DIAGNOSTIC = 'supabase-diagnostic-readiness-check.sql'
const SQL_WORDS = new Set([
  'values',
  'from',
  'exists',
  'in',
  'and',
  'or',
  'not',
  'when',
  'then',
  'else',
  'end',
  'case',
  'select',
  'where',
  'as',
  'on',
  'join',
  'union',
  'by',
  'having',
  'filter',
  'cross',
  'group',
  'order',
  'all',
  'lateral',
  'limit',
])
const ALIASES = new Set(['w', 't', 'r', 'k', 'c', 'g', 'p', 'n', 'i', 'd'])
const READ_ONLY_FUNCTIONS = new Set([
  'to_regclass',
  'to_regprocedure',
  'pg_get_constraintdef',
  'has_table_privilege',
  'has_function_privilege',
  'version',
  'count',
  'max',
  'now',
])
const DANGEROUS =
  /\b(pg_read_file|pg_read_binary_file|pg_ls_dir|lo_import|lo_export|lo_unlink|dblink|set_config|nextval|setval|pg_sleep|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_notify|pg_stat_reset|pg_advisory_lock|pg_advisory_xact_lock|txid_current|pg_switch_wal|pg_create_restore_point|current_setting|pg_get_functiondef|pg_get_viewdef|vault|decrypted_secrets)\b/i
const FORBIDDEN_STATEMENTS =
  /\b(insert|update|delete|create|alter|drop|grant|revoke|truncate|copy|call|execute|vacuum|reindex|merge|do|set|reset|begin|commit|rollback|listen|notify|prepare|lock|comment|security|into)\b/i
const PERSONAL_OUTPUT =
  /\b(email|full_name|phone|password|encrypted_password|token|token_hash|raw_user_meta_data|raw_app_meta_data|buyer_id|cook_id|customer_id|user_id|recipient_key|auth_user_id|invited_by|id)\b/i

function functionCalls(code) {
  return [...code.matchAll(/\b([a-z_][a-z0-9_]*)\s*\(/gi)]
    .map((m) => m[1].toLowerCase())
    .filter((name) => !SQL_WORDS.has(name) && !ALIASES.has(name))
}
const partBBlocks = () => {
  const sql = read(DIAGNOSTIC)
  const afterB = sql.slice(sql.indexOf('PART B'))
  return afterB
    .split(/\n(?=-- B\d+\.)/)
    .slice(1)
    .map((blk) => {
      const lines = blk.split('\n')
      const start = lines.findIndex((l) => /^-- select/.test(l))
      return {
        title: lines[0],
        code: lines
          .slice(start)
          .filter((l) => l.startsWith('--'))
          .map((l) => l.replace(/^-- ?/, ''))
          .join('\n'),
      }
    })
}

test('diagnostic review: Part A calls only read-only catalog functions and no side-effect function', () => {
  const sql = read(DIAGNOSTIC)
  const partA = sql.slice(
    sql.indexOf('select section, check_name'),
    sql.indexOf('order by ord, check_name;') + 26,
  )
  const code = stripSql(partA)
  assert.ok(partA.length > 3000)
  assert.doesNotMatch(
    code,
    FORBIDDEN_STATEMENTS,
    'no write, DDL, privilege or transaction statement',
  )
  assert.doesNotMatch(partA, DANGEROUS)
  const unknown = [...new Set(functionCalls(code))].filter(
    (f) => !READ_ONLY_FUNCTIONS.has(f),
  )
  assert.deepEqual(
    unknown,
    [],
    'every function called is on the read-only allow-list',
  )
  assert.doesNotMatch(
    code,
    /\$\$|\$[a-z_]*\$/i,
    'no dollar-quoted (dynamic) code',
  )
  assert.equal((code.match(/;/g) ?? []).length, 1, 'a single statement')
})

test('diagnostic review: every Part B block is read-only and returns counts, never people', () => {
  const blocks = partBBlocks()
  assert.equal(blocks.length, 8)
  for (const { title, code: raw } of blocks) {
    const code = stripSql(raw)
    assert.doesNotMatch(code, FORBIDDEN_STATEMENTS, title)
    assert.doesNotMatch(raw, DANGEROUS, title)
    assert.match(code, /count\(/, `${title}: aggregate output only`)
    const unknown = [...new Set(functionCalls(code))].filter(
      (f) => !READ_ONLY_FUNCTIONS.has(f),
    )
    assert.deepEqual(unknown, [], title)
    // the columns it RETURNS (everything before the first FROM) must not identify anyone
    const outputList = code.slice(
      code.indexOf('select') + 6,
      code.search(/\bfrom\b/i),
    )
    assert.doesNotMatch(
      outputList.replace(/count\([^)]*\)|max\([^)]*\)/gi, ''),
      PERSONAL_OUTPUT,
      `${title}: returns ${outputList.trim().slice(0, 80)}`,
    )
  }
})

test('diagnostic review: it only reads schemas the migrations concern', () => {
  const sql =
    stripSql(read(DIAGNOSTIC)) +
    '\n' +
    partBBlocks()
      .map((b) => stripSql(b.code))
      .join('\n')
  const schemas = new Set(
    [
      ...sql.matchAll(/\b(public|auth|information_schema|pg_catalog)\.\w+/gi),
    ].map((m) => m[1].toLowerCase()),
  )
  assert.ok(
    [...schemas].every((x) =>
      ['public', 'auth', 'information_schema'].includes(x),
    ),
    [...schemas].join(),
  )
  // auth.users is read in exactly one place (a count in B7) and nothing else in auth is touched
  const authReads = [...sql.matchAll(/\bauth\.(\w+)/gi)].map((m) =>
    m[1].toLowerCase(),
  )
  assert.deepEqual([...new Set(authReads)], ['users'])
  assert.equal(
    authReads.length,
    1,
    'exactly one read of auth.users: the count in B7',
  )
})
