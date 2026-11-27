// Run with: npm test
// The registration route refuses a request whose session is not the account that tapped "Turn on".
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isAccountMismatch } from '../src/lib/push/subscriptionInput.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('isAccountMismatch', () => {
  assert.equal(isAccountMismatch({ expectedUserId: 'a' }, 'a'), false)
  assert.equal(isAccountMismatch({ expectedUserId: 'a' }, 'b'), true)
  assert.equal(isAccountMismatch({ expectedUserId: 42 }, 'b'), true)
  assert.equal(isAccountMismatch({ expectedUserId: '' }, 'b'), true)
  assert.equal(
    isAccountMismatch({}, 'b'),
    false,
    'service-worker re-subscribe has no expected id',
  )
  assert.equal(isAccountMismatch(null, 'b'), false)
})

test('the route checks the account before the enrolment gate and before any write', () => {
  const route = readFileSync(
    join(root, 'src/app/api/push/subscriptions/route.ts'),
    'utf8',
  )
  const post = route.slice(route.indexOf('export async function POST'))
  const check = post.indexOf("authority === 'mismatch'")
  assert.ok(post.indexOf('registrationAuthority(body, user.id)') > 0)
  assert.ok(check > 0)
  assert.ok(check < post.indexOf('pushEnrollmentFor('))
  assert.ok(check < post.indexOf("admin.rpc('food4love_push_register'"))
  assert.match(post.slice(check, check + 400), /status: 409/)
  // a background renewal must prove ownership of the old endpoint before any write
  const renewal = post.indexOf("authority === 'renewal'")
  assert.ok(renewal > 0)
  assert.ok(renewal < post.indexOf("admin.rpc('food4love_push_register'"))
  assert.match(
    post.slice(renewal, renewal + 700),
    /owner\.data\?\.user_id !== user\.id[\s\S]*renewal_deferred/,
  )
})

test('registrationAuthority: a browser-supplied id is only accepted when it equals the session', async () => {
  const { registrationAuthority } =
    await import('../src/lib/push/subscriptionInput.ts')
  assert.equal(registrationAuthority({ expectedUserId: 'a' }, 'a'), 'page')
  assert.equal(registrationAuthority({ expectedUserId: 'b' }, 'a'), 'mismatch')
  assert.equal(registrationAuthority({}, 'a'), 'renewal')
  assert.equal(registrationAuthority(null, 'a'), 'renewal')
})
