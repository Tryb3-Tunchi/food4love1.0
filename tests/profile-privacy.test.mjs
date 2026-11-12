// Guards the profile-privacy migration against drifting away from the code.
// Run with: npm test   (no dependencies; reads the files as text)
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const migration = read('supabase-migration-profiles-privacy-hardening.sql')
const chefPage = read('src/app/cook/[id]/page.tsx')

// The columns the migration lets logged-out visitors read.
function grantedToAnon() {
  const match = migration.match(
    /grant select \(([\s\S]*?)\) on public\.profiles to anon;/,
  )
  assert.ok(match, 'migration has a column grant for anon')
  return match[1]
    .split(',')
    .map((c) => c.replace(/--.*$/gm, '').trim())
    .filter(Boolean)
}

// Every profiles select() string in the public chef page.
function chefPageSelects() {
  const out = []
  const re =
    /\.from\('profiles'\)\s*(?:\/\/[^\n]*\n\s*)*\.select\(\s*'([^']*)'/g
  let m
  while ((m = re.exec(chefPage))) out.push(m[1])
  return out
}

const columnsOf = (select) =>
  select
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c && !c.includes(':') && !c.includes('('))

test('the public chef page never selects "*" from profiles', () => {
  const selects = chefPageSelects()
  assert.ok(selects.length >= 2, 'found the metadata and page queries')
  for (const s of selects) {
    assert.ok(!/(^|,)\s*\*\s*(,|$)/.test(s), `no wildcard in: ${s}`)
  }
})

test('every column the public chef page reads is granted to logged-out visitors', () => {
  const granted = new Set(grantedToAnon())
  for (const select of chefPageSelects()) {
    for (const column of columnsOf(select)) {
      assert.ok(
        granted.has(column),
        `"${column}" is read by /cook/[id] but not granted to anon; the page would break`,
      )
    }
  }
  // Columns used in filters on that page.
  for (const filter of ['role', 'suspended']) {
    assert.ok(granted.has(filter), `filter column "${filter}" must be granted`)
  }
})

test('kyc_status stays granted: the public specials policy reads it as the visitor', () => {
  // Found in the live database: policy "Customers read verified active specials"
  // on daily_specials (roles anon, authenticated) checks profiles.kyc_status.
  assert.ok(grantedToAnon().includes('kyc_status'))
  for (const column of ['id', 'role', 'suspended']) {
    assert.ok(
      grantedToAnon().includes(column),
      `${column} is used by that policy`,
    )
  }
})

test('sensitive profile columns are never granted to logged-out visitors', () => {
  const granted = new Set(grantedToAnon())
  for (const secret of [
    'lat',
    'lng',
    'referral_code',
    'notification_preferences',
    'email_updates_consent',
    'email_updates_consent_at',
    'onboarding_complete',
    'is_demo',
    'streak',
    'tour_completed',
  ]) {
    assert.ok(!granted.has(secret), `${secret} must stay private`)
  }
})

test('the guard function protects reputation fields and keeps the original rules', () => {
  for (const rule of [
    'new.kyc_status is distinct from old.kyc_status',
    'new.is_verified is distinct from old.is_verified',
    'new.suspended is distinct from old.suspended',
    'new.rating is distinct from old.rating',
    'new.review_count is distinct from old.review_count',
    'new.streak is distinct from old.streak',
    'new.is_demo is distinct from old.is_demo',
    'Role cannot be changed after onboarding is complete',
  ]) {
    assert.ok(migration.includes(rule), `guard keeps: ${rule}`)
  }
})

test('the audit-log guard blocks edits, deletes and truncation', () => {
  const sql = read('supabase-migration-admin-intelligence.sql')
  assert.ok(sql.includes('before update or delete on public.admin_audit_log'))
  assert.ok(sql.includes('before truncate on public.admin_audit_log'))
  assert.ok(
    sql.includes(
      'revoke delete, truncate on public.admin_audit_log from service_role',
    ),
  )
})
