import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (path) => readFileSync(join(root, path), 'utf8')

test('support API protects guest sessions and never returns staff-only notes', () => {
  const route = read('src/app/api/support/route.ts')
  assert.match(route, /randomBytes\(32\)/)
  assert.match(route, /createHash\('sha256'\)/)
  assert.match(route, /httpOnly: true/)
  assert.match(route, /sameSite: 'lax'/)
  assert.match(route, /\.eq\('is_internal_note', false\)/)
  assert.match(route, /food4love_allow_support_message/)
  assert.match(route, /profile\.suspended/)
  assert.match(route, /thread\.status = 'open'/)
  assert.doesNotMatch(route, /console\.(log|info|error)\([^)]*body/i)
})

test('admin support routes require message permission and audit access/actions', () => {
  const inbox = read('src/app/api/admin/support/route.ts')
  const assignment = read('src/app/api/admin/support/[threadId]/route.ts')
  assert.match(inbox, /getAdminUser\('messages:manage'\)/)
  assert.match(inbox, /beginAdminAudit/)
  assert.match(inbox, /\.eq\('thread_id', thread\.id\)/)
  assert.match(assignment, /getAdminUser\('messages:manage'\)/)
  assert.match(assignment, /beginAdminAudit/)
})

test('campaign test sends only to the signed-in confirmed admin', () => {
  const route = read('src/app/api/admin/campaigns/test/route.ts')
  assert.match(route, /getAdminUser\('messages:manage'\)/)
  assert.match(route, /getUserById\(actor\.id\)/)
  assert.match(route, /email_confirmed_at/)
  assert.match(route, /to,\s*email:/)
  assert.match(route, /recipient_is_actor: true/)
})

test('recipient directories restrict members and waitlist to eligible audiences', () => {
  const members = read('src/app/api/admin/announcements/recipients/route.ts')
  const waitlist = read('src/app/api/waitlist/campaigns/recipients/route.ts')
  assert.match(members, /getAdminUser\('messages:manage'\)/)
  assert.match(members, /email_updates_consent/)
  assert.match(members, /suspended\.is\.null,suspended\.eq\.false/)
  assert.match(waitlist, /getAdminUser\('messages:manage'\)/)
  assert.match(waitlist, /\.eq\('updates_consent', true\)/)
  assert.match(waitlist, /\.is\('unsubscribed_at', null\)/)
  assert.match(waitlist, /maskEmail/)
})

test('scheduled campaigns retain their cursor and next-run time after each batch', () => {
  for (const path of [
    'src/app/api/admin/announcements/route.ts',
    'src/app/api/waitlist/campaigns/route.ts',
  ]) {
    const route = read(path)
    assert.match(route, /verifyCronRequest\(/)
    assert.match(
      route,
      /hasMore && isCron \? new Date\(\)\.toISOString\(\) : null/,
    )
  }
})

test('support SQL keeps RLS enabled and makes rate-limit RPC server-only', () => {
  const support = read(
    'supabase-migration-live-support-and-email-campaigns.sql',
  )
  const limits = read('supabase-migration-support-rate-limits.sql')
  assert.match(support, /enable row level security/i)
  assert.match(support, /not is_internal_note/i)
  assert.match(limits, /enable row level security/i)
  assert.match(
    limits,
    /revoke all on function[^;]+from public, anon, authenticated/is,
  )
  assert.match(limits, /grant execute on function[^;]+to service_role/is)
})
