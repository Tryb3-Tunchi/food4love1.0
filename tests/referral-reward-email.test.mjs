import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { register } from 'node:module'
import { fileURLToPath } from 'node:url'

import { referralRewardEmail } from '../src/lib/email/templates.ts'
import {
  FakeSupabase,
  installResend,
  productionLikeConfig,
} from './helpers/fake-supabase.mjs'

register('./helpers/alias-hooks.mjs', import.meta.url)
const { processReferralRewardEmails } =
  await import('../src/lib/email/referralRewards.ts')
const transactional = await import('../src/lib/email/transactional.ts')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')

test('the referral email safely confirms the full wallet reward', () => {
  const email = referralRewardEmail({
    name: '<script>alert(1)</script> Taylor',
    appUrl: 'https://food4love.app/',
  })
  assert.match(email.subject, /₦1,000/)
  assert.match(email.text, /₦1,000 has been added/)
  assert.match(email.html, /₦1,000 added to your wallet/)
  assert.match(email.html, /&lt;script&gt;/)
  assert.doesNotMatch(email.html, /<script>/)
  assert.match(email.html, /https:\/\/food4love\.app\/profile/)
})

test('confirmed referral signup gets one durable, idempotent reward email', async () => {
  const resend = installResend()
  process.env.ACCOUNT_UPDATES_FROM_EMAIL = 'Food4Love <account@example.test>'
  delete process.env.REFERRAL_REWARD_FROM_EMAIL
  assert.equal(
    transactional.senderFor('referral_reward'),
    'Food4Love <account@example.test>',
  )

  const admin = new FakeSupabase(productionLikeConfig())
  admin.rows('referral_reward_email_cutover').push({
    id: true,
    applied_at: '2026-11-23T00:00:00.000Z',
  })
  admin.rows('referrals').push({
    id: 'referral-1',
    referrer_id: 'referrer-1',
    referred_user_id: 'invitee-1',
    signup_rewarded_at: '2026-11-23T01:00:00.000Z',
  })
  admin.rows('profiles').push({
    id: 'referrer-1',
    full_name: 'Taylor Kent',
  })
  admin.auth.admin.users.push({
    id: 'referrer-1',
    email: 'taylor@example.test',
    email_confirmed_at: '2026-11-22T00:00:00.000Z',
  })

  const first = await processReferralRewardEmails(admin, {
    appUrl: 'https://food4love.app',
    referredUserId: 'invitee-1',
    limit: 1,
  })
  assert.equal(first.sent, 1)
  assert.equal(resend.requests.length, 1)
  assert.equal(resend.requests[0].to[0], 'taylor@example.test')
  assert.match(resend.requests[0].text, /₦1,000/)
  assert.equal(resend.requests[0].key, 'referral_reward:referral-1')

  const second = await processReferralRewardEmails(admin, {
    appUrl: 'https://food4love.app',
    referredUserId: 'invitee-1',
    limit: 1,
  })
  assert.equal(second.checked, 0)
  assert.equal(resend.requests.length, 1)
  assert.equal(admin.rows('email_deliveries').length, 1)
  assert.equal(admin.rows('email_deliveries')[0].status, 'accepted')
})

test('the production migration grants the full reward once and queues email without blocking signup', () => {
  const sql = read('supabase-migration-referral-signup-credit-and-email.sql')
  assert.match(sql, /referrer, 1000, 'referral_signup'/)
  assert.match(sql, /signup_rewarded_at, second_rewarded_at/)
  assert.match(
    sql,
    /values \(referrer, new\.id, referral_code_input, now\(\), now\(\)\)/,
  )
  assert.match(sql, /'referral_reward', referral_id::text, 'queued'/)
  assert.match(sql, /on conflict \(kind, recipient_key\) do nothing/)
  assert.match(sql, /exception when others then[\s\S]*raise warning/)
  assert.match(sql, /referral_reward_email_cutover/)
  assert.match(sql, /'password_recovery', 'referral_reward'/)

  const signup = read('src/app/auth/callback/route.ts')
  assert.match(signup, /processReferralRewardEmails/)
  const cron = read('src/app/api/cron/process-notifications/route.ts')
  assert.match(cron, /drainReferralRewardEmails/)
})
