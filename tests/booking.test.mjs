// Run with: npm test   (Node's built-in test runner; no extra dependencies)
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  verificationState,
  cookBookable,
  canExpressInterest,
  customerExplanation,
  UNVERIFIED_COOK_MESSAGE,
  VERIFICATION_LABELS,
} from '../src/lib/booking/verification.ts'
import {
  BOOKING_STATUSES,
  BOOKING_ACTIONS,
  ALLOWED_TRANSITIONS,
  applyAction,
  isActiveStatus,
  noticeFor,
  statusHint,
  NEW_REQUEST_NOTICE,
} from '../src/lib/booking/lifecycle.ts'
import {
  SERVICE_TYPES,
  needsAddress,
  deliveryFeeFor,
  serviceFeeFor,
  totalFor,
  validateSchedule,
  allergyIsDeclared,
  NO_ALLERGIES,
  addressFor,
} from '../src/lib/booking/details.ts'

// ----------------------------------------------------------- verification
const cook = (extra = {}) => ({
  role: 'cook',
  kyc_status: 'verified',
  suspended: false,
  onboarding_complete: true,
  ...extra,
})

test('only an approved, active, onboarded cook can take a booking', () => {
  assert.deepEqual(cookBookable(cook()), { ok: true })
  assert.equal(
    cookBookable(cook({ kyc_status: 'unverified' })).reason,
    'not_verified',
  )
  assert.equal(
    cookBookable(cook({ kyc_status: 'pending' })).reason,
    'under_review',
  )
  assert.equal(
    cookBookable(cook({ kyc_status: 'rejected' })).reason,
    'rejected',
  )
  assert.equal(cookBookable(cook({ suspended: true })).reason, 'suspended')
  assert.equal(
    cookBookable(cook({ onboarding_complete: false })).reason,
    'onboarding_incomplete',
  )
  assert.equal(cookBookable(cook({ role: 'buyer' })).reason, 'not_a_cook')
  assert.equal(cookBookable(null).reason, 'not_a_cook')
  assert.equal(cookBookable(undefined).reason, 'not_a_cook')
})

test('the Verified badge is never used to decide; kyc_status is', () => {
  // is_verified is not even read: a cook with the badge but no approval is not bookable
  assert.equal(
    cookBookable({ ...cook({ kyc_status: 'unverified' }), is_verified: true })
      .ok,
    false,
  )
  assert.equal(cookBookable({ ...cook(), is_verified: false }).ok, true)
})

test('suspension overrides an approved verification; an open submission means under review', () => {
  assert.equal(verificationState(cook({ suspended: true })), 'suspended')
  assert.equal(
    verificationState(
      cook({ kyc_status: 'unverified', latest_submission: 'pending' }),
    ),
    'under_review',
  )
  assert.equal(
    verificationState(
      cook({ kyc_status: 'unverified', latest_submission: 'rejected' }),
    ),
    'not_verified',
  )
  // a revoked cook (admin returned them to unverified) is simply not verified
  assert.equal(
    verificationState(
      cook({ kyc_status: 'unverified', latest_submission: 'approved' }),
    ),
    'not_verified',
  )
  for (const state of Object.keys(VERIFICATION_LABELS))
    assert.ok(VERIFICATION_LABELS[state])
})

test('unverified cooks get exactly the owner-approved explanation', () => {
  assert.equal(
    UNVERIFIED_COOK_MESSAGE,
    "This cook hasn't been verified by Food4Love yet. For your safety, bookings are temporarily unavailable. You can explore other verified cooks or ask us to notify you when this cook becomes available.",
  )
  for (const s of ['not_verified', 'under_review', 'rejected'])
    assert.equal(customerExplanation(s), UNVERIFIED_COOK_MESSAGE)
  assert.match(customerExplanation('verified'), /verified by Food4Love/)
  assert.match(customerExplanation('suspended'), /not available/)
})

test('interest can only be expressed for a cook who is not yet bookable', () => {
  assert.deepEqual(canExpressInterest(cook({ kyc_status: 'unverified' })), {
    ok: true,
  })
  assert.deepEqual(canExpressInterest(cook({ kyc_status: 'pending' })), {
    ok: true,
  })
  assert.equal(canExpressInterest(cook()).reason, 'already_bookable')
  assert.equal(
    canExpressInterest(cook({ suspended: true })).reason,
    'suspended',
  )
  assert.equal(canExpressInterest(cook({ role: 'buyer' })).reason, 'not_a_cook')
  assert.equal(canExpressInterest(null).reason, 'not_a_cook')
})

// --------------------------------------------------------------- lifecycle
const b = (status, payment_status = 'unpaid') => ({ status, payment_status })

test('the lifecycle matches the transition table the database enforces', () => {
  // Every transition the rules can produce must be in the table; nothing else is reachable.
  const reachable = new Set()
  for (const status of BOOKING_STATUSES) {
    for (const actor of ['buyer', 'cook']) {
      for (const action of BOOKING_ACTIONS) {
        for (const pay of ['unpaid', 'paid']) {
          const r = applyAction(b(status, pay), actor, action)
          if (r.ok) {
            reachable.add(`${status}>${r.to}`)
            assert.ok(
              ALLOWED_TRANSITIONS[status].includes(r.to),
              `${status} -> ${r.to} is allowed by the table`,
            )
          }
        }
      }
    }
  }
  // and every row of the table is actually reachable through some action
  for (const [from, tos] of Object.entries(ALLOWED_TRANSITIONS))
    for (const to of tos)
      assert.ok(reachable.has(`${from}>${to}`), `${from} -> ${to} is reachable`)
  assert.deepEqual(ALLOWED_TRANSITIONS.completed, [])
  assert.deepEqual(ALLOWED_TRANSITIONS.cancelled, [])
})

test('only the right person can take each step', () => {
  assert.equal(applyAction(b('pending'), 'cook', 'accept').to, 'confirmed')
  assert.equal(applyAction(b('pending'), 'buyer', 'accept').ok, false)
  assert.equal(applyAction(b('pending'), 'buyer', 'decline').ok, false)
  assert.equal(
    applyAction(b('pending'), 'buyer', 'propose_alternative').ok,
    false,
  )
  assert.equal(
    applyAction(b('alternative_proposed'), 'cook', 'accept_alternative').ok,
    false,
  )
  assert.equal(
    applyAction(b('alternative_proposed'), 'buyer', 'accept_alternative').to,
    'confirmed',
  )
  assert.deepEqual(
    applyAction(b('alternative_proposed'), 'buyer', 'decline_alternative'),
    {
      ok: true,
      to: 'cancelled',
      cancelledBy: 'buyer',
    },
  )
  assert.equal(
    applyAction(b('pending'), 'cook', 'propose_alternative').to,
    'alternative_proposed',
  )
})

test('a booking answered once cannot be answered again (duplicate actions are refused)', () => {
  for (const status of [
    'confirmed',
    'cancelled',
    'completed',
    'alternative_proposed',
  ]) {
    for (const action of ['accept', 'decline', 'propose_alternative'])
      assert.equal(
        applyAction(b(status), 'cook', action).ok,
        false,
        `${action} on ${status}`,
      )
  }
  assert.equal(applyAction(b('cancelled'), 'buyer', 'cancel').ok, false)
  assert.equal(applyAction(b('completed'), 'cook', 'cancel').ok, false)
  assert.equal(
    applyAction(b('pending'), 'buyer', 'accept_alternative').ok,
    false,
  )
})

test('a paid booking is never cancelled by the app (it needs a refund through support)', () => {
  for (const action of ['cancel', 'decline']) {
    const actor = action === 'decline' ? 'cook' : 'buyer'
    const r = applyAction(
      b(action === 'decline' ? 'pending' : 'confirmed', 'paid'),
      actor,
      action,
    )
    assert.equal(r.ok, false)
    assert.match(r.reason, /Contact support/)
  }
  assert.equal(
    applyAction(b('confirmed', 'unpaid'), 'buyer', 'cancel').to,
    'cancelled',
  )
  assert.equal(
    applyAction(b('pending'), 'buyer', 'cancel').cancelledBy,
    'buyer',
  )
  assert.equal(
    applyAction(b('confirmed'), 'cook', 'cancel').cancelledBy,
    'cook',
  )
})

test('a booking can only be completed once the payment provider confirmed it', () => {
  assert.equal(
    applyAction(b('confirmed', 'unpaid'), 'buyer', 'complete').ok,
    false,
  )
  assert.equal(
    applyAction(b('confirmed', 'pending'), 'cook', 'complete').ok,
    false,
  )
  assert.equal(
    applyAction(b('confirmed', 'paid'), 'cook', 'complete').to,
    'completed',
  )
  assert.equal(applyAction(b('pending', 'paid'), 'cook', 'complete').ok, false)
})

test('every action tells the other person, never the person who acted', () => {
  for (const action of BOOKING_ACTIONS) {
    for (const actor of ['buyer', 'cook']) {
      const notice = noticeFor(action, actor)
      assert.ok(notice, action)
      assert.notEqual(
        notice.to,
        actor === 'buyer' &&
          ['accept', 'decline', 'propose_alternative'].includes(action)
          ? 'cook'
          : actor === 'cook' &&
              ['accept_alternative', 'decline_alternative'].includes(action)
            ? 'buyer'
            : actor,
        `${action}/${actor}`,
      )
      assert.ok(notice.title && notice.body)
      assert.ok(!/guarantee|refund is|instantly/i.test(notice.body))
    }
  }
  assert.equal(NEW_REQUEST_NOTICE.to, 'cook')
  assert.equal(
    isActiveStatus('pending') &&
      isActiveStatus('confirmed') &&
      isActiveStatus('alternative_proposed'),
    true,
  )
  assert.equal(
    isActiveStatus('completed') || isActiveStatus('cancelled'),
    false,
  )
})

test('status hints speak to the right person', () => {
  assert.match(statusHint(b('pending'), 'cook'), /accept, decline or suggest/)
  assert.match(statusHint(b('pending'), 'buyer'), /cook has your request/)
  assert.match(statusHint(b('confirmed'), 'buyer'), /Pay to secure/)
  assert.match(statusHint(b('confirmed', 'paid'), 'cook'), /Mark it completed/)
  assert.match(
    statusHint(b('alternative_proposed'), 'buyer'),
    /Accept it or decline/,
  )
})

// ------------------------------------------------------------ booking details
test('service types decide which fields and fees apply', () => {
  assert.deepEqual(
    [...SERVICE_TYPES],
    ['private_cooking', 'delivery', 'pickup'],
  )
  assert.equal(needsAddress('private_cooking'), true)
  assert.equal(needsAddress('delivery'), true)
  assert.equal(needsAddress('pickup'), false)
  assert.equal(deliveryFeeFor('delivery'), 500)
  assert.equal(deliveryFeeFor('pickup'), 0)
  assert.equal(deliveryFeeFor('private_cooking'), 0)
  assert.equal(serviceFeeFor(10000), 500)
  assert.equal(totalFor(10000, 'delivery'), 11000)
  assert.equal(totalFor(10000, 'pickup'), 10500)
  assert.equal(totalFor(2500, 'private_cooking'), 2625)
})

test('the address is kept only when the service needs one', () => {
  assert.equal(addressFor('pickup', '12 Some Long Street, Lagos'), null)
  assert.equal(
    addressFor('delivery', '  12 Some Long Street, Lagos '),
    '12 Some Long Street, Lagos',
  )
  assert.equal(addressFor('delivery', 'short'), null)
  assert.equal(addressFor('private_cooking', null), null)
})

test('allergy information must be stated either way', () => {
  assert.equal(allergyIsDeclared(''), false)
  assert.equal(allergyIsDeclared(' '), false)
  assert.equal(allergyIsDeclared(null), false)
  assert.equal(allergyIsDeclared(NO_ALLERGIES), true)
  assert.equal(allergyIsDeclared('Peanuts and shellfish'), true)
})

test('booking times must be sensible', () => {
  const now = new Date('2026-11-15T10:00:00Z')
  const at = (min) => new Date(now.getTime() + min * 60_000)
  assert.equal(validateSchedule(at(30), now).ok, false)
  assert.equal(validateSchedule(at(61), now).ok, true)
  assert.equal(validateSchedule(at(60 * 24 * 179), now).ok, true)
  assert.equal(validateSchedule(at(60 * 24 * 181), now).ok, false)
  assert.equal(validateSchedule(new Date('nope'), now).ok, false)
  assert.equal(validateSchedule(at(-5), now).ok, false)
})
