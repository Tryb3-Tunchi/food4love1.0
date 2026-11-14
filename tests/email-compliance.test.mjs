// Run with: npm test   (Node's built-in test runner; no extra dependencies)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  duplicateSignupUpdate,
  suppressionForEvent,
  marketingSenderIdentity,
  marketingFooterHtml,
  marketingFooterText,
  escapeHtml,
} from '../src/lib/email/waitlistRules.ts'

const src = join(fileURLToPath(new URL('..', import.meta.url)), 'src')
const read = (p) => readFileSync(join(src, p), 'utf8')

test('a repeat signup can never undo an unsubscribe', () => {
  const unsubscribed = {
    updates_consent: false,
    unsubscribed_at: '2026-11-01T10:00:00Z',
  }
  for (const consent of [true, false]) {
    assert.equal(
      duplicateSignupUpdate(unsubscribed, {
        audience: 'cook',
        updatesConsent: consent,
      }),
      null,
    )
  }
})

test('a repeat signup can withdraw marketing consent but never grant it', () => {
  const declined = { updates_consent: false, unsubscribed_at: null }
  const granted = duplicateSignupUpdate(declined, {
    audience: 'food_lover',
    updatesConsent: true,
  })
  assert.deepEqual(granted, { audience: 'food_lover' })
  assert.ok(!('updates_consent' in granted), 'consent is not upgraded')

  const subscribed = { updates_consent: true, unsubscribed_at: null }
  assert.deepEqual(
    duplicateSignupUpdate(subscribed, {
      audience: 'cook',
      updatesConsent: false,
    }),
    { audience: 'cook', updates_consent: false, consent_at: null },
  )
  // the same answer twice changes nothing but the label
  assert.deepEqual(
    duplicateSignupUpdate(subscribed, {
      audience: 'cook',
      updatesConsent: true,
    }),
    { audience: 'cook' },
  )
})

test('bounces and spam complaints suppress marketing; ordinary events do not', () => {
  assert.equal(suppressionForEvent('email.bounced'), true)
  assert.equal(suppressionForEvent('email.complained'), true)
  for (const t of [
    'email.delivered',
    'email.sent',
    'email.opened',
    '',
    null,
    undefined,
  ])
    assert.equal(suppressionForEvent(t), false)
})

test('marketing mail needs a configured sender identity and address', () => {
  assert.equal(marketingSenderIdentity({}), null)
  assert.equal(
    marketingSenderIdentity({ MARKETING_SENDER_ADDRESS: 'short' }),
    null,
  )
  assert.equal(
    marketingSenderIdentity({ MARKETING_SENDER_ADDRESS: '   ' }),
    null,
  )
  const sender = marketingSenderIdentity({
    MARKETING_SENDER_ADDRESS: ' 1 Example Street, Lagos, Nigeria ',
  })
  assert.deepEqual(sender, {
    name: 'Food4Love',
    address: '1 Example Street, Lagos, Nigeria',
  })
})

test('marketing footer has an unsubscribe link, the sender, and escapes its inputs', () => {
  const sender = { name: 'Food4Love <script>', address: '1 Example St & Co' }
  const url = 'https://example.test/u?token=a&b=c'
  const html = marketingFooterHtml({ unsubscribeUrl: url, sender })
  assert.match(html, /Unsubscribe/)
  assert.ok(!html.includes('<script>'))
  assert.match(html, /&amp;/)
  const text = marketingFooterText({ unsubscribeUrl: url, sender })
  assert.ok(text.includes(url) && text.includes('1 Example St & Co'))
  assert.equal(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;')
})

test('the public signup route wires the rules in and answers every case the same way', () => {
  const route = read('app/api/waitlist/route.ts')
  assert.match(route, /duplicateSignupUpdate\(/)
  assert.ok(
    !/unsubscribed_at:\s*null/.test(route),
    'the form must never clear unsubscribed_at',
  )
  assert.ok(
    !/already_sent/.test(route),
    'the answer must not reveal an existing signup',
  )
})

test('the Resend webhook suppresses on complaint/bounce and still verifies signatures', () => {
  const hook = read('app/api/webhooks/resend/route.ts')
  assert.match(hook, /verifySvixSignature\(/)
  assert.match(hook, /suppressionForEvent\(type\)/)
  assert.match(hook, /unsubscribed_at: new Date\(\)\.toISOString\(\)/)
})

test('campaign sending is blocked without a sender address and always carries one-click unsubscribe', () => {
  const route = read('app/api/waitlist/campaigns/route.ts')
  assert.match(route, /marketingSenderIdentity\(/)
  assert.match(route, /MARKETING_SENDER_ADDRESS/)
  assert.match(route, /'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'/)
  assert.match(route, /\.eq\('updates_consent', true\)/)
  assert.match(route, /\.is\('unsubscribed_at', null\)/)
})

test('the unsubscribe page needs a click to act, so link scanners cannot unsubscribe people', () => {
  const page = read('app/api/waitlist/unsubscribe/route.ts')
  const get = page.slice(
    page.indexOf('export async function GET'),
    page.indexOf('export async function POST'),
  )
  assert.ok(!/unsubscribe\(/.test(get), 'GET shows a form and changes nothing')
  assert.match(page, /method="post"/)
})
