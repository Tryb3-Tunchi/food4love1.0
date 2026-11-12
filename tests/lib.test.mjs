// Run with: npm test   (Node's built-in test runner; no extra dependencies)
import test from 'node:test'
import assert from 'node:assert/strict'
import { notificationHref } from '../src/lib/notificationRoutes.ts'
import { createLimiter } from '../src/lib/rateLimit.ts'
import { actionForExistingPair } from '../src/lib/matchRules.ts'
import { isFreshConfirmation } from '../src/lib/email/freshness.ts'
import {
  waitlistSignupEmail,
  welcomeEmail,
  escapeEmailHtml,
} from '../src/lib/email/templates.ts'

const ID = '123e4567-e89b-12d3-a456-426614174000'

test('match notification opens its conversation', () => {
  assert.equal(
    notificationHref({ type: 'match', data: { match_id: ID } }, 'buyer'),
    `/chat/${ID}`,
  )
})

test('match notification without an id falls back to the Matches page', () => {
  assert.equal(
    notificationHref({ type: 'match', data: {} }, 'cook'),
    '/matches',
  )
  assert.equal(notificationHref({ type: 'match' }, 'cook'), '/matches')
})

test('a tampered id never reaches the URL', () => {
  for (const bad of [
    '../admin',
    '/x',
    `${ID}/../../x`,
    '<script>',
    '',
    5,
    null,
  ]) {
    assert.equal(
      notificationHref({ type: 'message', data: { match_id: bad } }, 'buyer'),
      '/chat',
    )
  }
})

test('likes go where the role can act on them', () => {
  assert.equal(
    notificationHref({ type: 'like', data: {} }, 'cook'),
    '/requests',
  )
  assert.equal(
    notificationHref({ type: 'like', data: {} }, 'buyer'),
    '/matches',
  )
})

test('booking and system notifications', () => {
  assert.equal(
    notificationHref({ type: 'booking', data: { booking_id: ID } }, 'cook'),
    `/bookings/${ID}`,
  )
  assert.equal(
    notificationHref({ type: 'booking', data: {} }, 'cook'),
    '/bookings',
  )
  assert.equal(notificationHref({ type: 'system', data: {} }, 'cook'), null)
})

test('rate limiter blocks after the limit and recovers after the window', () => {
  const allow = createLimiter({ limit: 3, windowMs: 1000 })
  assert.equal(allow('a', 0), true)
  assert.equal(allow('a', 10), true)
  assert.equal(allow('a', 20), true)
  assert.equal(allow('a', 30), false)
  assert.equal(allow('b', 30), true, 'other callers are unaffected')
  assert.equal(allow('a', 1500), true, 'window has passed')
})

test('welcome email only for a fresh confirmation', () => {
  const now = Date.parse('2026-11-11T12:00:00Z')
  assert.equal(isFreshConfirmation('2026-11-11T11:55:00Z', now), true)
  assert.equal(isFreshConfirmation('2026-11-11T11:00:00Z', now), false)
  assert.equal(isFreshConfirmation('2026-11-11T12:05:00Z', now), false)
  assert.equal(isFreshConfirmation(null, now), false)
  assert.equal(isFreshConfirmation('not a date', now), false)
})

test('waitlist confirmation: required subject, copy and brand details', () => {
  const email = waitlistSignupEmail()
  assert.equal(email.subject, "You're on the Food4Love waitlist! ❤️")
  for (const line of [
    "We're excited to have you on the Food4Love waitlist!",
    'discover home and private chefs',
    'Something delicious is cooking!',
    'The Food4Love Team',
  ]) {
    assert.ok(email.text.includes(line), `text has: ${line}`)
  }
  assert.ok(email.html.includes('#0F3D24'), 'brand green')
  assert.ok(email.html.includes('#FBF1DC'), 'brand cream')
  assert.ok(email.html.includes('https://www.food4love.app/logo4food22.png'))
  assert.ok(email.html.includes('alt="Food4Love"'))
  assert.ok(!/src="(?!https:)/.test(email.html), 'no non-HTTPS images')
})

test('waitlist confirmation makes no unsupported promises', () => {
  const email = waitlistSignupEmail()
  const all = `${email.text} ${email.html}`.toLowerCase()
  for (const banned of [
    'dating',
    'priority',
    'discount',
    'reward',
    'free meal',
    'launch date',
    'now live',
    'has launched',
    'book a chef now',
  ]) {
    assert.ok(!all.includes(banned), `must not contain "${banned}"`)
  }
  assert.ok(email.text.includes('does not create an account'))
})

test('welcome email: subject, escaping, role wording and link', () => {
  const buyer = welcomeEmail({
    name: 'Ada <script>alert(1)</script> Obi',
    role: 'buyer',
    appUrl: 'https://www.food4love.app/',
  })
  assert.equal(buyer.subject, 'Welcome to Food4Love! ❤️')
  assert.ok(!buyer.html.includes('<script>'), 'name is escaped')
  assert.ok(buyer.html.includes('href="https://www.food4love.app/login"'))
  assert.ok(buyer.text.includes('Complete your profile'))

  const cook = welcomeEmail({
    name: 'Chidi',
    role: 'cook',
    appUrl: 'https://x.test',
  })
  assert.ok(cook.text.includes('chef profile'))
  assert.notEqual(buyer.text, cook.text)
})

test('welcome email does not claim launch, verification or dating', () => {
  const email = welcomeEmail({
    name: 'Ada',
    role: 'buyer',
    appUrl: 'https://x.test',
  })
  const all = `${email.text} ${email.html}`.toLowerCase()
  for (const banned of [
    'dating',
    'priority',
    'discount',
    'reward',
    'now live',
  ]) {
    assert.ok(!all.includes(banned), `must not contain "${banned}"`)
  }
})

test('escapeEmailHtml', () => {
  assert.equal(
    escapeEmailHtml(`<a href="x">&'</a>`),
    '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
  )
})

test('mutual like on a blocked pair never announces a match (regression)', () => {
  assert.equal(actionForExistingPair('blocked'), 'blocked')
})

test('mutual like on an expired or pending pair reopens it', () => {
  assert.equal(actionForExistingPair('expired'), 'reopen')
  assert.equal(actionForExistingPair('pending'), 'reopen')
})

test('an already active match stays as it is', () => {
  assert.equal(actionForExistingPair('matched'), 'already_matched')
})
