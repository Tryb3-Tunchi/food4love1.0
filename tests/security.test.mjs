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
    if (/createAdminClient|import 'server-only'/.test(text)) continue
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

// ------------------------------------------------------ adult confirmation
import {
  MINIMUM_AGE,
  ageGate,
  mayUseSocialFeatures,
  AGE_REQUIRED_CODE,
} from '../src/lib/ageGate.ts'

test('adult confirmation states', () => {
  assert.equal(MINIMUM_AGE, 18)
  assert.equal(ageGate(undefined), 'not_enforced') // database without the field
  assert.equal(ageGate(null), 'required')
  assert.equal(ageGate('2026-11-14T10:00:00Z'), 'confirmed')
  assert.equal(ageGate('not a date'), 'required')
  assert.equal(ageGate(''), 'required')
  assert.equal(mayUseSocialFeatures('confirmed'), true)
  assert.equal(mayUseSocialFeatures('not_enforced'), true)
  assert.equal(mayUseSocialFeatures('required'), false)
  assert.equal(AGE_REQUIRED_CODE, 'age_confirmation_required')
})

test('matching, likes and member profiles refuse members who have not confirmed', () => {
  for (const file of [
    'app/api/swipes/route.ts',
    'app/api/likes/route.ts',
    'app/(app)/member/[id]/page.tsx',
  ]) {
    const text = readFileSync(join(src, file), 'utf8')
    assert.match(text, /adultStates\(/, `${file} checks the adult confirmation`)
  }
  const swipes = readFileSync(join(src, 'app/api/swipes/route.ts'), 'utf8')
  // both people in a match must be confirmed
  assert.match(swipes, /adultStates\(admin, \[user\.id, target\.id\]\)/)
})

test('only the server can record the adult confirmation, once', () => {
  const route = readFileSync(
    join(src, 'app/api/account/confirm-age/route.ts'),
    'utf8',
  )
  assert.match(route, /createAdminClient/)
  assert.match(
    route,
    /\.is\('age_confirmed_at', null\)/,
    'never overwrites the original date',
  )
  assert.match(route, /z\.literal\(true\)/)
  const sql = readFileSync(
    join(root, 'supabase-migration-audit-hardening.sql'),
    'utf8',
  )
  assert.match(
    sql,
    /new\.age_confirmed_at is distinct from old\.age_confirmed_at/,
  )
})

test('signup requires the adult checkbox, links the real legal pages, and does not pre-tick marketing', () => {
  const page = readFileSync(join(src, 'app/(auth)/signup/page.tsx'), 'utf8')
  assert.match(page, /useState\(false\)/)
  assert.match(page, /adultConfirmed/)
  assert.match(page, /href="\/terms"/)
  assert.match(page, /href="\/privacy"/)
  assert.match(
    page,
    /const \[emailUpdatesConsent, setEmailUpdatesConsent\] = useState\(false\)/,
  )
  walk(src, (file, text) => {
    if (/href="#"/.test(text)) assert.fail(`${file} has a dead "#" link`)
  })
})

// ------------------------------------------------------------- AI routes
test('every AI route requires a signed-in member and is rate limited', () => {
  for (const name of [
    'bio',
    'chat-suggestions',
    'smart-match',
    'taste-profile',
  ]) {
    const route = readFileSync(join(src, `app/api/ai/${name}/route.ts`), 'utf8')
    assert.match(route, /guardAiRequest\(req\)/, name)
  }
  const guard = readFileSync(join(src, 'lib/ai/auth.ts'), 'utf8')
  assert.match(guard, /status: 401/)
  assert.match(guard, /status: 429/)
  assert.match(guard, /status: 413/)
})

test('every API route that is not a public form or a webhook checks who is calling', () => {
  const publicRoutes = new Set([
    'waitlist',
    'waitlist/unsubscribe',
    'email/unsubscribe',
    'analytics/collect',
    'webhooks/resend',
    'webhooks/paystack',
  ])
  const missing = []
  const apiRoot = join(src, 'app/api')
  walk(apiRoot, (file, text) => {
    if (!/route\.ts$/.test(file)) return
    const name = file
      .slice(apiRoot.length + 1)
      .replace(/\\/g, '/')
      .replace(/\/route\.ts$/, '')
    if (publicRoutes.has(name)) return
    if (
      !/getUser\(|getAdminUser|guardAiRequest|hasSignedInAiUser|beginAdminAudit/.test(
        text,
      )
    )
      missing.push(name)
  })
  assert.deepEqual(missing, [])
})

// ------------------------------------------------------------ open redirects
import { safeNextPath } from '../src/lib/safeRedirect.ts'

test('post-login redirects stay on this site', () => {
  assert.equal(safeNextPath('/onboarding/role'), '/onboarding/role')
  assert.equal(safeNextPath('/matches?tab=sent#top'), '/matches?tab=sent#top')
  assert.equal(safeNextPath(undefined), '/swipe')
  assert.equal(safeNextPath(null, '/home'), '/home')
  for (const bad of [
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    'https://evil.example',
    'http://evil.example/x',
    'javascript:alert(1)',
    'evil.example',
    '',
    '/' + 'a'.repeat(600),
    '///evil.example',
    '/%5Cevil.example/..//evil.example',
  ]) {
    const result = safeNextPath(bad)
    assert.ok(
      result === '/swipe' ||
        (result.startsWith('/') && !result.startsWith('//')),
      `${JSON.stringify(bad)} -> ${result}`,
    )
    assert.ok(
      !/evil\.example/.test(result.split('?')[0].split('/')[1] ?? ''),
      bad,
    )
  }
  assert.equal(safeNextPath('//evil.example'), '/swipe')
  assert.equal(safeNextPath('/\\evil.example'), '/swipe')
  assert.equal(safeNextPath('/\t/evil.example'), '/swipe')
  const route = readFileSync(join(src, 'app/auth/callback/route.ts'), 'utf8')
  assert.match(route, /safeNextPath\(/)
})

// ------------------------------------------------- migration safety rails
test('the superseded privacy migration stops immediately and the new one says so', () => {
  const old = readFileSync(
    join(root, 'supabase-migration-profiles-privacy-hardening.sql'),
    'utf8',
  )
  const firstStatement = old
    .split('\n')
    .filter((l) => !/^\s*--/.test(l) && l.trim())[0]
  assert.match(
    firstStatement,
    /^do \$\$/i,
    'the first executable statement is the stop',
  )
  assert.match(old, /raise exception 'SUPERSEDED/)
  assert.ok(
    old.indexOf('raise exception') < old.indexOf('begin;'),
    'stop comes before any change',
  )
  const fresh = readFileSync(
    join(root, 'supabase-migration-audit-hardening.sql'),
    'utf8',
  )
  assert.match(
    fresh,
    /Supersedes supabase-migration-profiles-privacy-hardening\.sql/,
  )
  assert.match(fresh, /TRANSITION EFFECTS/)
})

test('the legacy-trigger migration warns that it must follow disabling sign-ups', () => {
  const sql = readFileSync(
    join(root, 'supabase-migration-drop-legacy-signup-trigger.sql'),
    'utf8',
  )
  assert.match(sql, /ORDER WARNING/)
  assert.match(sql, /Allow new users to sign up/)
  assert.match(
    sql,
    /replacement trigger food4love_create_profile_after_signup is missing/,
  )
})

test('both new migrations are single transactions that touch no existing rows', () => {
  for (const f of [
    'supabase-migration-audit-hardening.sql',
    'supabase-migration-drop-legacy-signup-trigger.sql',
  ]) {
    const sql = readFileSync(join(root, f), 'utf8')
    const code = sql
      .split('\n')
      .filter((l) => !/^\s*--/.test(l))
      .join('\n')
    assert.match(code, /^\s*begin;/m, f)
    assert.match(code, /^\s*commit;/m, f)
    assert.ok(
      !/\b(insert into public\.profiles|update public\.profiles|delete from|drop table|truncate table)\b/i.test(
        code.replace(/revoke[^;]*;/gi, ''),
      ),
      `${f} changes no rows`,
    )
  }
})
