// Run with: npm test   (Node's built-in test runner; no extra dependencies)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import nextConfig, { securityHeaders } from '../next.config.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const src = join(root, 'src')

function walk(dir, visit) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, visit)
    else if (/\.(ts|tsx|css)$/.test(name))
      visit(full, readFileSync(full, 'utf8'))
  }
}

// ---------------------------------------------------------------- headers
test('every response carries the security headers', async () => {
  const rules = await nextConfig.headers()
  assert.equal(rules.length, 1)
  assert.equal(rules[0].source, '/:path*')
  const byKey = Object.fromEntries(
    rules[0].headers.map((h) => [h.key, h.value]),
  )
  assert.equal(byKey['X-Content-Type-Options'], 'nosniff')
  assert.equal(byKey['X-Frame-Options'], 'DENY')
  assert.equal(byKey['Referrer-Policy'], 'strict-origin-when-cross-origin')
  assert.match(byKey['Strict-Transport-Security'], /max-age=(\d{8,})/)
  assert.match(byKey['Content-Security-Policy'], /frame-ancestors 'none'/)
  assert.match(byKey['Content-Security-Policy'], /object-src 'none'/)
  assert.match(byKey['Permissions-Policy'], /geolocation=\(self\)/)
  assert.equal(nextConfig.poweredByHeader, false)
  assert.equal(securityHeaders.length, 6)
})

test('headers never allow other sites to frame Food4Love or use the camera', () => {
  const policy = securityHeaders.find(
    (h) => h.key === 'Permissions-Policy',
  ).value
  assert.ok(!/\*/.test(policy), 'no feature is opened to every origin')
  assert.ok(!/frame-ancestors \*/.test(JSON.stringify(securityHeaders)))
})

// ------------------------------------------------- third-party resources
test('no page loads fonts or scripts from a third-party host by default', () => {
  const offenders = []
  walk(src, (file, text) => {
    if (
      /fonts\.googleapis\.com|fonts\.gstatic\.com|next\/font\/google/.test(text)
    )
      offenders.push(`${file}: google fonts`)
    if (/<script[^>]+src=["']https?:/.test(text))
      offenders.push(`${file}: external <script>`)
    if (/<link[^>]+href=["']https?:[^>]*stylesheet/.test(text))
      offenders.push(`${file}: external stylesheet`)
  })
  assert.deepEqual(offenders, [])
})

test('the root layout does not load the payment script for every visitor', () => {
  const layout = readFileSync(join(src, 'app/layout.tsx'), 'utf8')
  assert.ok(!/paystack/i.test(layout))
  const loader = readFileSync(join(src, 'lib/paystackLoader.ts'), 'utf8')
  assert.match(loader, /https:\/\/js\.paystack\.co\//)
})

test('unused packages stay removed', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const deps = Object.keys(pkg.dependencies)
  for (const gone of [
    'ai',
    '@ai-sdk/google',
    '@paystack/inline-js',
    'nanoid',
    'lenis',
    'lottie-react',
    '@react-spring/web',
    '@use-gesture/react',
    'embla-carousel-react',
    'sonner',
    '@tanstack/react-virtual',
  ]) {
    assert.ok(!deps.includes(gone), `${gone} should not be a dependency`)
  }
})

// ----------------------------------------------------- profile column privacy
import {
  PUBLIC_PROFILE_COLUMNS,
  PRIVATE_PROFILE_COLUMNS,
  PUBLIC_PROFILE_SELECT,
  touchesPrivateColumns,
} from '../src/lib/profileColumns.ts'

function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

// Pulls every  .from('profiles') ... .select('<columns>')  out of a file.
function profileSelects(text) {
  const found = []
  const re =
    /\.from\(\s*'profiles'\s*\)([\s\S]{0,300}?)\.select\(\s*(['"`])([\s\S]*?)\2/g
  let m
  while ((m = re.exec(text))) found.push(m[3])
  return found
}

function columnsOf(list) {
  // drop relations such as  daily_special:daily_specials(*)  and aliases
  const flat = list.replace(/[\w:!]+\([^()]*\)/g, '')
  return flat
    .split(',')
    .map((c) => c.trim().split(':').pop().trim())
    .filter(Boolean)
}

test('browser and session-side profile queries only name columns the database exposes', () => {
  const allowed = new Set([...PUBLIC_PROFILE_COLUMNS])
  const ownerOnly = new Set([...PRIVATE_PROFILE_COLUMNS])
  const offenders = []
  for (const file of sourceFiles(src)) {
    const text = readFileSync(file, 'utf8')
    // server code that uses the service-role client is not limited by these grants
    if (/createAdminClient/.test(text)) continue
    for (const list of profileSelects(text)) {
      for (const col of columnsOf(list)) {
        if (col === '*') offenders.push(`${file}: select('*')`)
        else if (
          !allowed.has(col) &&
          !(ownerOnly.has(col) && /ownProfile\.ts$/.test(file))
        )
          offenders.push(`${file}: ${col}`)
      }
    }
  }
  assert.deepEqual(offenders, [])
})

test('exact coordinates and private settings are never in the public column list', () => {
  for (const hidden of [
    'lat',
    'lng',
    'referral_code',
    'notification_preferences',
    'email_updates_consent',
    'age_confirmed_at',
    'is_demo',
  ]) {
    assert.ok(!PUBLIC_PROFILE_COLUMNS.includes(hidden), hidden)
  }
  assert.ok(!PUBLIC_PROFILE_SELECT.includes('*'))
  assert.equal(touchesPrivateColumns({ notification_preferences: {} }), true)
  assert.equal(touchesPrivateColumns({ bio: 'x', photos: [] }), false)
})

test('the migration grants exactly the columns the application is allowed to read', () => {
  const sql = readFileSync(
    join(root, 'supabase-migration-audit-hardening.sql'),
    'utf8',
  )
  const grants = [
    ...sql.matchAll(
      /grant select \(([\s\S]*?)\) on public\.profiles to (\w+)/g,
    ),
  ]
  const byRole = Object.fromEntries(
    grants.map((g) => [
      g[2],
      g[1]
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    ]),
  )
  assert.equal(byRole.anon.length, 16)
  assert.deepEqual(
    [...byRole.authenticated].sort(),
    [...PUBLIC_PROFILE_COLUMNS].sort(),
  )
  for (const hidden of [
    'lat',
    'lng',
    'referral_code',
    'notification_preferences',
    'email_updates_consent',
    'age_confirmed_at',
  ]) {
    assert.ok(
      !byRole.anon.includes(hidden) && !byRole.authenticated.includes(hidden),
      hidden,
    )
  }
})
