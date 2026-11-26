// Run with: npm test
// The committed VAPID public keys, their project-based selection (no Vercel setting), and the
// Supabase pilot allowlist that replaced the PUSH_ENROLLMENT / PUSH_PILOT_USER_IDS env vars.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

import {
  PUSH_PUBLIC_KEYS,
  pushPublicKeyFor,
  supabaseProjectRef,
} from '../src/lib/push/publicKeys.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const PROD = 'oynhaqpuqzvaymntnzqo'
const STAGING = 'pnqjzlzcvrtkpzhonjft'

test('production and staging each have their own valid P-256 public key', () => {
  assert.deepEqual(Object.keys(PUSH_PUBLIC_KEYS).sort(), [PROD, STAGING].sort())
  for (const key of Object.values(PUSH_PUBLIC_KEYS)) {
    const bytes = Buffer.from(key, 'base64url')
    assert.equal(bytes.length, 65)
    assert.equal(bytes[0], 4, 'uncompressed point')
  }
  assert.notEqual(PUSH_PUBLIC_KEYS[PROD], PUSH_PUBLIC_KEYS[STAGING])
})

test('the key is chosen by the Supabase project the build talks to', () => {
  assert.equal(
    pushPublicKeyFor(`https://${PROD}.supabase.co`),
    PUSH_PUBLIC_KEYS[PROD],
  )
  assert.equal(
    pushPublicKeyFor(`https://${PROD}.supabase.co/`),
    PUSH_PUBLIC_KEYS[PROD],
  )
  assert.equal(
    pushPublicKeyFor(`https://${STAGING}.supabase.co`),
    PUSH_PUBLIC_KEYS[STAGING],
  )
})

test('fails closed when the project cannot be identified', () => {
  for (const url of [
    undefined,
    null,
    '',
    'http://localhost:54321',
    `http://${PROD}.supabase.co`,
    `https://${PROD}.supabase.co.evil.test`,
    `https://evil.test/${PROD}.supabase.co`,
    `https://${PROD}.supabase.co/rest/v1`,
    'https://abcdefghijklmnopqrst.supabase.co',
    'https://constructor00000000000.supabase.co',
    'https://__proto__000000000000.supabase.co',
  ])
    assert.equal(pushPublicKeyFor(url), null, String(url))
  assert.equal(supabaseProjectRef(`https://${PROD}.supabase.co`), PROD)
})

test('the browser and server use the project key, not a Vercel variable', () => {
  const client = read('src/lib/push/client.ts')
  assert.match(
    client,
    /pushPublicKeyFor\(process\.env\.NEXT_PUBLIC_SUPABASE_URL\)/,
  )
  assert.doesNotMatch(client, /NEXT_PUBLIC_VAPID_PUBLIC_KEY \?\?/)
  const route = read('src/app/api/push/subscriptions/route.ts')
  assert.match(
    route,
    /pushPublicKeyFor\(process\.env\.NEXT_PUBLIC_SUPABASE_URL\)/,
  )
})

test('no private key, dispatch secret or service-role key is committed', () => {
  const tracked = execFileSync('git', ['ls-files'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(
      (f) =>
        /\.(ts|tsx|js|mjs|json|sql|md|env|example|txt)$/.test(f) &&
        !f.includes('node_modules'),
    )
  const hits = []
  for (const file of tracked) {
    let text
    try {
      text = read(file)
    } catch {
      continue
    }
    if (/"d"\s*:\s*"[A-Za-z0-9_-]{40,}"/.test(text))
      hits.push(`${file}: private JWK`)
    if (/VAPID_KEYS_JSON=\{/.test(text))
      hits.push(`${file}: VAPID_KEYS_JSON value`)
    if (/PUSH_DISPATCH_SECRET=[0-9a-f]{32,}/.test(text))
      hits.push(`${file}: dispatch secret`)
    if (/SUPABASE_SERVICE_ROLE_KEY=(?:ey|sb_secret_)\S{20,}/.test(text))
      hits.push(`${file}: service-role key`)
  }
  assert.deepEqual(hits, [])
})

test('the retired env-variable gate is gone', () => {
  const server = read('src/lib/push/server.ts')
  assert.doesNotMatch(
    server,
    /process\.env|env\.PUSH_ENROLLMENT|env\.PUSH_PILOT_USER_IDS/,
  )
  assert.match(server, /from\('push_pilot_members'\)/)
  assert.match(server, /if \(error\) return 'unavailable'/)
  const route = read('src/app/api/push/subscriptions/route.ts')
  assert.doesNotMatch(
    route,
    /PUSH_ENROLLMENT|PUSH_PILOT_USER_IDS|mayEnrollInPush/,
  )
  assert.match(route, /pushEnrollmentFor\(createAdminClient\(\), user\.id\)/)
})

test('the pilot migration keeps the list closed to browsers and enforces it in the database', () => {
  const sql = read('supabase-migration-push-pilot-allowlist.sql')
  assert.match(
    sql,
    /revoke all on public\.push_pilot_members from public, anon, authenticated/,
  )
  assert.doesNotMatch(sql, /create policy/i)
  assert.match(
    sql,
    /before insert or update of user_id on public\.push_subscriptions/,
  )
  assert.match(sql, /after delete on public\.push_pilot_members/)
  assert.match(sql, /raise exception 'pilot table is reachable by %'/)
  assert.doesNotMatch(
    sql.replace(/^--.*$/gm, ''),
    /insert into public\.push_pilot_members/i,
    'nobody is enrolled by the migration',
  )
  assert.match(sql, /^begin;/m)
  assert.match(sql, /^commit;/m)
})

test('opt-in migration: switch starts at pilot, is closed to browsers, keeps in-use devices', () => {
  const sql = read('supabase-migration-push-general-opt-in.sql')
  assert.match(sql, /enrollment text not null default 'pilot'/)
  assert.match(
    sql,
    /revoke all on public\.push_settings from public, anon, authenticated/,
  )
  assert.doesNotMatch(sql, /create policy/i)
  assert.doesNotMatch(
    sql.replace(/^--.*$/gm, ''),
    /update public\.push_settings set enrollment = 'open'/,
    'the migration never opens enrollment itself',
  )
  assert.match(
    sql,
    /greatest\(last_seen_at, coalesce\(last_success_at, last_seen_at\)\)/,
  )
})

test('the app refreshes only its OWN device registration, at most daily, without prompting', () => {
  const client = read('src/lib/push/client.ts')
  assert.match(client, /export async function refreshOwnDevice/)
  assert.match(client, /getItem\(OWNER_KEY\) !== userId\) return/)
  assert.match(client, /24 \* 60 \* 60 \* 1000/)
  const fn = client.slice(
    client.indexOf('export async function refreshOwnDevice'),
  )
  assert.doesNotMatch(fn, /requestPermission|pushManager\.subscribe/)
  assert.match(
    read('src/components/notifications/PushSessionGuard.tsx'),
    /refreshOwnDevice\(/,
  )
})
