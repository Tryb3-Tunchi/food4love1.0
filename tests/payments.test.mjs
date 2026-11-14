// Run with: npm test   (Node's built-in test runner; no extra dependencies)
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  verifyPaystackSignature,
  webhookMatchesBooking,
} from '../src/lib/payments/paystackWebhook.ts'

const src = join(fileURLToPath(new URL('..', import.meta.url)), 'src')
const read = (p) => readFileSync(join(src, p), 'utf8')

const SECRET = 'sk_test_not_a_real_key'
const body = JSON.stringify({
  event: 'charge.success',
  data: {
    status: 'success',
    reference: 'f4l_ref_1',
    amount: 500000,
    currency: 'NGN',
  },
})
const sign = (b, s = SECRET) => createHmac('sha512', s).update(b).digest('hex')

test('webhook signature: accepts only the exact HMAC-SHA512 of the raw body', () => {
  assert.equal(
    verifyPaystackSignature({ body, signature: sign(body), secret: SECRET }),
    true,
  )
  assert.equal(
    verifyPaystackSignature({
      body,
      signature: sign(body).toUpperCase(),
      secret: SECRET,
    }),
    true,
    'hex case does not matter',
  )
  // any change to the body, the key or the signature is rejected
  assert.equal(
    verifyPaystackSignature({
      body: body + ' ',
      signature: sign(body),
      secret: SECRET,
    }),
    false,
  )
  assert.equal(
    verifyPaystackSignature({
      body,
      signature: sign(body, 'other'),
      secret: SECRET,
    }),
    false,
  )
  assert.equal(
    verifyPaystackSignature({
      body,
      signature: sign(body).slice(1),
      secret: SECRET,
    }),
    false,
  )
  for (const bad of [null, undefined, '', 'abc', 'x'.repeat(128)])
    assert.equal(
      verifyPaystackSignature({ body, signature: bad, secret: SECRET }),
      false,
    )
  assert.equal(
    verifyPaystackSignature({ body, signature: sign(body), secret: '' }),
    false,
  )
  assert.equal(
    verifyPaystackSignature({ body, signature: sign(body), secret: undefined }),
    false,
  )
})

const booking = {
  payment_reference: 'f4l_ref_1',
  payment_status: 'pending',
  amount: 5000,
  status: 'confirmed',
}
const event = JSON.parse(body)

test('a signed payment marks a booking paid only when everything matches', () => {
  assert.deepEqual(webhookMatchesBooking(event, booking), { ok: true })
  assert.deepEqual(
    webhookMatchesBooking(event, { ...booking, payment_status: 'unpaid' }),
    { ok: true },
  )
})

test('mismatched or replayed payments are refused', () => {
  const cases = [
    [{ ...event, event: 'charge.failed' }, booking, 'not_a_charge'],
    [
      { ...event, data: { ...event.data, status: 'failed' } },
      booking,
      'not_successful',
    ],
    [
      { ...event, data: { ...event.data, reference: 'someone_else' } },
      booking,
      'reference_mismatch',
    ],
    [
      { ...event, data: { ...event.data, currency: 'USD' } },
      booking,
      'currency_mismatch',
    ],
    [
      { ...event, data: { ...event.data, amount: 100 } },
      booking,
      'amount_mismatch',
    ],
    [event, { ...booking, amount: 4000 }, 'amount_mismatch'],
    [event, { ...booking, amount: null, price: null }, 'no_agreed_amount'],
    [event, { ...booking, status: 'pending' }, 'booking_not_confirmed'],
    [event, { ...booking, payment_status: 'paid' }, 'already_paid'],
    [event, { ...booking, payment_status: 'refunded' }, 'not_awaiting_payment'],
    [event, { ...booking, payment_reference: null }, 'reference_mismatch'],
  ]
  for (const [e, b, reason] of cases) {
    const verdict = webhookMatchesBooking(e, b)
    assert.equal(verdict.ok, false, reason)
    assert.equal(verdict.reason, reason)
  }
})

test('the webhook route verifies the signature first and updates only a booking still awaiting payment', () => {
  const route = read('app/api/webhooks/paystack/route.ts')
  assert.ok(
    route.indexOf('verifyPaystackSignature(') <
      route.indexOf('JSON.parse(body)'),
  )
  assert.match(route, /status: 401/)
  assert.match(route, /\.in\('payment_status', \['unpaid', 'pending'\]\)/)
  assert.match(route, /webhookMatchesBooking\(/)
  assert.ok(
    !/NEXT_PUBLIC_PAYSTACK/.test(route),
    'never uses the public key to verify',
  )
})

test('payment routes keep their server-side protections', () => {
  const initialize = read('app/api/payments/initialize/route.ts')
  assert.match(initialize, /\.eq\('buyer_id', user\.id\)/)
  assert.match(initialize, /booking\.amount \?\? booking\.price/)
  const verify = read('app/api/payments/verify/route.ts')
  assert.match(verify, /data\.data\?\.amount !== bookingAmount \* 100/)
  assert.match(verify, /data\.data\?\.currency !== 'NGN'/)
  assert.match(verify, /booking\.payment_reference !== reference/)
  // the client never sends an amount
  assert.ok(
    !/amount/.test(
      initialize.slice(
        initialize.indexOf('initializeSchema'),
        initialize.indexOf('export async'),
      ),
    ),
  )
  // no subscription or recurring billing exists in the application
  for (const f of [
    'app/api/payments/initialize/route.ts',
    'app/api/wallet/topup/route.ts',
  ]) {
    assert.ok(!/subscription|recurring|plan_code/i.test(read(f)), f)
  }
})
