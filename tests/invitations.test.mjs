// Run with: npm test   (Node's built-in test runner; no extra dependencies)
//
// Admin tester invitations. Three layers:
//   1. pure rules (validation, account states, error classification, password policy)
//   2. the shipped SQL and route sources (security properties that must not regress)
//   3. BEHAVIOUR: the real server modules run against an in-memory fake of Supabase and
//      Resend (tests/helpers), so double clicks, revoke races, resend failures and the full
//      accept flow are exercised as written, never against a real database or mailbox.

import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { register } from 'node:module'
import { fileURLToPath } from 'node:url'

import * as rules from '../src/lib/invitations/rules.ts'
import * as tokens from '../src/lib/invitations/token.ts'
import { resolveAppUrl } from '../src/lib/appUrl.ts'
import { testerInvitationEmail } from '../src/lib/email/templates.ts'
import {
  FakeSupabase,
  fakeSession,
  installResend,
  productionLikeConfig,
} from './helpers/fake-supabase.mjs'

register('./helpers/alias-hooks.mjs', import.meta.url)
const server = await import('../src/lib/invitations/server.ts')
const accept = await import('../src/lib/invitations/accept.ts')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

// ================================================================== 1. pure rules
test('production app links ignore localhost configuration but preserve local development', () => {
  const previousNodeEnv = process.env.NODE_ENV
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL
  try {
    process.env.NODE_ENV = 'production'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    assert.equal(
      resolveAppUrl('https://food4love.app'),
      'https://food4love.app',
    )

    process.env.NEXT_PUBLIC_APP_URL = 'https://configured.example'
    assert.equal(
      resolveAppUrl('https://food4love.app'),
      'https://configured.example',
    )

    process.env.NODE_ENV = 'development'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    assert.equal(
      resolveAppUrl('http://localhost:5000'),
      'http://localhost:3000',
    )
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
    if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl
  }
})

test('every access type maps to a profile role and none is an admin type', () => {
  const keys = rules.ACCESS_TYPES.map((t) => t.key)
  assert.deepEqual(keys, [
    'beta_tester',
    'regular_user',
    'cook_tester',
    'chef_tester',
  ])
  assert.equal(rules.profileRoleFor('beta_tester'), 'buyer')
  assert.equal(rules.profileRoleFor('regular_user'), 'buyer')
  assert.equal(rules.profileRoleFor('cook_tester'), 'cook')
  assert.equal(rules.profileRoleFor('chef_tester'), 'cook')
  for (const key of keys) {
    assert.ok(
      !/admin|moderator|super|verif/i.test(key),
      `${key} must not look like a privilege`,
    )
  }
  assert.equal(rules.isAccessType('admin'), false)
  assert.equal(rules.isAccessType('super_admin'), false)
})

test('validateInviteInput accepts a good invitation and normalises it', () => {
  const result = rules.validateInviteInput({
    full_name: '  Adaeze   Okonkwo ',
    email: '  Adaeze@Example.COM ',
    preferred_username: '@Adaeze.O',
    access_type: 'cook_tester',
    personal_message: 'Thanks   for   helping.',
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.value, {
    full_name: 'Adaeze Okonkwo',
    email: 'adaeze@example.com',
    preferred_username: 'adaeze.o',
    access_type: 'cook_tester',
    personal_message: 'Thanks for helping.',
  })
})

test('validateInviteInput rejects bad input with a message per field', () => {
  const bad = rules.validateInviteInput({
    full_name: 'A',
    email: 'not-an-email',
    preferred_username: 'ab',
    access_type: 'super_admin',
    personal_message: 'x'.repeat(501),
  })
  assert.equal(bad.ok, false)
  assert.deepEqual(Object.keys(bad.errors).sort(), [
    'access_type',
    'email',
    'full_name',
    'personal_message',
    'preferred_username',
  ])
})

test('names and emails with markup or control characters are refused', () => {
  const base = {
    full_name: 'Ada',
    email: 'a@example.com',
    access_type: 'beta_tester',
  }
  for (const full_name of [
    '<script>alert(1)</script>',
    'Ada\u0000',
    'Ada <b>',
  ]) {
    assert.equal(
      rules.validateInviteInput({ ...base, full_name }).ok,
      false,
      full_name,
    )
  }
  for (const email of [
    'a@b',
    'a b@example.com',
    'a@@example.com',
    'a@example..com',
    '"a"@example.com',
    'a@exa\nmple.com',
    'a@example.com\nBcc: x@y.z',
    '<a@example.com>',
  ]) {
    assert.equal(
      rules.validateInviteInput({ ...base, email }).ok,
      false,
      JSON.stringify(email),
    )
  }
  // surrounding whitespace is just trimmed, not an error
  assert.equal(
    rules.validateInviteInput({ ...base, email: '  a@example.com\n' }).value
      .email,
    'a@example.com',
  )
})

test('usernames: format, case and reserved words', () => {
  const ok = (name) =>
    rules.validateInviteInput({
      full_name: 'Ada Obi',
      email: 'a@example.com',
      access_type: 'beta_tester',
      preferred_username: name,
    })
  assert.equal(ok('chef_ada').ok, true)
  assert.equal(ok('Ada.Obi-1').value.preferred_username, 'ada.obi-1')
  for (const name of [
    'ab',
    '-ada',
    'ada-',
    'a'.repeat(31),
    'ada obi',
    'ada!',
    'admin',
    'Support',
    'food4love',
  ]) {
    assert.equal(ok(name).ok, false, name)
  }
})

test('the optional note is plain text, trimmed and length limited', () => {
  const r = rules.validateInviteInput({
    full_name: 'Ada Obi',
    email: 'a@example.com',
    access_type: 'beta_tester',
    personal_message: '   ',
  })
  assert.equal(r.value.personal_message, null)
})

test('invitation status: pending expires by itself; resend/revoke rules', () => {
  const past = new Date(Date.now() - 1000).toISOString()
  const future = new Date(Date.now() + 60_000).toISOString()
  assert.equal(
    rules.effectiveStatus({ status: 'pending', expires_at: past }),
    'expired',
  )
  assert.equal(
    rules.effectiveStatus({ status: 'pending', expires_at: future }),
    'pending',
  )
  assert.equal(
    rules.effectiveStatus({ status: 'accepted', expires_at: past }),
    'accepted',
  )
  assert.equal(
    rules.effectiveStatus({ status: 'revoked', expires_at: past }),
    'revoked',
  )
  for (const s of ['pending', 'failed', 'expired']) {
    assert.equal(rules.canResend(s), true, s)
    assert.equal(rules.canRevoke(s), true, s)
  }
  for (const s of ['accepted', 'revoked']) {
    assert.equal(rules.canResend(s), false, s)
    assert.equal(rules.canRevoke(s), false, s)
  }
})

test('password policy: the person chooses it, weak ones are refused, never echoed back', () => {
  const ctx = { email: 'adaeze@example.com', fullName: 'Adaeze Okonkwo' }
  assert.equal(rules.validatePassword('Tomato-stew-2026', ctx).ok, true)
  const cases = {
    short1a: 'Use at least 10 characters.',
    'only-letters-here': 'Include at least one letter and one number.',
    1234567890123: 'Include at least one letter and one number.',
    password123: 'That password is too common. Choose another.',
    Pw1: 'Use at least 10 characters.',
    Password1234: null, // fine: not on the list and 12 chars
    'adaeze-is-great-1': 'Do not include your email address in your password.',
  }
  for (const [pw, expected] of Object.entries(cases)) {
    const r = rules.validatePassword(pw, ctx)
    if (expected === null) assert.equal(r.ok, true, pw)
    else {
      assert.equal(r.ok, false, pw)
      assert.equal(r.message, expected, pw)
      assert.ok(
        !r.message.includes(pw),
        'the message must never contain the password',
      )
    }
  }
  assert.equal(rules.validatePassword(undefined).ok, false)
  assert.equal(rules.validatePassword('a1'.repeat(70)).ok, false)
  assert.equal(rules.validatePassword('welcome123', ctx).ok, false)
})

// ---- account states
const facts = (over = {}) => ({
  pendingInvitation: null,
  priorInvitation: null,
  authUser: null,
  usernameTaken: false,
  ...over,
})

test('decideInviteTarget: a clean address may be invited', () => {
  const d = rules.decideInviteTarget(facts())
  assert.deepEqual(d, {
    ok: true,
    adoptAuthUserId: null,
    reuseInvitationId: null,
    note: null,
  })
})

test('decideInviteTarget: pending invitation blocks and points at it', () => {
  const d = rules.decideInviteTarget(
    facts({ pendingInvitation: { id: 'inv-1' } }),
  )
  assert.equal(d.ok, false)
  assert.equal(d.code, 'pending_invitation')
  assert.equal(d.invitationId, 'inv-1')
})

test('decideInviteTarget: a used account is never touched (no reset, no change)', () => {
  for (const authUser of [
    { id: 'u', confirmed: true, signedInBefore: false, hasProfile: true },
    { id: 'u', confirmed: false, signedInBefore: true, hasProfile: true },
  ]) {
    const d = rules.decideInviteTarget(facts({ authUser }))
    assert.equal(d.ok, false)
    assert.equal(d.code, 'existing_account')
    assert.match(d.message, /unchanged/)
    assert.match(d.message, /no password was reset/)
  }
})

test('decideInviteTarget: an unused leftover account is adopted, not duplicated', () => {
  const withProfile = rules.decideInviteTarget(
    facts({
      authUser: {
        id: 'ghost',
        confirmed: false,
        signedInBefore: false,
        hasProfile: true,
      },
    }),
  )
  assert.equal(withProfile.ok, true)
  assert.equal(withProfile.adoptAuthUserId, 'ghost')
  const noProfile = rules.decideInviteTarget(
    facts({
      authUser: {
        id: 'ghost',
        confirmed: false,
        signedInBefore: false,
        hasProfile: false,
      },
    }),
  )
  assert.equal(noProfile.adoptAuthUserId, 'ghost')
  assert.match(noProfile.note, /without a profile/)
})

test('decideInviteTarget: a failed/expired invitation is continued, a taken username blocks', () => {
  const reuse = rules.decideInviteTarget(
    facts({ priorInvitation: { id: 'old', status: 'failed' } }),
  )
  assert.equal(reuse.reuseInvitationId, 'old')
  const taken = rules.decideInviteTarget(facts({ usernameTaken: true }))
  assert.equal(taken.ok, false)
  assert.equal(taken.code, 'username_taken')
  // an unknown account state (lookup unavailable) does not block: Supabase decides
  const unknown = rules.decideInviteTarget(facts({ authUser: 'unknown' }))
  assert.equal(unknown.ok, true)
  assert.equal(unknown.adoptAuthUserId, null)
})

// ---- the error that used to be "the email may already be registered" for everything
test('classifyAuthError tells the real causes apart', () => {
  const c = rules.classifyAuthError
  assert.deepEqual(
    [
      c({ code: 'email_exists', status: 422 }).code,
      c({ code: 'email_exists', status: 422 }).httpStatus,
    ],
    ['existing_account', 409],
  )
  assert.equal(
    c({ message: 'A user with this email address has already been registered' })
      .code,
    'existing_account',
  )
  assert.equal(
    c({ code: 'over_email_send_rate_limit', status: 429 }).code,
    'email_rate_limited',
  )
  assert.equal(c({ status: 429 }).retryable, true)
  assert.equal(c({ code: 'email_address_invalid' }).code, 'email_invalid')
  assert.equal(
    c({ code: 'email_address_not_authorized' }).code,
    'email_not_authorized',
  )
  assert.equal(c({ code: 'signup_disabled' }).code, 'signups_disabled')
  assert.equal(c({ code: 'user_banned' }).code, 'user_banned')
  assert.equal(
    c({ status: 500, message: 'Database error saving new user' }).code,
    'profile_trigger_failed',
  )
  assert.equal(
    c({ status: 500, message: 'Error sending invite email' }).code,
    'email_send_failed',
  )
  assert.equal(
    c({ message: 'requested path is invalid: redirect_to' }).code,
    'redirect_not_allowed',
  )
  assert.equal(c({ status: 503, message: '' }).code, 'service_unavailable')
  assert.equal(c(null).code, 'service_unavailable')
  const unknown = c({ code: 'weird_code', status: 400, message: 'something' })
  assert.equal(unknown.code, 'unknown')
  assert.match(unknown.message, /weird_code/)
})

test('only a genuine duplicate is reported as "already exists"', () => {
  const causes = [
    { code: 'over_email_send_rate_limit', status: 429 },
    { status: 500, message: 'Database error saving new user' },
    { status: 500, message: 'Error sending invite email' },
    { code: 'signup_disabled' },
    { status: 503 },
    null,
  ]
  for (const cause of causes) {
    assert.notEqual(
      rules.classifyAuthError(cause).code,
      'existing_account',
      JSON.stringify(cause),
    )
    assert.doesNotMatch(
      rules.classifyAuthError(cause).message,
      /already/i,
      JSON.stringify(cause),
    )
  }
})

test('email delivery is never described as delivered unless the provider said so', () => {
  const d = rules.describeEmailDelivery
  assert.equal(d(0, null).label, 'Not sent')
  assert.equal(d(1, null).label, 'Sent (not tracked)')
  assert.equal(d(1, { status: 'accepted' }).label, 'Accepted by email provider')
  assert.notEqual(d(1, { status: 'accepted' }).tone, 'ok')
  assert.equal(d(1, { status: 'delivered' }).label, 'Delivered')
  assert.equal(d(1, { status: 'bounced' }).tone, 'bad')
  assert.equal(d(1, { status: 'failed' }).tone, 'bad')
  assert.equal(d(1, { status: 'queued' }).tone, 'warn')
})

// ================================================================== tokens
test('invitation secrets are 256-bit random, hashed, and recognisable', () => {
  const a = tokens.generateInviteToken()
  const b = tokens.generateInviteToken()
  assert.match(a, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(a, b)
  assert.equal(tokens.looksLikeInviteToken(a), true)
  for (const bad of [
    '',
    'short',
    a + 'x',
    a.slice(1),
    12,
    null,
    undefined,
    `${a.slice(0, 42)}!`,
  ]) {
    assert.equal(tokens.looksLikeInviteToken(bad), false, String(bad))
  }
  const hash = tokens.hashInviteToken(a)
  assert.match(hash, /^[0-9a-f]{64}$/)
  assert.equal(hash, createHash('sha256').update(a).digest('hex'))
  assert.equal(hash, tokens.hashInviteToken(a))
  assert.notEqual(hash, tokens.hashInviteToken(b))
})

// ================================================================== the email
const sampleEmail = (over = {}) =>
  testerInvitationEmail({
    fullName: 'Adaeze Okonkwo',
    acceptUrl: 'https://app.example.test/invite/accept#token=abc',
    expiresAt: '2026-11-24T10:00:00.000Z',
    personalMessage: null,
    ...over,
  })

test('the invitation email carries the approved subject and wording', () => {
  const mail = sampleEmail()
  assert.equal(mail.subject, "You're invited! Get early access to Food4Love ❤️")
  for (const html of [mail.html, mail.text]) {
    const flat = html.replace(/&rsquo;|&#39;/g, "'")
    for (const phrase of [
      "You've been personally invited to join Food4Love as an early tester!",
      'Food4Love is bringing people together through food, meaningful connections and shared experiences.',
      "We're getting ready for something special",
      'Click the button below to accept your invitation.',
      'Set up your password securely.',
      'Complete your profile.',
      'Explore Food4Love.',
      'Share your feedback and help us improve.',
      'should not be shared',
      "We're excited to have you with us!",
      'Bringing people together, one meal at a time.',
    ]) {
      assert.ok(flat.includes(phrase), `missing: ${phrase}`)
    }
  }
  assert.match(mail.html, /Hello Adaeze,/)
  assert.match(mail.html, />Accept Your Invitation</)
  assert.match(
    mail.html,
    /href="https:\/\/app\.example\.test\/invite\/accept#token=abc"/,
  )
  assert.match(mail.html, /24 November 2026/)
  assert.match(mail.html, /logo4food22\.png/) // the official logo asset
  assert.match(mail.html, /<meta name="viewport"/)
})

test('the invitation email escapes everything an admin typed', () => {
  const evil =
    '<script>alert(1)</script> "quoted" & <img src=x onerror=alert(2)>'
  const mail = sampleEmail({
    fullName: evil,
    personalMessage: evil,
    acceptUrl: 'https://x.test/?a="b"&c=<d>',
  })
  assert.doesNotMatch(mail.html, /<script/i)
  // (the layout legitimately has the brand logo <img>; what must not appear is anything injected)
  assert.doesNotMatch(mail.html, /<img src=x/i)
  assert.doesNotMatch(mail.html, /<img src=x onerror/i)
  assert.equal((mail.html.match(/<img /gi) ?? []).length, 1, 'only the logo')
  assert.match(mail.html, /&lt;script&gt;/)
  assert.doesNotMatch(mail.html, /href="https:\/\/x\.test\/\?a="b"/)
})

test('a line break in a name or note cannot add header-like lines', () => {
  const mail = sampleEmail({
    fullName: 'Ada\r\nBcc: x@y.z',
    personalMessage: 'hello\nBcc: x@y.z',
  })
  assert.doesNotMatch(mail.subject, /[\r\n]/)
  assert.ok(!mail.text.split('\n').some((line) => /^Bcc:/i.test(line)))
})

test('the email never contains a password, only the one secret link', () => {
  const mail = sampleEmail()
  assert.doesNotMatch(
    mail.text,
    /temporary password|your password is|password:/i,
  )
  const links = mail.text.match(/https?:\/\/\S+/g) ?? []
  assert.equal(links.filter((l) => l.includes('token=')).length, 1)
})

// ================================================================== 2. shipped SQL / sources
test('tester_invitations is server-only, final states are final, no raw secrets', () => {
  const sql = read('supabase-migration-tester-invitations.sql')
  assert.match(
    sql,
    /alter table public\.tester_invitations enable row level security/i,
  )
  assert.match(
    sql,
    /revoke all on public\.tester_invitations from anon, authenticated/i,
  )
  assert.doesNotMatch(
    sql,
    /create policy[^;]*tester_invitations/i,
    'no browser-facing policy',
  )
  assert.match(sql, /token_hash text not null unique/i)
  assert.doesNotMatch(sql, /\btoken text\b|raw_token|plain_token/i)
  assert.match(
    sql,
    /tester_invitations_one_pending_per_email[\s\S]*where status = 'pending'/i,
  )
  assert.match(sql, /constraint tester_invitations_role_matches_access/i)
  assert.match(
    sql,
    /old\.status in \('accepted', 'revoked'\) and new\.status is distinct from old\.status/i,
  )
  assert.match(
    sql,
    /admin_lookup_auth_user[\s\S]*revoke all on function public\.admin_lookup_auth_user\(text\) from public, anon, authenticated/i,
  )
  assert.match(
    sql,
    /grant execute on function public\.admin_lookup_auth_user\(text\) to service_role/i,
  )
  // the access type is never stored on profiles (publicly readable) and never an admin role
  assert.doesNotMatch(sql, /alter table public\.profiles/i)
})

test('the SQL access types match the TypeScript list', () => {
  const sql = read('supabase-migration-tester-invitations.sql')
  const listed = [...sql.matchAll(/access_type in \(([^)]*)\)/g)].flatMap((m) =>
    [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]),
  )
  for (const key of rules.ACCESS_TYPES.map((t) => t.key))
    assert.ok(listed.includes(key), key)
  for (const key of new Set(listed))
    assert.ok(rules.isAccessType(key), `${key} is in SQL but not in TS`)
})

test('the list query never selects the secret hash', () => {
  assert.doesNotMatch(server.INVITATION_COLUMNS, /token/)
  const src =
    read('src/lib/invitations/server.ts') +
    read('src/lib/invitations/accept.ts')
  const selects = [...src.matchAll(/\.select\(\s*([A-Z_]+|'[^']*')/g)].map(
    (m) => m[1],
  )
  for (const s of selects) assert.doesNotMatch(s, /token_hash/, s)
})

test('admin invitation routes need users:manage, same-origin, and are never public', () => {
  for (const file of [
    'src/app/api/admin/invitations/route.ts',
    'src/app/api/admin/invitations/[id]/route.ts',
  ]) {
    const src = read(file)
    assert.match(src, /getAdminUser\('users:manage'\)/, file)
    assert.match(src, /status: 403/, file)
  }
  for (const file of [
    'src/app/api/admin/invitations/route.ts',
    'src/app/api/admin/invitations/[id]/route.ts',
  ]) {
    assert.match(
      read(file),
      /headers\.get\('origin'\) !== request\.nextUrl\.origin/,
      file,
    )
  }
  const layout = read('src/app/admin/users/layout.tsx')
  assert.match(layout, /getAdminUser\('users:manage'\)/)
})

test('public invitation routes: same-origin only, no caching, no secret logging', () => {
  for (const file of [
    'src/app/api/invitations/validate/route.ts',
    'src/app/api/invitations/accept/route.ts',
  ]) {
    const src = read(file)
    assert.match(
      src,
      /headers\.get\('origin'\) !== request\.nextUrl\.origin/,
      file,
    )
    assert.match(src, /Cache-Control': 'no-store'/, file)
    assert.doesNotMatch(src, /console\.(log|info|warn|error)/, file)
  }
})

test('nothing logs invitation secrets or passwords; no service key reaches the browser', () => {
  const walk = (dir, out = []) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full, out)
      else if (/\.(ts|tsx)$/.test(name)) out.push(full)
    }
    return out
  }
  for (const file of [
    ...walk(join(root, 'src/lib/invitations')),
    ...walk(join(root, 'src/app/api/invitations')),
    ...walk(join(root, 'src/app/api/admin/invitations')),
  ]) {
    const src = readFileSync(file, 'utf8')
    assert.doesNotMatch(src, /console\.(log|info|debug)\(/, file)
    assert.doesNotMatch(src, /NEXT_PUBLIC_[A-Z_]*(SERVICE|SECRET)/, file)
  }
  for (const file of [
    'src/app/(auth)/invite/accept/page.tsx',
    'src/app/admin/users/invite/page.tsx',
  ]) {
    assert.doesNotMatch(
      read(file),
      /SERVICE_ROLE|service_role|createAdminClient/,
      file,
    )
  }
})

test('the old Supabase-email invite path is gone, so no duplicate invitation email', () => {
  const walk = (dir, out = []) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full, out)
      else if (/\.(ts|tsx)$/.test(name)) out.push(full)
    }
    return out
  }
  for (const file of walk(join(root, 'src'))) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /inviteUserByEmail/, file)
  }
  const retired = read('src/app/api/admin/users/route.ts')
  assert.match(retired, /status: 410/)
  // the code (not the comment that explains the retirement) no longer says it
  assert.doesNotMatch(
    retired.replace(/^\s*\/\/.*$/gm, ''),
    /may already be registered/,
  )
  // generateLink builds the invitation without sending Supabase's own email
  assert.match(
    read('src/lib/invitations/server.ts'),
    /generateLink\(\{\s*type: 'invite'/,
  )
})

test('acceptance sets the password through Supabase Auth, never touching admin roles', () => {
  const full = read('src/lib/invitations/accept.ts')
  // judge the code, not the comments that explain what it must never do
  const src = full.replace(/^\s*\/\/.*$/gm, '')
  assert.match(src, /verifyOtp\(/)
  assert.match(src, /session\.auth\.updateUser\(\{ password \}\)/)
  assert.doesNotMatch(
    src,
    /createUser\(/,
    'no admin-created account with a chosen password',
  )
  assert.doesNotMatch(src, /admin_permissions/)
  const block = src.match(/app_metadata: \{([^}]*)\}/)?.[1] ?? ''
  assert.match(block, /tester_invitation|tester_type/)
  assert.doesNotMatch(
    block,
    /\brole\b\s*:/,
    'never writes app_metadata.role (that decides admin access)',
  )
})

test('the admin navigation has User management -> Invite testers behind users:manage', () => {
  const nav = read('src/components/admin/AdminNavigation.tsx')
  assert.match(nav, /label: 'User management'/)
  assert.match(
    nav,
    /href: '\/admin\/users\/invite',\s*label: 'Invite testers',\s*icon: UserPlus,\s*permission: 'users:manage'/,
  )
})

// ================================================================== 3. behaviour
const ADMIN_ID = '00000000-0000-4000-8000-000000000001'
const APP = 'https://app.example.test'

function setup(resendMode = 'ok') {
  const db = new FakeSupabase(productionLikeConfig())
  globalThis.__f4lFakeAdmin = db
  globalThis.__f4lAuditDown = false
  ;(globalThis.__f4lAudit ?? []).length = 0
  const mail = installResend(resendMode)
  db.rpcHandlers.admin_lookup_auth_user = ({ p_email }) => {
    const user = db.auth.admin.users.find((u) => u.email === p_email)
    return user
      ? [
          {
            id: user.id,
            confirmed: !!user.email_confirmed_at,
            signed_in_before: !!user.last_sign_in_at,
            has_profile: db.rows('profiles').some((p) => p.id === user.id),
          },
        ]
      : []
  }
  return { db, mail }
}

const invite = (over = {}) => ({
  full_name: 'Adaeze Okonkwo',
  email: 'adaeze@example.com',
  preferred_username: null,
  access_type: 'beta_tester',
  personal_message: null,
  ...over,
})
const create = (db, over) =>
  server.createInvitation(db, {
    value: invite(over),
    actorId: ADMIN_ID,
    appUrl: APP,
  })
const tokenFrom = (mail, index = mail.requests.length - 1) =>
  mail.requests[index].text.match(/#token=([A-Za-z0-9_-]{43})/)[1]
const audit = () => globalThis.__f4lAudit
const PASSWORD = 'Tomato-stew-2026'

test('create: saves the invitation, creates one Supabase invitation, sends ONE branded email', async () => {
  const { db, mail } = setup()
  const result = await create(db, { personal_message: 'Thanks!' })
  assert.equal(result.kind, 'created')
  assert.equal(result.delivery, 'accepted')

  const [row] = db.rows('tester_invitations')
  assert.equal(row.status, 'pending')
  assert.equal(row.send_count, 1)
  assert.equal(row.access_type, 'beta_tester')
  assert.equal(row.profile_role, 'buyer')
  assert.equal(row.invited_by, ADMIN_ID)
  assert.match(row.token_hash, /^[0-9a-f]{64}$/)

  // exactly one account, created by the invitation, with a matching profile (the signup trigger)
  assert.equal(db.auth.admin.users.length, 1)
  assert.equal(row.auth_user_id, db.auth.admin.users[0].id)
  assert.deepEqual(db.auth.admin.calls, [
    { type: 'invite', email: 'adaeze@example.com' },
  ])
  assert.equal(db.rows('profiles')[0].role, 'buyer')

  // exactly one email, to the right person, with the secret whose hash is what is stored
  assert.equal(mail.requests.length, 1)
  assert.deepEqual(mail.requests[0].to, ['adaeze@example.com'])
  assert.equal(
    mail.requests[0].subject,
    "You're invited! Get early access to Food4Love ❤️",
  )
  assert.match(mail.requests[0].text, /Thanks!/)
  const secret = tokenFrom(mail)
  assert.equal(tokens.hashInviteToken(secret), row.token_hash)
  assert.ok(mail.requests[0].text.includes(`${APP}/invite/accept#token=`))
  assert.ok(
    !JSON.stringify(result).includes(secret),
    'the response never carries the secret',
  )
  assert.ok(!('token_hash' in result.invitation), 'nor its hash')

  // the secret is only in the email: not in any table
  const everything = JSON.stringify([...db.tables.values()])
  assert.ok(!everything.includes(secret))

  assert.equal(audit().length, 1)
  assert.equal(audit()[0].action, 'tester.invite')
  assert.equal(audit()[0].outcome, 'succeeded')
  // delivery is tracked, and "accepted" is not "delivered"
  assert.equal(db.rows('email_deliveries')[0].status, 'accepted')
  assert.equal(db.rows('email_deliveries')[0].recipient_key, `${row.id}:1`)
})

test('create: a second invitation for the same address is refused and sends nothing', async () => {
  const { db, mail } = setup()
  await create(db)
  const again = await create(db)
  assert.equal(again.kind, 'blocked')
  assert.equal(again.code, 'pending_invitation')
  assert.equal(db.rows('tester_invitations').length, 1)
  assert.equal(mail.requests.length, 1)
  assert.equal(db.auth.admin.users.length, 1)
})

test('create: two simultaneous invitations for one address produce one row and one email', async () => {
  const { db, mail } = setup()
  const results = await Promise.all([create(db), create(db)])
  assert.equal(results.filter((r) => r.kind === 'created').length, 1)
  assert.equal(db.rows('tester_invitations').length, 1)
  assert.equal(db.auth.admin.users.length, 1)
  assert.equal(
    new Set(mail.requests.map((r) => r.key)).size,
    mail.requests.length,
  )
  assert.equal(mail.messages.size, 1)
})

test('create: an existing real account is protected: no invitation, no email, no reset', async () => {
  const { db, mail } = setup()
  const user = db.auth.admin._create({
    email: 'adaeze@example.com',
    data: { full_name: 'Adaeze', role: 'cook' },
  })
  user.email_confirmed_at = '2026-01-01T00:00:00.000Z'
  user.has_password = true
  const result = await create(db)
  assert.equal(result.kind, 'blocked')
  assert.equal(result.code, 'existing_account')
  assert.equal(db.rows('tester_invitations').length, 0)
  assert.equal(mail.requests.length, 0)
  assert.equal(
    db.auth.admin.calls.length,
    0,
    'Supabase Auth is not even asked to touch it',
  )
  assert.equal(user.has_password, true)
  assert.equal(db.rows('profiles')[0].role, 'cook', 'their access is unchanged')
})

test('create: a leftover unused account is reused instead of creating a second one', async () => {
  const { db } = setup()
  const ghost = db.auth.admin._create({
    email: 'adaeze@example.com',
    data: { full_name: 'Old Name', role: 'cook' },
  })
  const result = await create(db)
  assert.equal(result.kind, 'created')
  assert.equal(db.auth.admin.users.length, 1)
  assert.equal(result.invitation.auth_user_id, ghost.id)
  assert.match(result.note, /left over/)
})

test('create: a username already used by another invitation is refused', async () => {
  const { db } = setup()
  await create(db, { preferred_username: 'chef_ada' })
  const clash = await create(db, {
    email: 'other@example.com',
    preferred_username: 'chef_ada',
  })
  assert.equal(clash.kind, 'blocked')
  assert.equal(clash.code, 'username_taken')
  assert.equal(db.rows('tester_invitations').length, 1)
})

test('create: the database, not just the form, keeps a cook type from becoming a buyer', async () => {
  const { db } = setup()
  const result = await create(db, { access_type: 'chef_tester' })
  assert.equal(result.invitation.profile_role, 'cook')
  assert.equal(db.rows('profiles')[0].role, 'cook')
  const direct = db.from('tester_invitations').insert({
    email: 'x@example.com',
    access_type: 'beta_tester',
    profile_role: 'cook',
    token_hash: 'h',
  })
  assert.equal((await direct).error.code, '23514')
})

test('create: each real Supabase failure is reported as itself, not as "already registered"', async () => {
  const causes = [
    [
      { code: 'over_email_send_rate_limit', status: 429, message: 'rate' },
      'email_rate_limited',
      /rate-limiting/,
    ],
    [
      { status: 500, message: 'Database error saving new user' },
      'profile_trigger_failed',
      /signup trigger/,
    ],
    [
      { status: 500, message: 'Error sending invite email' },
      'email_send_failed',
      /SMTP/,
    ],
    [
      { code: 'signup_disabled', status: 422, message: 'x' },
      'signups_disabled',
      /disabled/,
    ],
  ]
  for (const [error, code, text] of causes) {
    const { db, mail } = setup()
    db.auth.admin.failNext = error
    const result = await create(db)
    assert.equal(result.kind, 'failed', code)
    assert.equal(result.code, code)
    assert.match(result.message, text)
    assert.doesNotMatch(result.message, /already/i)
    assert.equal(
      mail.requests.length,
      0,
      'nothing is emailed when the invitation could not be made',
    )
    assert.equal(db.rows('tester_invitations')[0].status, 'failed')
    assert.equal(
      db.rows('tester_invitations')[0].failure_reason,
      `auth:${code}`,
    )
    assert.equal(audit()[0].outcome, 'failed')
  }
})

test('create: a failed attempt can simply be retried and does not duplicate anything', async () => {
  const { db, mail } = setup()
  db.auth.admin.failNext = {
    code: 'over_email_send_rate_limit',
    status: 429,
    message: 'x',
  }
  assert.equal((await create(db)).kind, 'failed')
  const retry = await create(db)
  assert.equal(retry.kind, 'created')
  assert.equal(
    db.rows('tester_invitations').length,
    1,
    'the failed row is continued, not duplicated',
  )
  assert.equal(db.rows('tester_invitations')[0].send_count, 2)
  assert.equal(mail.messages.size, 1)
  assert.equal(db.auth.admin.users.length, 1)
})

test('create: if the email provider fails the invitation is kept and can be resent without a second account', async () => {
  const { db, mail } = setup('fail')
  const result = await create(db)
  assert.equal(result.kind, 'created')
  assert.equal(result.delivery, 'failed')
  let row = db.rows('tester_invitations')[0]
  assert.equal(row.status, 'failed')
  assert.equal(row.failure_reason, 'email_not_sent')
  assert.equal(db.rows('email_deliveries')[0].status, 'failed')
  assert.equal(mail.messages.size, 0)
  const firstSecret = tokenFrom(mail, 0)

  mail.mode = 'ok'
  const resent = await server.resendInvitation(db, {
    id: row.id,
    actorId: ADMIN_ID,
    appUrl: APP,
  })
  assert.equal(resent.kind, 'ok')
  assert.equal(resent.delivery, 'accepted')
  row = db.rows('tester_invitations')[0]
  assert.equal(row.status, 'pending')
  assert.equal(row.send_count, 2)
  assert.equal(db.auth.admin.users.length, 1, 'still one Auth account')
  assert.equal(mail.messages.size, 1)
  assert.equal(
    db.rows('email_deliveries').length,
    2,
    'each send is tracked on its own',
  )

  // the first (never delivered) link is dead, the new one works
  assert.deepEqual(await accept.checkInvitationToken(db, firstSecret), {
    ok: false,
    reason: 'invalid',
  })
  assert.equal(
    (await accept.checkInvitationToken(db, tokenFrom(mail))).ok,
    true,
  )
})

test('create: email that is not configured is reported honestly and nothing is claimed as sent', async () => {
  const { db, mail } = setup()
  delete process.env.RESEND_API_KEY
  const result = await create(db)
  assert.equal(result.kind, 'created')
  assert.equal(result.delivery, 'not_configured')
  assert.equal(db.rows('tester_invitations')[0].status, 'failed')
  assert.equal(
    db.rows('tester_invitations')[0].failure_reason,
    'email_not_configured',
  )
  assert.equal(mail.requests.length, 0)
})

test('create: with the delivery table missing the email still goes out (just untracked)', async () => {
  const { db, mail } = setup()
  // an older database whose email_deliveries does not know the new kind
  db.config.email_deliveries.check = (r) =>
    r.kind === 'tester_invitation'
      ? 'violates check constraint "email_deliveries_kind_check"'
      : null
  const result = await create(db)
  assert.equal(result.delivery, 'accepted')
  assert.equal(mail.messages.size, 1)
  assert.equal(db.rows('email_deliveries').length, 0)
})

test('create: if auditing is unavailable nothing is sent', async () => {
  const { db, mail } = setup()
  globalThis.__f4lAuditDown = true
  const result = await create(db)
  assert.equal(result.kind, 'failed')
  assert.equal(result.code, 'audit_unavailable')
  assert.equal(mail.requests.length, 0)
  assert.equal(db.auth.admin.users.length, 0, 'no account was created either')
  assert.equal(db.rows('tester_invitations')[0].status, 'failed')
})

test('resend: two simultaneous presses cannot send a link that is already dead', async () => {
  const { db, mail } = setup()
  await create(db)
  const id = db.rows('tester_invitations')[0].id
  mail.requests.length = 0

  const results = await Promise.all([
    server.resendInvitation(db, { id, actorId: ADMIN_ID, appUrl: APP }),
    server.resendInvitation(db, { id, actorId: ADMIN_ID, appUrl: APP }),
  ])
  assert.equal(
    results.filter((r) => r.kind === 'ok').length,
    1,
    'exactly one press wins',
  )
  assert.equal(results.filter((r) => r.kind === 'blocked').length, 1)
  assert.equal(mail.requests.length, 1, 'one email')
  // and the secret in THAT email is the one the database now holds
  const sent = tokenFrom(mail)
  assert.equal((await accept.checkInvitationToken(db, sent)).ok, true)
})

test('resend: replaces the link, extends the expiry, and refuses accepted or revoked invitations', async () => {
  const { db, mail } = setup()
  await create(db)
  const id = db.rows('tester_invitations')[0].id
  const old = tokenFrom(mail)
  const result = await server.resendInvitation(db, {
    id,
    actorId: ADMIN_ID,
    appUrl: APP,
  })
  assert.equal(result.kind, 'ok')
  assert.equal(
    (await accept.checkInvitationToken(db, old)).ok,
    false,
    'the previous link stopped working',
  )
  assert.equal(
    (await accept.checkInvitationToken(db, tokenFrom(mail))).ok,
    true,
  )
  assert.equal(audit().filter((a) => a.action === 'tester.resend').length, 1)

  db.rows('tester_invitations')[0].status = 'accepted'
  const blocked = await server.resendInvitation(db, {
    id,
    actorId: ADMIN_ID,
    appUrl: APP,
  })
  assert.equal(blocked.kind, 'blocked')
  assert.equal(blocked.code, 'not_resendable')
  assert.equal(
    (
      await server.resendInvitation(db, {
        id: 'missing',
        actorId: ADMIN_ID,
        appUrl: APP,
      })
    ).kind,
    'not_found',
  )
})

test('resend: an expired invitation can be re-issued', async () => {
  const { db, mail } = setup()
  await create(db)
  const row = db.rows('tester_invitations')[0]
  row.expires_at = new Date(Date.now() - 1000).toISOString()
  assert.equal(
    (await accept.checkInvitationToken(db, tokenFrom(mail))).reason,
    'expired',
  )
  const result = await server.resendInvitation(db, {
    id: row.id,
    actorId: ADMIN_ID,
    appUrl: APP,
  })
  assert.equal(result.kind, 'ok')
  assert.equal(db.rows('tester_invitations')[0].status, 'pending')
  assert.equal(
    (await accept.checkInvitationToken(db, tokenFrom(mail))).ok,
    true,
  )
})

test('revoke: the emailed link stops working on the server, and an unused invited account is removed', async () => {
  const { db, mail } = setup()
  await create(db)
  const row = db.rows('tester_invitations')[0]
  const secret = tokenFrom(mail)
  assert.equal((await accept.checkInvitationToken(db, secret)).ok, true)

  const result = await server.revokeInvitation(db, {
    id: row.id,
    actorId: ADMIN_ID,
  })
  assert.equal(result.kind, 'ok')
  assert.deepEqual(await accept.checkInvitationToken(db, secret), {
    ok: false,
    reason: 'revoked',
  })
  assert.equal(db.rows('tester_invitations')[0].status, 'revoked')
  assert.equal(
    db.auth.admin.users.length,
    0,
    'the never-used account is gone, so "forgot password" cannot be used to get in',
  )
  assert.equal(db.rows('profiles').length, 0)
  assert.equal(audit().filter((a) => a.action === 'tester.revoke').length, 1)

  // final: not revocable again, not resendable, and the database refuses to revive it
  assert.equal(
    (await server.revokeInvitation(db, { id: row.id, actorId: ADMIN_ID })).code,
    'not_revocable',
  )
  assert.equal(
    (
      await server.resendInvitation(db, {
        id: row.id,
        actorId: ADMIN_ID,
        appUrl: APP,
      })
    ).code,
    'not_resendable',
  )
  const revive = await db
    .from('tester_invitations')
    .update({ status: 'pending' })
    .eq('id', row.id)
  assert.equal(revive.error.code, '23514')
})

test('revoke: never deletes an account that was actually used', async () => {
  const { db } = setup()
  await create(db)
  const row = db.rows('tester_invitations')[0]
  db.auth.admin.users[0].email_confirmed_at = '2026-11-01T00:00:00.000Z'
  const result = await server.revokeInvitation(db, {
    id: row.id,
    actorId: ADMIN_ID,
  })
  assert.equal(result.kind, 'ok')
  assert.equal(db.auth.admin.users.length, 1)
  assert.equal(db.rows('profiles').length, 1)
})

test('revoke: refused while the recipient is completing the invitation', async () => {
  const { db } = setup()
  await create(db)
  const row = db.rows('tester_invitations')[0]
  row.claimed_at = new Date().toISOString()
  const result = await server.revokeInvitation(db, {
    id: row.id,
    actorId: ADMIN_ID,
  })
  assert.equal(result.kind, 'blocked')
  assert.equal(result.code, 'in_progress')
  assert.equal(db.rows('tester_invitations')[0].status, 'pending')
})

test('resend: an admin pressing it at the instant the recipient starts completing cannot pull the link away', async () => {
  const { db, mail } = setup()
  await create(db)
  const row = db.rows('tester_invitations')[0]
  const oldToken = tokenFrom(mail)
  mail.requests.length = 0

  // The recipient's claim lands AFTER resend's "is anyone completing it?" check and BEFORE its
  // update, which is the only moment the check alone cannot protect.
  const from = db.from.bind(db)
  db.from = (table) => {
    const query = from(table)
    if (table === 'tester_invitations') {
      const update = query.update.bind(query)
      query.update = (payload) => {
        if (payload && 'token_hash' in payload && !row.claimed_at)
          row.claimed_at = new Date().toISOString()
        return update(payload)
      }
    }
    return query
  }
  const result = await server.resendInvitation(db, {
    id: row.id,
    actorId: ADMIN_ID,
    appUrl: APP,
  })
  db.from = from

  assert.equal(result.kind, 'blocked')
  assert.equal(result.code, 'changed_meanwhile')
  assert.equal(mail.requests.length, 0, 'no new email went out')
  assert.ok(row.claimed_at, "the recipient's claim was not cleared")
  assert.equal(
    (await accept.checkInvitationToken(db, oldToken)).ok,
    true,
    'the link they are using still works',
  )
})

test('list: effective status, delivery state and no secrets', async () => {
  const { db } = setup()
  await create(db)
  await create(db, { email: 'two@example.com' })
  db.rows('tester_invitations')[1].expires_at = new Date(
    Date.now() - 1000,
  ).toISOString()
  db.rows('profiles').push({ id: ADMIN_ID, full_name: 'Tunchi Admin' })

  const result = await server.listInvitations(db, { page: 1, pageSize: 25 })
  assert.equal(result.total, 2)
  const byEmail = Object.fromEntries(
    result.invitations.map((i) => [i.email, i]),
  )
  assert.equal(byEmail['adaeze@example.com'].status, 'pending')
  assert.equal(byEmail['two@example.com'].status, 'expired')
  assert.equal(byEmail['adaeze@example.com'].email_delivery.status, 'accepted')
  assert.equal(byEmail['adaeze@example.com'].invited_by_name, 'Tunchi Admin')
  for (const invitation of result.invitations) {
    assert.ok(!('token_hash' in invitation))
  }
  const onlyExpired = await server.listInvitations(db, {
    status: 'expired',
    page: 1,
    pageSize: 25,
  })
  assert.equal(onlyExpired.invitations.length, 1)
})

// ---- accepting
async function invited(over) {
  const ctx = setup()
  await create(ctx.db, over)
  ctx.secret = tokenFrom(ctx.mail)
  ctx.session = fakeSession(ctx.db)
  ctx.accept = (overrides = {}) =>
    accept.completeInvitation({
      admin: ctx.db,
      session: ctx.session,
      rawToken: ctx.secret,
      password: PASSWORD,
      ...overrides,
    })
  return ctx
}

test('accept: the full flow signs them in with THEIR password and a non-privileged tester type', async () => {
  const {
    db,
    session,
    accept: run,
    secret,
  } = await invited({ access_type: 'cook_tester' })
  const result = await run()
  assert.deepEqual(result, { kind: 'ok', redirectTo: '/onboarding/setup' })

  const user = db.auth.admin.users[0]
  assert.equal(session.user.id, user.id, 'signed in')
  assert.ok(user.email_confirmed_at)
  assert.equal(user.has_password, true)
  assert.deepEqual(user.app_metadata, {
    provider: 'email',
    tester_type: 'cook_tester',
    invitation_id: db.rows('tester_invitations')[0].id,
  })
  assert.equal(user.app_metadata.role, undefined, 'no admin role')
  assert.equal(user.app_metadata.admin_permissions, undefined)

  const profile = db.rows('profiles')[0]
  assert.equal(profile.role, 'cook')
  assert.equal(
    profile.kyc_status,
    'unverified',
    'a cook tester is NOT verified',
  )
  assert.equal(profile.suspended, false)

  const row = db.rows('tester_invitations')[0]
  assert.equal(row.status, 'accepted')
  assert.equal(row.claimed_at, null)
  assert.ok(row.accepted_at)
  assert.equal(
    audit().filter(
      (a) => a.action === 'tester.accept' && a.outcome === 'succeeded',
    ).length,
    1,
  )

  // the password and the secret exist nowhere in the data
  const everything =
    JSON.stringify([...db.tables.values()]) + JSON.stringify(audit())
  assert.ok(!everything.includes(PASSWORD))
  assert.ok(!everything.includes(secret))
})

test('accept: a link works once', async () => {
  const { accept: run, db } = await invited()
  assert.equal((await run()).kind, 'ok')
  const again = await run({ session: fakeSession(db) })
  assert.deepEqual(again, { kind: 'token', reason: 'used' })
})

test('accept: revoked, expired, unknown and malformed links all fail safely', async () => {
  let ctx = await invited()
  await server.revokeInvitation(ctx.db, {
    id: ctx.db.rows('tester_invitations')[0].id,
    actorId: ADMIN_ID,
  })
  assert.deepEqual(await ctx.accept(), { kind: 'token', reason: 'revoked' })
  assert.equal(ctx.session.user, null)

  ctx = await invited()
  ctx.db.rows('tester_invitations')[0].expires_at = new Date(
    Date.now() - 1000,
  ).toISOString()
  assert.deepEqual(await ctx.accept(), { kind: 'token', reason: 'expired' })
  assert.equal(
    ctx.db.auth.admin.users[0].email_confirmed_at,
    null,
    'nothing was confirmed',
  )
  assert.equal(ctx.session.user, null)

  ctx = await invited()
  assert.deepEqual(
    await ctx.accept({ rawToken: tokens.generateInviteToken() }),
    { kind: 'token', reason: 'invalid' },
  )
  assert.deepEqual(await ctx.accept({ rawToken: 'nope' }), {
    kind: 'token',
    reason: 'invalid',
  })
  assert.deepEqual(await ctx.accept({ rawToken: undefined }), {
    kind: 'token',
    reason: 'invalid',
  })
})

test('accept: a weak password is refused before anything happens and can be retried', async () => {
  const { db, accept: run, session } = await invited()
  for (const password of [
    'short1',
    'allletterspassword',
    12345678901,
    undefined,
    'adaeze-password-1',
  ]) {
    const r = await run({ password })
    assert.equal(r.kind, 'weak_password', String(password))
  }
  assert.equal(session.user, null)
  assert.equal(db.auth.admin.users[0].email_confirmed_at, null)
  assert.equal(
    db.rows('tester_invitations')[0].claimed_at,
    null,
    'no claim left behind',
  )
  assert.equal(
    (await run()).kind,
    'ok',
    'the same link still works with a good password',
  )
})

test('accept: Supabase rejecting the password releases the claim and signs them out', async () => {
  const { db, accept: run, session } = await invited()
  // meets Food4Love's rules, but the fake Supabase rejects anything under 8 characters only;
  // force a rejection to prove the failure path
  const original = session.auth.updateUser
  session.auth.updateUser = async () => ({
    data: null,
    error: { code: 'weak_password', message: 'x' },
  })
  const r = await run()
  assert.equal(r.kind, 'weak_password')
  assert.equal(session.user, null, 'signed out again')
  assert.equal(db.rows('tester_invitations')[0].status, 'pending')
  assert.equal(db.rows('tester_invitations')[0].claimed_at, null)
  session.auth.updateUser = original
})

test('accept: a double submit completes the invitation once', async () => {
  const ctx = await invited()
  const [a, b] = await Promise.all([
    ctx.accept({ session: fakeSession(ctx.db) }),
    ctx.accept({ session: fakeSession(ctx.db) }),
  ])
  const kinds = [a.kind, b.kind].sort()
  assert.deepEqual(
    kinds.filter((k) => k === 'ok'),
    ['ok'],
  )
  assert.ok(['in_progress', 'token'].includes(kinds.find((k) => k !== 'ok')))
  assert.equal(ctx.db.rows('tester_invitations')[0].status, 'accepted')
  assert.equal(audit().filter((x) => x.action === 'tester.accept').length, 1)
  assert.equal(ctx.db.auth.admin.users.length, 1)
})

test('accept: a link for a different account is refused (identity must match the invitation)', async () => {
  const ctx = await invited()
  ctx.db.rows('tester_invitations')[0].auth_user_id =
    '11111111-1111-4111-8111-111111111111'
  const r = await ctx.accept()
  assert.equal(r.kind, 'failed')
  assert.equal(ctx.session.user, null, 'never signed in')
  assert.equal(ctx.db.auth.admin.users[0].has_password, false)
  assert.equal(ctx.db.rows('tester_invitations')[0].claimed_at, null)
  assert.equal(ctx.db.rows('tester_invitations')[0].status, 'pending')
})

test('accept: someone who got part-way (confirmed, no password) can finish with the same link', async () => {
  const ctx = await invited()
  ctx.db.auth.admin.users[0].email_confirmed_at = '2026-11-02T00:00:00.000Z'
  const r = await ctx.accept()
  assert.equal(r.kind, 'ok')
  assert.deepEqual(
    ctx.db.auth.admin.calls.map((c) => c.type),
    ['invite', 'invite', 'magiclink'],
  )
  assert.equal(ctx.db.auth.admin.users[0].has_password, true)
})

test('accept: an account whose profile is missing or stale is completed to match the invitation', async () => {
  const ctx = await invited({ access_type: 'chef_tester' })
  // an earlier interrupted attempt left a buyer-shaped, un-onboarded profile
  const profile = ctx.db.rows('profiles')[0]
  profile.role = 'buyer'
  profile.full_name = 'Stale Name'
  await ctx.accept()
  assert.equal(profile.role, 'cook')
  assert.equal(profile.full_name, 'Adaeze Okonkwo')

  // and a missing profile row is created
  const other = await invited({ email: 'new@example.com' })
  other.db.rows('profiles').length = 0
  await other.accept()
  assert.equal(other.db.rows('profiles').length, 1)
  assert.equal(other.db.rows('profiles')[0].role, 'buyer')
})

test('accept: a completed profile is never overwritten, and verification is never touched', async () => {
  const ctx = await invited()
  const profile = ctx.db.rows('profiles')[0]
  profile.onboarding_complete = true
  profile.full_name = 'Chosen Name'
  profile.kyc_status = 'verified'
  await ctx.accept()
  assert.equal(profile.full_name, 'Chosen Name')
  assert.equal(profile.kyc_status, 'verified')
})

test('validate/accept answer "invalid" for unknown secrets without revealing which part was wrong', async () => {
  const ctx = setup()
  const unknown = tokens.generateInviteToken()
  assert.deepEqual(await accept.checkInvitationToken(ctx.db, unknown), {
    ok: false,
    reason: 'invalid',
  })
  assert.deepEqual(await accept.checkInvitationToken(ctx.db, ''), {
    ok: false,
    reason: 'invalid',
  })
})

test('an invited user can sign in normally afterwards and holds no admin privileges', async () => {
  const ctx = await invited()
  await ctx.accept()
  const user = ctx.db.auth.admin.users[0]
  // what the admin check (src/lib/admin/auth.ts) reads
  assert.notEqual(user.app_metadata?.role, 'admin')
  assert.ok(!Array.isArray(user.app_metadata?.admin_permissions))
  assert.equal(user.has_password, true)
  assert.ok(user.email_confirmed_at)
  assert.ok(existsSync(join(root, 'src/lib/admin/auth.ts')))
  assert.match(
    read('src/lib/admin/auth.ts'),
    /app_metadata\?\.role !== 'admin'/,
  )
})
