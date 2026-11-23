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

// ============================================================ booking guarantees
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bookingEmailContent, bookingUrl } from '../src/lib/booking/email.ts'
import { notificationHref } from '../src/lib/notificationRoutes.ts'
import { formatLagos } from '../src/lib/booking/details.ts'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const read = (p) => readFileSync(join(rootDir, p), 'utf8')
const code = (p) =>
  read(p)
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')

test('booking emails carry only what happened and a link, never private details', () => {
  const content = bookingEmailContent({
    title: 'Booking accepted',
    body: 'The cook accepted your request. Open it to pay and secure your booking.',
    url: 'https://example.test/bookings/123e4567-e89b-42d3-a456-426614174000',
  })
  assert.match(content.subject, /^Food4Love: Booking accepted$/)
  assert.match(content.html, /Open the booking/)
  assert.match(content.text, /https:\/\/example\.test\/bookings\//)
  for (const secret of [
    /address/i,
    /allerg/i,
    /dietary/i,
    /₦|naira|price/i,
    /phone/i,
  ]) {
    assert.ok(!secret.test(content.html + content.text), String(secret))
  }
  // hostile text cannot inject markup
  const evil = bookingEmailContent({
    title: '<script>x</script>',
    body: '"><img src=x>',
    url: 'https://example.test/"onmouseover="x',
  })
  assert.ok(!evil.html.includes('<script>') && !evil.html.includes('<img'))
  assert.ok(!/href="[^"]*"onmouseover/.test(evil.html))
})

test('booking links only ever point at this site and a real booking id', () => {
  const id = '123e4567-e89b-42d3-a456-426614174000'
  assert.equal(
    bookingUrl('https://food4love.example/', id),
    `https://food4love.example/bookings/${id}`,
  )
  assert.equal(bookingUrl(undefined, id), null)
  assert.equal(bookingUrl('javascript:alert(1)', id), null)
  assert.equal(bookingUrl('https://food4love.example', '../admin'), null)
  assert.equal(bookingUrl('https://food4love.example', 'x'.repeat(36)), null)
})

test('verification and interest notifications open the right page', () => {
  assert.equal(
    notificationHref(
      { type: 'system', data: { kind: 'verification', status: 'verified' } },
      'cook',
    ),
    '/cook/verification',
  )
  assert.equal(
    notificationHref({ type: 'booking', data: { kind: 'interest' } }, 'cook'),
    '/cook/verification',
  )
  assert.equal(
    notificationHref(
      { type: 'system', data: { kind: 'verification' } },
      'buyer',
    ),
    null,
  )
  const cookId = '123e4567-e89b-42d3-a456-426614174000'
  assert.equal(
    notificationHref(
      {
        type: 'booking',
        data: { kind: 'interest_available', cook_id: cookId },
      },
      'buyer',
    ),
    `/cook/${cookId}`,
  )
  assert.equal(
    notificationHref(
      {
        type: 'booking',
        data: { kind: 'interest_available', cook_id: '../x' },
      },
      'buyer',
    ),
    '/swipe',
  )
  // existing booking links keep working
  assert.equal(
    notificationHref(
      { type: 'booking', data: { booking_id: cookId } },
      'buyer',
    ),
    `/bookings/${cookId}`,
  )
})

test('times are shown in Nigeria time', () => {
  assert.match(formatLagos('2026-12-05T10:00:00Z'), /11/) // 10:00 UTC is 11:00 in Lagos
  assert.equal(formatLagos('nope'), 'an unknown time')
})

test('the booking route enforces verification on the server with the shared rule', () => {
  const route = code('src/app/api/bookings/route.ts')
  assert.match(route, /cookBookable\(cook\)/)
  assert.match(route, /code: 'cook_not_verified'/)
  // no second, hand-written copy of the rule that could drift
  assert.ok(!/kyc_status !== 'verified'/.test(route))
  assert.match(route, /adultStates\(admin, \[user\.id, request\.cook_id\]\)/)
  assert.match(route, /A current match with this cook is required/)
  // the server never decides a booking is paid
  assert.ok(!/payment_status: 'paid'/.test(route))
  assert.match(route, /payment_status: 'unpaid'/)
  assert.match(route, /status: 'pending'/)
})

test('booking actions are limited to the two people in the booking', () => {
  const route = code('src/app/api/bookings/route.ts')
  assert.match(route, /booking\.cook_id === user\.id/)
  assert.match(route, /booking\.buyer_id === user\.id/)
  assert.match(
    route,
    /Booking not found/,
    'a guessed id looks the same as a missing one',
  )
  assert.match(route, /applyAction\(/)
  assert.match(
    route,
    /\.eq\('status', booking\.status\)/,
    'only if nobody changed it meanwhile',
  )
  assert.match(route, /recordBookingEvent\(/)
})

test('interest requests are their own thing: own rows only, no booking, no payment', () => {
  const route = code('src/app/api/booking-interests/route.ts')
  assert.match(route, /\.eq\('customer_id', user\.id\)/)
  assert.ok(!/from\('bookings'\)/.test(route), 'never touches bookings')
  assert.ok(!/payment|paystack|payments/i.test(route), 'never touches payments')
  assert.match(route, /canExpressInterest\(cook\)/)
  assert.match(
    route,
    /notify_when_verified: z\.boolean\(\)/,
    'consent must be stated, never assumed',
  )
  assert.match(route, /createLimiter/)
  assert.match(route, /adultStates\(/)
  const panel = read('src/components/booking/CookBookingPanel.tsx')
  // Consent to be notified is never assumed or pre-set. It used to be an unticked checkbox;
  // it is now the single button whose label says exactly what pressing it does, so there is
  // no checkbox, no default-on state, and nothing records consent except that press.
  assert.ok(!/type="checkbox"|defaultChecked|useState\(true\)/.test(panel))
  assert.match(panel, /Notify me when \$\{first\} is verified/)
  assert.equal(
    (panel.match(/notify_when_verified: true/g) ?? []).length,
    1,
    'consent is sent from exactly one place: the notify button',
  )
  assert.match(panel, /This is not a booking|not a booking/i)
})

test('the cook is told that someone is interested, never who', () => {
  const route = code('src/app/api/booking-interests/route.ts')
  const notice = route.slice(
    route.indexOf('user_id: cookId'),
    route.indexOf('user_id: cookId') + 500,
  )
  assert.ok(
    !/customer|user\.id|full_name/.test(notice),
    'the notification contains no customer detail',
  )
  const migration = read('supabase-migration-booking-verification.sql')
  assert.match(migration, /my_interest_count/)
  assert.match(migration, /using \(auth\.uid\(\) = customer_id\)/)
})

test('the status route reveals only what is already public', () => {
  const route = code('src/app/api/booking-status/route.ts')
  assert.ok(
    !/id_number|id_document|face_video|selfie|rejection_reason/.test(route),
  )
  assert.match(route, /\.eq\('customer_id', user\.id\)/)
})

test('the payment-status route reports a yes/no and never a key', () => {
  const route = code('src/app/api/payments/status/route.ts')
  assert.match(route, /Boolean\(/)
  // the only thing returned to the browser is the yes/no, under the name "available"
  assert.match(route, /NextResponse\.json\(\s*\{ available \}/)
  // environment variables are read only inside Boolean(...), never returned
  const outsideBoolean = route.replace(/Boolean\([\s\S]*?\n\s*\)/, '')
  assert.ok(!/process\.env/.test(outsideBoolean))
})

test('administrators: revoke is permission-controlled and audited; lists hide private details', () => {
  const kyc = code('src/app/api/admin/kyc/route.ts')
  const revoke = kyc.slice(kyc.indexOf('export async function POST'))
  assert.match(revoke, /getAdminUser\('kyc:review'\)/)
  assert.match(revoke, /beginAdminAudit\(/)
  assert.match(revoke, /action: 'kyc\.revoke'/)
  assert.match(revoke, /\.eq\('kyc_status', 'verified'\)/)
  const verified = code('src/app/api/admin/kyc/verified/route.ts')
  assert.match(verified, /getAdminUser\('kyc:review'\)/)
  assert.ok(!/id_number|id_document|face_video/.test(verified))
  const bookings = code('src/app/api/admin/bookings/route.ts')
  const list = bookings.slice(
    bookings.indexOf('LIST_COLUMNS_FULL'),
    bookings.indexOf('export async function GET'),
  )
  assert.ok(
    !/service_address|allergies|dietary|special_requests/.test(list),
    'addresses and allergies stay out of admin lists',
  )
  assert.match(bookings, /getAdminUser\('bookings:manage'\)/)
  // the existing permission system is used as it is: no bypass added
  assert.ok(!/admin_permissions|holdsPermission/.test(bookings + revoke))
})

test('the broken in-chat modal is gone and the chat uses the shared panel', () => {
  assert.ok(
    !existsSync(join(rootDir, 'src/components/booking/BookingModal.tsx')),
  )
  assert.ok(!existsSync(join(rootDir, 'src/components/chat/BookingCTA.tsx')))
  const chat = read('src/app/(app)/chat/[matchId]/page.tsx')
  assert.ok(!/BookingModal/.test(chat))
  assert.match(chat, /CookBookingPanel/)
  assert.match(chat, /ChatBookings/)
})

test('the booking form states allergies, shows fees by service type, and tells the truth about payment', () => {
  const form = read('src/components/booking/BookingForm.tsx')
  assert.match(form, /allergyIsDeclared\(allergies\)/)
  assert.match(form, /No allergies or food restrictions/)
  assert.match(form, /needsAddress\(serviceType\)/)
  assert.match(form, /deliveryFeeFor\(serviceType\)/)
  assert.match(form, /Online payment is not available yet/)
  assert.match(form, /aria-invalid/)
  assert.match(form, /role="alert"/)
  // an unverified cook never gets a form
  assert.match(form, /!status\.data\?\.bookable/)
  const detail = read('src/app/(app)/bookings/[id]/page.tsx')
  assert.match(detail, /online payment is not\s+available yet/)
  assert.match(detail, /canPay && paymentsAvailable/)
})

test('booking updates refresh live over the existing notification channel (no new channel)', () => {
  const hook = read('src/hooks/useNotifications.ts')
  assert.match(hook, /kind === 'booking'/)
  assert.match(hook, /queryKey: \['bookings'\]/)
  for (const file of [
    'src/components/booking/ChatBookings.tsx',
    'src/components/booking/CookBookingPanel.tsx',
    'src/components/booking/BookingHistory.tsx',
  ]) {
    assert.ok(
      !/\.channel\(|postgres_changes/.test(read(file)),
      `${file} opens no extra channel`,
    )
  }
})

test('the migration keeps the booking safety rules in the database itself', () => {
  const sql = read('supabase-migration-booking-verification.sql')
  assert.match(sql, /p\.kyc_status = 'verified'/)
  assert.match(sql, /bookings_one_active_per_slot_idx/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /A new booking must start as pending and unpaid/)
  assert.match(sql, /cannot be completed before payment is confirmed/)
  assert.match(
    sql,
    /alter table public\.booking_events enable row level security/,
  )
  assert.match(
    sql,
    /alter table public\.booking_interests enable row level security/,
  )
  // exactly one status was added
  assert.match(
    sql,
    /'pending', 'alternative_proposed', 'confirmed', 'completed', 'cancelled'/,
  )
  const runnable = sql
    .split('\n')
    .filter((l) => !/^\s*--/.test(l))
    .join('\n')
  assert.match(runnable, /^\s*begin;/m)
  assert.match(runnable, /^\s*commit;/m)
  assert.ok(
    !/\b(delete from|truncate table|drop table)\b/i.test(runnable),
    'removes no data',
  )
})

// ===================================================== pre-PR review corrections
import { loadBookingForAction } from '../src/lib/booking/load.ts'

// A stand-in database client. `columns` is what the "database" actually has; asking for a
// column it does not have fails the way PostgREST does before the migration is applied.
function fakeDb(columns, row) {
  return {
    from() {
      return {
        select(wanted) {
          const asked = wanted.split(',').map((c) => c.trim())
          return {
            eq() {
              return {
                async maybeSingle() {
                  const missing = asked.find((c) => !columns.includes(c))
                  if (missing)
                    return {
                      data: null,
                      error: {
                        code: 'PGRST204',
                        message: `Could not find the '${missing}' column of 'bookings' in the schema cache`,
                      },
                    }
                  return {
                    data: Object.fromEntries(
                      asked.map((c) => [c, row[c] ?? null]),
                    ),
                    error: null,
                  }
                },
              }
            },
          }
        },
      }
    },
  }
}
const isMissing = (e) =>
  !!e && (e.code === 'PGRST204' || /could not find/i.test(e.message ?? ''))
const OLD_COLS = [
  'id',
  'buyer_id',
  'cook_id',
  'match_id',
  'status',
  'payment_status',
  'scheduled_for',
]
const row = {
  id: 'b1',
  buyer_id: 'u1',
  cook_id: 'u2',
  match_id: 'm1',
  status: 'pending',
  payment_status: 'unpaid',
  scheduled_for: '2026-12-01T10:00:00Z',
  proposed_scheduled_for: '2026-12-02T10:00:00Z',
}

test('accepting and declining still work BEFORE the booking migration is applied', async () => {
  const booking = await loadBookingForAction(
    fakeDb(OLD_COLS, row),
    'b1',
    isMissing,
  )
  assert.equal(booking.id, 'b1')
  assert.equal(booking.status, 'pending')
  assert.equal(
    booking.proposed_scheduled_for,
    null,
    'the missing column reads as "no suggested time"',
  )
  // and the decision rules work on that row exactly as they do after the migration
  assert.equal(applyAction(booking, 'cook', 'accept').to, 'confirmed')
  assert.equal(applyAction(booking, 'cook', 'decline').to, 'cancelled')
})

test('AFTER the migration the suggested time is read too', async () => {
  const booking = await loadBookingForAction(
    fakeDb([...OLD_COLS, 'proposed_scheduled_for'], row),
    'b1',
    isMissing,
  )
  assert.equal(booking.proposed_scheduled_for, '2026-12-02T10:00:00Z')
})

test('a real database error is not mistaken for "migration not applied"', async () => {
  const broken = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: null,
            error: { code: '57014', message: 'statement timeout' },
          }),
        }),
      }),
    }),
  }
  assert.equal(await loadBookingForAction(broken, 'b1', isMissing), null)
  // and a booking that does not exist is simply null in both schemas
  const none = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  }
  assert.equal(await loadBookingForAction(none, 'zzz', isMissing), null)
})

test('the action route reads the booking through the fallback and applies the adult rule', () => {
  const route = code('src/app/api/bookings/route.ts')
  const patch = route.slice(route.indexOf('export async function PATCH'))
  assert.match(patch, /loadBookingForAction\(/)
  assert.ok(
    !/proposed_scheduled_for',?\s*\)\s*\.eq\('id', decision\.booking_id\)/.test(
      patch,
    ),
    'no direct query for the new column',
  )
  assert.match(patch, /adultStates\(admin, \[user\.id\]\)/)
  assert.match(patch, /AGE_REQUIRED_CODE/)
})

test('payment screens never hide a working payment option', () => {
  const detail = read('src/app/(app)/bookings/[id]/page.tsx')
  // an error answer is treated as "available": only an explicit "not available" hides card payment
  assert.match(detail, /response\.ok \? body\.available === true : true/)
  // the wallet does not use Paystack, so it is never hidden by the Paystack check
  assert.match(detail, /\{canPayWithWallet && \(/)
  assert.ok(!/canPayWithWallet && paymentsAvailable/.test(detail))
  // the "unavailable" notice appears only when there is truly no way to pay
  assert.match(detail, /canPay && !paymentsAvailable && !canPayWithWallet/)
  const form = read('src/components/booking/BookingForm.tsx')
  assert.match(form, /response\.ok \? body\.available === true : true/)
})

test('no payment or webhook code was changed by this branch', () => {
  // existing payment routes are byte-for-byte the ones from develop; only a new read-only status route exists
  for (const file of [
    'src/app/api/payments/initialize/route.ts',
    'src/app/api/payments/verify/route.ts',
    'src/app/api/payments/wallet/route.ts',
    'src/app/api/webhooks/paystack/route.ts',
    'src/lib/payments/paystackWebhook.ts',
    'src/lib/paystackLoader.ts',
  ]) {
    const text = read(file)
    assert.ok(
      !/booking_events|alternative_proposed|booking_interests/.test(text),
      file,
    )
  }
  const verify = read('src/app/api/payments/verify/route.ts')
  assert.match(verify, /data\.data\?\.amount !== bookingAmount \* 100/)
  assert.match(
    read('src/app/api/webhooks/paystack/route.ts'),
    /verifyPaystackSignature\(/,
  )
})

// ===================================================== accepting a suggested time re-checks capacity
import { lagosSlot, checkProposedSlot } from '../src/lib/booking/capacity.ts'
import { checkAvailability } from '../src/lib/availability.ts'

// A stand-in database: a list of bookings and one availability row, filtered the way
// the real queries filter them.
function capacityDb({ availability, bookings, failOn }) {
  return {
    from(table) {
      return {
        select() {
          const filters = []
          const query = {
            eq: (c, v) => (filters.push((r) => r[c] === v), query),
            neq: (c, v) => (filters.push((r) => r[c] !== v), query),
            gte: (c, v) => (filters.push((r) => r[c] >= v), query),
            lt: (c, v) => (filters.push((r) => r[c] < v), query),
            async maybeSingle() {
              if (failOn === table)
                return { data: null, error: { message: 'boom' } }
              return { data: availability ?? null, error: null }
            },
            then(resolve, reject) {
              const result =
                failOn === table
                  ? { count: null, error: { message: 'boom' } }
                  : {
                      count: bookings.filter((r) => filters.every((f) => f(r)))
                        .length,
                      error: null,
                    }
              return Promise.resolve(result).then(resolve, reject)
            },
          }
          return query
        },
      }
    },
  }
}
const deps = { checkAvailability }
const FAR = '2099-03-10T10:00:00.000Z' // far enough ahead that the notice rule is satisfied
const slotBooking = (id, scheduled_for, status = 'confirmed') => ({
  id,
  cook_id: 'cook1',
  scheduled_for,
  status,
})
const slotInput = { cookId: 'cook1', bookingId: 'mine', scheduledAtIso: FAR }

test('the Lagos day starts an hour before UTC midnight', () => {
  assert.equal(lagosSlot('2099-03-10T22:59:00Z').date, '2099-03-10')
  assert.equal(lagosSlot('2099-03-10T23:00:00Z').date, '2099-03-11')
  const slot = lagosSlot('2099-03-10T10:00:00Z')
  assert.equal(slot.time, '11:00')
  assert.equal(slot.dayStart, '2099-03-09T23:00:00.000Z')
  assert.equal(slot.dayEnd, '2099-03-10T23:00:00.000Z')
})

test('a suggested time on a day that is now full is refused with a clear message', async () => {
  const db = capacityDb({
    availability: {
      cook_id: 'cook1',
      max_orders_per_day: 2,
      weekly_hours: {},
      notice_hours: 0,
    },
    bookings: [
      slotBooking('a', FAR),
      slotBooking('b', '2099-03-10T15:00:00.000Z', 'pending'),
    ],
  })
  const result = await checkProposedSlot(db, slotInput, deps)
  assert.equal(result.ok, false)
  assert.equal(result.status, 409)
  assert.equal(result.code, 'slot_unavailable')
  assert.match(result.reason, /no longer available/i)
  assert.match(result.reason, /fully booked/i)
})

test('a day with room left is accepted, and the booking being moved is not counted against itself', async () => {
  const availability = {
    cook_id: 'cook1',
    max_orders_per_day: 2,
    weekly_hours: {},
    notice_hours: 0,
  }
  // one other booking that day + my own booking already sitting on that day = still room
  const db = capacityDb({
    availability,
    bookings: [
      slotBooking('a', FAR),
      slotBooking('mine', '2099-03-10T12:00:00.000Z', 'alternative_proposed'),
    ],
  })
  assert.deepEqual(await checkProposedSlot(db, slotInput, deps), { ok: true })
})

test('cancelled bookings, other cooks and other days do not use up the limit', async () => {
  const availability = {
    cook_id: 'cook1',
    max_orders_per_day: 1,
    weekly_hours: {},
    notice_hours: 0,
  }
  const db = capacityDb({
    availability,
    bookings: [
      slotBooking('a', FAR, 'cancelled'),
      { ...slotBooking('b', FAR), cook_id: 'cook2' },
      slotBooking('c', '2099-03-11T10:00:00.000Z'),
      slotBooking('d', '2099-03-10T23:00:00.000Z'), // 00:00 Lagos on the 11th
    ],
  })
  assert.deepEqual(await checkProposedSlot(db, slotInput, deps), { ok: true })
})

test("the cook's other rules (paused, opening hours, notice) apply to the suggested time too", async () => {
  const paused = capacityDb({
    availability: { cook_id: 'cook1', is_paused: true, weekly_hours: {} },
    bookings: [],
  })
  assert.equal((await checkProposedSlot(paused, slotInput, deps)).ok, false)
  const closed = capacityDb({
    availability: {
      cook_id: 'cook1',
      weekly_hours: { mon: { open: '09:00', close: '17:00' } },
    }, // 2099-03-10 is a Tuesday
    bookings: [],
  })
  const closedResult = await checkProposedSlot(closed, slotInput, deps)
  assert.equal(closedResult.ok, false)
  assert.equal(closedResult.code, 'slot_unavailable')
  const soon = capacityDb({
    availability: { cook_id: 'cook1', notice_hours: 24, weekly_hours: {} },
    bookings: [],
  })
  const nearFuture = new Date(Date.now() + 2 * 3_600_000).toISOString()
  assert.equal(
    (
      await checkProposedSlot(
        soon,
        { ...slotInput, scheduledAtIso: nearFuture },
        deps,
      )
    ).ok,
    false,
  )
})

test('a cook with no availability settings has no limit to enforce (same as when booking)', async () => {
  const db = capacityDb({
    availability: null,
    bookings: [slotBooking('a', FAR)],
  })
  assert.deepEqual(await checkProposedSlot(db, slotInput, deps), { ok: true })
})

test('if the database cannot answer, the suggested time is NOT accepted', async () => {
  const availability = {
    cook_id: 'cook1',
    max_orders_per_day: 5,
    weekly_hours: {},
    notice_hours: 0,
  }
  for (const failOn of ['cook_availability', 'bookings']) {
    const result = await checkProposedSlot(
      capacityDb({ availability, bookings: [], failOn }),
      slotInput,
      deps,
    )
    assert.equal(result.ok, false, failOn)
    assert.equal(result.status, 503, failOn)
    assert.equal(result.code, 'check_failed', failOn)
  }
})

test('accepting a suggested time is checked on the server and again by the database (atomic, same lock as a new booking)', () => {
  const route = code('src/app/api/bookings/route.ts')
  const patch = route.slice(route.indexOf('export async function PATCH'))
  const accept = patch.slice(
    patch.indexOf("decision.action === 'accept_alternative'"),
  )
  // the capacity check happens BEFORE the time is moved
  assert.ok(accept.indexOf('checkProposedSlot(') > -1)
  assert.ok(
    accept.indexOf('checkProposedSlot(') <
      accept.indexOf('update.scheduled_for'),
  )
  assert.match(accept, /slot\.status/)
  // a race lost inside the database is answered with the same clear message
  assert.match(patch, /\/fully booked\/i\.test\(message\)/)
  assert.match(patch, /code: 'slot_unavailable'/)
  // creating a booking uses the very same day calculation
  assert.match(route, /lagosSlot\(requestedAt\.toISOString\(\)\)/)

  const sql = read('supabase-migration-booking-verification.sql')
  const guardStart = sql.indexOf(
    'create or replace function public.booking_guard()',
  )
  const guard = sql.slice(
    guardStart,
    sql.indexOf('drop trigger if exists booking_guard', guardStart),
  )
  const lockKey =
    /pg_advisory_xact_lock\(hashtextextended\(new\.cook_id::text \|\| ':' \|\| day::text, 0\)\)/g
  assert.equal(
    (guard.match(lockKey) ?? []).length,
    2,
    'insert and time change take the same lock',
  )
  assert.match(guard, /new\.scheduled_for is distinct from old\.scheduled_for/)
  assert.match(guard, /b\.id <> new\.id/)
  // the status transition rules and the payment rule are untouched
  assert.match(
    guard,
    /old\.status = 'alternative_proposed' and new\.status in \('confirmed', 'cancelled'\)/,
  )
  assert.match(guard, /cannot be completed before payment is confirmed/)
})
