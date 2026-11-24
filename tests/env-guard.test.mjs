// Run with: npm test
//
// Safeguards that stop a LOCAL process from touching the production Supabase project, and the
// read-only staging preflight. No real service is contacted: keys are synthetic, the network is a
// recording fake, and the command-line scripts run in temporary folders with fabricated env files.

import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { register } from 'node:module'
import { fileURLToPath } from 'node:url'

import {
  PRODUCTION_OVERRIDE_VALUE,
  PRODUCTION_SUPABASE_REF,
  assessSupabaseEnv,
  assertSupabaseTargetAllowed,
  classifySupabaseTarget,
  keyProjectRef,
  mayUseProductionHere,
  namesToBlank,
  supabaseRefFromUrl,
} from '../src/lib/env/supabaseGuard.ts'
import {
  BASELINE_TABLES,
  MIGRATION_ORDER,
  runPreflight,
  tablesFromOpenApi,
} from '../scripts/lib/stagingPreflight.mjs'
import { parseEnvFile } from '../scripts/lib/envfile.mjs'

register('./helpers/alias-hooks.mjs', import.meta.url)

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
// Synthetic keys shaped like Supabase's: a JWT whose payload names its project. NOT real keys.
const jwt = (ref, role) =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', ref, role })}.not-a-real-signature`

const STAGING_REF = 'stagingprojectref12'
const OTHER_REF = 'someotherprojectref'
const urlFor = (ref) => `https://${ref}.supabase.co`
const stagingEnv = (over = {}) => ({
  NEXT_PUBLIC_SUPABASE_URL: urlFor(STAGING_REF),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt(STAGING_REF, 'anon'),
  SUPABASE_SERVICE_ROLE_KEY: jwt(STAGING_REF, 'service_role'),
  NEXT_PUBLIC_APP_URL: 'http://localhost:5001',
  ...over,
})
const productionEnv = (over = {}) => ({
  NEXT_PUBLIC_SUPABASE_URL: urlFor(PRODUCTION_SUPABASE_REF),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt(PRODUCTION_SUPABASE_REF, 'anon'),
  SUPABASE_SERVICE_ROLE_KEY: jwt(PRODUCTION_SUPABASE_REF, 'service_role'),
  ...over,
})

// ============================================================================== 1. the rules
test('a project reference is read only from a real Supabase address', () => {
  assert.equal(supabaseRefFromUrl(urlFor(STAGING_REF)), STAGING_REF)
  assert.equal(
    supabaseRefFromUrl(`${urlFor(STAGING_REF)}/rest/v1/`),
    STAGING_REF,
  )
  assert.equal(
    supabaseRefFromUrl(`https://${STAGING_REF.toUpperCase()}.SUPABASE.CO`),
    STAGING_REF,
  )
  for (const bad of [
    undefined,
    null,
    '',
    'not a url',
    'https://example.com',
    'http://localhost:5098',
    `https://${STAGING_REF}.supabase.co.evil.example`,
    `https://evil.example/${STAGING_REF}.supabase.co`,
    'https://short.supabase.co',
  ])
    assert.equal(supabaseRefFromUrl(bad), null, String(bad))
})

test('targets are classified: production, another project, local, or unknown', () => {
  assert.equal(
    classifySupabaseTarget(urlFor(PRODUCTION_SUPABASE_REF)),
    'production',
  )
  assert.equal(classifySupabaseTarget(urlFor(STAGING_REF)), 'other-supabase')
  assert.equal(classifySupabaseTarget('http://localhost:5098'), 'local')
  assert.equal(classifySupabaseTarget('http://127.0.0.1:54321'), 'local')
  assert.equal(
    classifySupabaseTarget('https://db.custom-domain.example'),
    'unknown',
  )
  assert.equal(classifySupabaseTarget(undefined), 'unknown')
  // a look-alike address can never be mistaken for production, or for staging
  assert.equal(
    classifySupabaseTarget(
      `https://${PRODUCTION_SUPABASE_REF}.supabase.co.evil.example`,
    ),
    'unknown',
  )
})

test('a key names its project; anything that is not a readable key names none', () => {
  assert.equal(keyProjectRef(jwt(STAGING_REF, 'anon')), STAGING_REF)
  for (const bad of [
    undefined,
    null,
    '',
    'sb_publishable_abcdef',
    'a.b',
    'a.b.c',
    'x.!!!.z',
    `x.${b64({ no: 'ref' })}.z`,
    `x.${b64({ ref: 42 })}.z`,
  ])
    assert.equal(keyProjectRef(bad), null, String(bad))
})

test('a local process may NOT use production unless the exact override words are given', () => {
  assert.equal(assessSupabaseEnv(productionEnv()).ok, false)
  assert.match(
    assessSupabaseEnv(productionEnv()).problems.join(' '),
    /PRODUCTION/,
  )
  for (const wrong of [
    '1',
    'true',
    'yes',
    'I_UNDERSTAND',
    'i_understand_this_uses_real_data',
    '',
  ])
    assert.equal(
      assessSupabaseEnv(productionEnv({ F4L_ALLOW_PRODUCTION_LOCAL: wrong }))
        .ok,
      false,
      wrong,
    )
  assert.equal(
    assessSupabaseEnv(
      productionEnv({ F4L_ALLOW_PRODUCTION_LOCAL: PRODUCTION_OVERRIDE_VALUE }),
    ).ok,
    true,
  )
  // the deployed app (Vercel sets VERCEL) is production by design
  assert.equal(assessSupabaseEnv(productionEnv({ VERCEL: '1' })).ok, true)
  assert.equal(mayUseProductionHere({}), false)
})

test('staging and local doubles are accepted; mixed-up keys are not', () => {
  assert.deepEqual(assessSupabaseEnv(stagingEnv()), {
    target: 'other-supabase',
    ref: STAGING_REF,
    ok: true,
    problems: [],
  })
  assert.equal(
    assessSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:5098',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'x',
      SUPABASE_SERVICE_ROLE_KEY: 'y',
    }).ok,
    true,
  )
  // a PRODUCTION key next to a STAGING address (the classic accident)
  const mixed = assessSupabaseEnv(
    stagingEnv({
      SUPABASE_SERVICE_ROLE_KEY: jwt(PRODUCTION_SUPABASE_REF, 'service_role'),
    }),
  )
  assert.equal(mixed.ok, false)
  assert.match(mixed.problems.join(' '), /different Supabase project/)
  assert.match(mixed.problems.join(' '), /PRODUCTION key/)
  // the reverse: a staging key next to the PRODUCTION address
  assert.equal(
    assessSupabaseEnv(
      productionEnv({
        SUPABASE_SERVICE_ROLE_KEY: jwt(STAGING_REF, 'service_role'),
        F4L_ALLOW_PRODUCTION_LOCAL: PRODUCTION_OVERRIDE_VALUE,
      }),
    ).ok,
    false,
  )
  assert.equal(
    assessSupabaseEnv(
      stagingEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt(OTHER_REF, 'anon') }),
    ).ok,
    false,
  )
  // missing and identical keys
  assert.equal(assessSupabaseEnv({}).ok, false)
  assert.equal(
    assessSupabaseEnv(
      stagingEnv({
        SUPABASE_SERVICE_ROLE_KEY: jwt(STAGING_REF, 'service_role_2'),
      }),
    ).ok,
    true,
    'same project, different value: fine',
  )
  const same = jwt(STAGING_REF, 'anon')
  assert.match(
    assessSupabaseEnv(
      stagingEnv({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: same,
        SUPABASE_SERVICE_ROLE_KEY: same,
      }),
    ).problems.join(' '),
    /identical/,
  )
  assert.equal(
    assessSupabaseEnv(stagingEnv({ SUPABASE_SERVICE_ROLE_KEY: '' }), {
      requireServiceKey: true,
    }).ok,
    false,
  )
})

test('no message ever contains a key or a secret', () => {
  const env = productionEnv({
    SUPABASE_SERVICE_ROLE_KEY: jwt(PRODUCTION_SUPABASE_REF, 'service_role'),
  })
  const text = JSON.stringify(assessSupabaseEnv(env))
  assert.ok(
    !text.includes(env.SUPABASE_SERVICE_ROLE_KEY) &&
      !text.includes(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  )
})

test('variables not defined for staging are blanked, so real keys cannot leak in', () => {
  const blanked = namesToBlank(
    [
      'RESEND_API_KEY',
      'PAYSTACK_SECRET_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'RESEND_API_KEY',
      '',
    ],
    new Set(['NEXT_PUBLIC_SUPABASE_URL']),
  )
  assert.deepEqual(blanked.sort(), ['PAYSTACK_SECRET_KEY', 'RESEND_API_KEY'])
})

// ============================================================================== 2. the server-side guard
const adminModule = await import('../src/lib/supabase/admin.ts') // the REAL module (the tests' stub only replaces the "@/..." path)

async function withEnv(values, fn) {
  const names = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'VERCEL',
    'F4L_ALLOW_PRODUCTION_LOCAL',
  ]
  const before = Object.fromEntries(names.map((n) => [n, process.env[n]]))
  for (const n of names) delete process.env[n]
  Object.assign(process.env, values)
  try {
    return await fn()
  } finally {
    for (const n of names) {
      if (before[n] === undefined) delete process.env[n]
      else process.env[n] = before[n]
    }
  }
}

test('the service-role client refuses production from a local process, and mismatched keys anywhere', async () => {
  await withEnv(productionEnv(), () => {
    assert.throws(
      () => adminModule.createAdminClient(),
      /Refusing to use the production Supabase project from a local process/,
    )
  })
  await withEnv(
    stagingEnv({
      SUPABASE_SERVICE_ROLE_KEY: jwt(PRODUCTION_SUPABASE_REF, 'service_role'),
    }),
    () => {
      assert.throws(
        () => adminModule.createAdminClient(),
        /does not match the project/,
      )
    },
  )
  // allowed: staging, the deployed app, and an explicit override
  await withEnv(stagingEnv(), () => assert.ok(adminModule.createAdminClient()))
  await withEnv(productionEnv({ VERCEL: '1' }), () =>
    assert.ok(adminModule.createAdminClient()),
  )
  await withEnv(
    productionEnv({ F4L_ALLOW_PRODUCTION_LOCAL: PRODUCTION_OVERRIDE_VALUE }),
    () => assert.ok(adminModule.createAdminClient()),
  )
  // and the old behaviour for missing credentials is unchanged
  await withEnv({}, () =>
    assert.throws(() => adminModule.createAdminClient(), /not configured/),
  )
})

test('the guard is wired into the only place a service-role client is built', () => {
  const src = read('src/lib/supabase/admin.ts')
  assert.match(src, /assertSupabaseTargetAllowed\(process\.env\)/)
  assert.ok(
    src.indexOf('assertSupabaseTargetAllowed') <
      src.indexOf('return createClient('),
    'checked before the client exists',
  )
  const builders = []
  const walk = (dir) => {
    for (const entry of readdirSyncSafe(dir)) {
      const path = join(dir, entry)
      if (statSyncSafe(path)?.isDirectory()) walk(path)
      else if (
        /\.(ts|tsx)$/.test(entry) &&
        /^import \{[^}]*createClient[^}]*\} from '@supabase\/supabase-js'/m.test(
          readFileSync(path, 'utf8'),
        )
      )
        builders.push(path.slice(root.length + 1).replace(/\\/g, '/'))
    }
  }
  walk(join(root, 'src'))
  assert.deepEqual(
    builders,
    ['src/lib/supabase/admin.ts'],
    'only admin.ts creates a client from supabase-js with a key (everything else uses the cookie-bound clients)',
  )
})

import { readdirSync, statSync } from 'node:fs'
const readdirSyncSafe = (d) => {
  try {
    return readdirSync(d)
  } catch {
    return []
  }
}
const statSyncSafe = (p) => {
  try {
    return statSync(p)
  } catch {
    return null
  }
}

// ============================================================================== 3. the staging preflight
function openApi(tables, functions = []) {
  return {
    paths: Object.fromEntries([
      ...tables.map((t) => [`/${t}`, {}]),
      ...functions.map((f) => [`/rpc/${f}`, {}]),
    ]),
  }
}
function fakeFetch({
  tables = BASELINE_TABLES,
  functions = [],
  healthStatus = 200,
  restStatus = 200,
  users = '3',
  throwOn = null,
} = {}) {
  const calls = []
  const fetchFn = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET' })
    if (throwOn && url.includes(throwOn)) throw new Error('network')
    const respond = (status, body, headers = {}) => ({
      ok: status < 300,
      status,
      headers: { get: (n) => headers[n.toLowerCase()] ?? null },
      json: async () => body,
    })
    if (url.endsWith('/auth/v1/health')) return respond(healthStatus, {})
    if (url.endsWith('/rest/v1/'))
      return respond(restStatus, openApi(tables, functions))
    if (url.includes('/auth/v1/admin/users'))
      return respond(200, { users: [] }, { 'x-total-count': users })
    return respond(404, {})
  }
  return { fetchFn, calls }
}
const names = (result, status) =>
  result.checks.filter((c) => c.status === status).map((c) => c.name)

test('preflight: production is refused before ANY request is made', async () => {
  const { fetchFn, calls } = fakeFetch()
  const result = await runPreflight(productionEnv(), fetchFn)
  assert.equal(result.ok, false)
  assert.deepEqual(names(result, 'fail'), ['target is not production'])
  assert.equal(calls.length, 0, 'nothing was contacted')
})

test('preflight: mixed-up keys, a live payment key and the live site address all stop it before any request', async () => {
  for (const env of [
    stagingEnv({
      SUPABASE_SERVICE_ROLE_KEY: jwt(PRODUCTION_SUPABASE_REF, 'service_role'),
    }),
    stagingEnv({ PAYSTACK_SECRET_KEY: ['sk', 'live', 'dummy'].join('_') }),
    stagingEnv({ NEXT_PUBLIC_APP_URL: 'https://food4love.app' }),
    stagingEnv({ NEXT_PUBLIC_APP_URL: '' }),
    stagingEnv({ SUPABASE_SERVICE_ROLE_KEY: '' }),
  ]) {
    const { fetchFn, calls } = fakeFetch()
    const result = await runPreflight(env, fetchFn)
    assert.equal(result.ok, false)
    assert.equal(calls.length, 0)
  }
})

test('preflight: a brand-new empty project is told to build the baseline FIRST, with no migrations suggested as safe', async () => {
  const { fetchFn } = fakeFetch({ tables: [] })
  const result = await runPreflight(stagingEnv(), fetchFn)
  assert.equal(result.ok, false)
  const fail = result.checks.find((c) => c.status === 'fail')
  assert.equal(fail.name, 'baseline tables exist')
  for (const table of BASELINE_TABLES)
    assert.match(fail.detail, new RegExp(table))
  assert.match(fail.detail, /Do NOT apply the new migrations/)
})

test('preflight: with the baseline present it lists the migrations still to apply, in the documented order', async () => {
  const { fetchFn } = fakeFetch()
  const result = await runPreflight(stagingEnv(), fetchFn)
  assert.equal(result.ok, true)
  assert.deepEqual(
    result.nextMigrations,
    MIGRATION_ORDER.map((m) => m.file),
  )
  assert.deepEqual(
    MIGRATION_ORDER.map((m) => m.file),
    [
      'supabase-migration-booking-verification.sql',
      'supabase-migration-email-deliveries.sql',
      'supabase-migration-interest-verification-email.sql',
      'supabase-migration-tester-invitations.sql',
    ],
  )
  // part-way: the first two are in, so only the last two remain
  const partway = await runPreflight(
    stagingEnv(),
    fakeFetch({
      tables: [
        ...BASELINE_TABLES,
        'booking_interests',
        'booking_events',
        'email_deliveries',
      ],
    }).fetchFn,
  )
  assert.deepEqual(partway.nextMigrations, [
    'supabase-migration-interest-verification-email.sql',
    'supabase-migration-tester-invitations.sql',
  ])
  const all = await runPreflight(
    stagingEnv(),
    fakeFetch({
      tables: [
        ...BASELINE_TABLES,
        'booking_interests',
        'booking_events',
        'email_deliveries',
        'interest_email_cutover',
        'tester_invitations',
      ],
    }).fetchFn,
  )
  assert.deepEqual(all.nextMigrations, [])
})

test('preflight: it only sends GET requests, never prints a key, and reports counts only', async () => {
  const env = stagingEnv({
    RESEND_API_KEY: 're_synthetic_not_a_real_key_000000',
  })
  const { fetchFn, calls } = fakeFetch({ users: '2' })
  const result = await runPreflight(env, fetchFn)
  assert.ok(calls.length >= 3 && calls.every((c) => c.method === 'GET'))
  assert.ok(
    calls.every((c) => !/\/rest\/v1\/[a-z_]+\?/.test(c.url)),
    "never reads a table's rows",
  )
  const printed = JSON.stringify(result)
  for (const secret of [
    env.SUPABASE_SERVICE_ROLE_KEY,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    env.RESEND_API_KEY,
  ])
    assert.ok(!printed.includes(secret))
  assert.match(
    result.checks.find((c) => c.name === 'auth users in this project').detail,
    /^2 user\(s\)/,
  )
})

test('preflight: an unreachable or wrong-key project fails clearly', async () => {
  assert.equal(
    (
      await runPreflight(
        stagingEnv(),
        fakeFetch({ throwOn: '/auth/v1/health' }).fetchFn,
      )
    ).ok,
    false,
  )
  const wrongKey = await runPreflight(
    stagingEnv(),
    fakeFetch({ restStatus: 401 }).fetchFn,
  )
  assert.equal(wrongKey.ok, false)
  assert.match(
    wrongKey.checks.find((c) => c.status === 'fail').detail,
    /THIS project/,
  )
  assert.equal(
    (await runPreflight(stagingEnv(), fakeFetch({ healthStatus: 503 }).fetchFn))
      .ok,
    false,
  )
})

test('the table list comes from the API description, names only', () => {
  assert.deepEqual(
    tablesFromOpenApi(
      openApi(['profiles', 'notifications'], ['my_interest_count']),
    ),
    { tables: ['profiles', 'notifications'], functions: ['my_interest_count'] },
  )
  assert.deepEqual(tablesFromOpenApi(null), { tables: [], functions: [] })
  assert.deepEqual(tablesFromOpenApi({ paths: { '/a/b': {}, '/ok': {} } }), {
    tables: ['ok'],
    functions: [],
  })
})

// ============================================================================== 4. the command-line scripts, as real subprocesses
function runScript(script, cwd, env = {}, args = []) {
  const clean = { ...process.env }
  for (const n of Object.keys(clean))
    if (
      /SUPABASE|RESEND|PAYSTACK|F4L_|VERCEL|GROQ|GOOGLE_GENERATIVE|CRON_SECRET|NEXT_PUBLIC/.test(
        n,
      )
    )
      delete clean[n]
  const result = spawnSync(
    process.execPath,
    [join(root, 'scripts', script), ...args],
    { cwd, env: { ...clean, ...env }, encoding: 'utf8', timeout: 60000 },
  )
  return { code: result.status, out: `${result.stdout}\n${result.stderr}` }
}
const envText = (values) =>
  Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n'
function tempProject(files) {
  const dir = mkdtempSync(join(tmpdir(), 'f4l-env-'))
  for (const [name, content] of Object.entries(files))
    writeFileSync(join(dir, name), content)
  return dir
}

test('npm run dev is stopped by the guard when .env.local points at production', () => {
  const dir = tempProject({ '.env.local': envText(productionEnv()) })
  try {
    const stopped = runScript('env-guard.mjs', dir)
    assert.equal(stopped.code, 1)
    assert.match(stopped.out, /NOT STARTING/)
    assert.match(stopped.out, /PRODUCTION/)
    assert.match(stopped.out, /npm run dev:staging/)
    assert.ok(
      !stopped.out.includes(productionEnv().SUPABASE_SERVICE_ROLE_KEY),
      'no key is ever printed',
    )
    // the explicit override, in the same command, lets it through (with a warning)
    const allowed = runScript('env-guard.mjs', dir, {
      F4L_ALLOW_PRODUCTION_LOCAL: PRODUCTION_OVERRIDE_VALUE,
    })
    assert.equal(allowed.code, 0)
    assert.match(allowed.out, /WARNING: production was allowed/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('npm run dev proceeds for staging, and is stopped by mixed-up keys', () => {
  const ok = tempProject({ '.env.local': envText(stagingEnv()) })
  const mixed = tempProject({
    '.env.local': envText(
      stagingEnv({
        SUPABASE_SERVICE_ROLE_KEY: jwt(PRODUCTION_SUPABASE_REF, 'service_role'),
      }),
    ),
  })
  try {
    const good = runScript('env-guard.mjs', ok)
    assert.equal(good.code, 0)
    assert.match(good.out, /other-supabase/)
    assert.equal(runScript('env-guard.mjs', mixed).code, 1)
  } finally {
    rmSync(ok, { recursive: true, force: true })
    rmSync(mixed, { recursive: true, force: true })
  }
})

test('dev:staging reads only .env.staging.local and blanks every real key a normal .env.local would leak in', () => {
  const dir = tempProject({
    '.env.local': envText({
      ...productionEnv(),
      RESEND_API_KEY: 're_real_looking_production_key',
      PAYSTACK_SECRET_KEY: ['sk', 'live', 'real_looking_key_000'].join('_'),
      GROQ_API_KEY: 'gsk_real_looking',
      CRON_SECRET: 'production-cron-secret-value-0123456789',
    }),
    '.env.staging.local': envText({ ...stagingEnv(), RESEND_API_KEY: '' }),
  })
  try {
    const r = runScript('dev-staging.mjs', dir, {}, ['--check'])
    assert.equal(r.code, 0, r.out)
    assert.match(r.out, /NOT production/)
    assert.match(r.out, /blank in the staging run: .*RESEND_API_KEY/)
    for (const leaked of ['PAYSTACK_SECRET_KEY', 'GROQ_API_KEY', 'CRON_SECRET'])
      assert.match(r.out, new RegExp(leaked))
    assert.match(r.out, /nothing was started/)
    for (const secret of [
      're_real_looking_production_key',
      ['sk', 'live', 'real_looking_key_000'].join('_'),
      'production-cron-secret',
      stagingEnv().SUPABASE_SERVICE_ROLE_KEY,
    ])
      assert.ok(!r.out.includes(secret), 'no value is printed')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('dev:staging refuses production (override or not), live payment keys, missing files and a missing site address', () => {
  const cases = {
    'production, even with the override': {
      files: {
        '.env.staging.local': envText(
          productionEnv({
            F4L_ALLOW_PRODUCTION_LOCAL: PRODUCTION_OVERRIDE_VALUE,
            NEXT_PUBLIC_APP_URL: 'http://localhost:5001',
          }),
        ),
      },
      env: { F4L_ALLOW_PRODUCTION_LOCAL: PRODUCTION_OVERRIDE_VALUE },
      expect: /PRODUCTION/,
    },
    'a live payment key': {
      files: {
        '.env.staging.local': envText(
          stagingEnv({
            PAYSTACK_SECRET_KEY: ['sk', 'live', 'dummy'].join('_'),
          }),
        ),
      },
      expect: /LIVE payment key/,
    },
    'mixed keys': {
      files: {
        '.env.staging.local': envText(
          stagingEnv({
            SUPABASE_SERVICE_ROLE_KEY: jwt(
              PRODUCTION_SUPABASE_REF,
              'service_role',
            ),
          }),
        ),
      },
      expect: /different Supabase project/,
    },
    'no site address': {
      files: {
        '.env.staging.local': envText(stagingEnv({ NEXT_PUBLIC_APP_URL: '' })),
      },
      expect: /NEXT_PUBLIC_APP_URL/,
    },
    'no service key': {
      files: {
        '.env.staging.local': envText(
          stagingEnv({ SUPABASE_SERVICE_ROLE_KEY: '' }),
        ),
      },
      expect: /SUPABASE_SERVICE_ROLE_KEY/,
    },
    'an unrecognised address': {
      files: {
        '.env.staging.local': envText(
          stagingEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://db.custom.example' }),
        ),
      },
      expect: /staging \*\.supabase\.co/,
    },
    'no staging file': {
      files: { '.env.local': envText(productionEnv()) },
      expect: /\.env\.staging\.local not found/,
    },
  }
  for (const [label, c] of Object.entries(cases)) {
    const dir = tempProject(c.files)
    try {
      const r = runScript('dev-staging.mjs', dir, c.env ?? {}, ['--check'])
      assert.equal(r.code, 1, `${label}: ${r.out}`)
      assert.match(r.out, c.expect, label)
      assert.doesNotMatch(r.out, /configuration accepted/, label)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

test('dev:staging --prod refuses production before building anything', () => {
  const dir = tempProject({
    '.env.staging.local': envText(
      productionEnv({
        F4L_ALLOW_PRODUCTION_LOCAL: PRODUCTION_OVERRIDE_VALUE,
        NEXT_PUBLIC_APP_URL: 'http://localhost:5001',
      }),
    ),
  })
  try {
    const r = runScript(
      'dev-staging.mjs',
      dir,
      { F4L_ALLOW_PRODUCTION_LOCAL: PRODUCTION_OVERRIDE_VALUE },
      ['--prod'],
    )
    assert.equal(r.code, 1, r.out)
    assert.match(r.out, /PRODUCTION/)
    assert.match(r.out, /Nothing was started/)
    assert.doesNotMatch(r.out, /building into \.next-staging/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a staging production build can only use its own output folder', () => {
  const config = readFileSync(join(root, 'next.config.mjs'), 'utf8')
  assert.match(
    config,
    /process\.env\.F4L_NEXT_DIST_DIR === '\.next-staging'\s*\?\s*'\.next-staging'\s*:\s*'\.next'/,
  )
  assert.match(
    readFileSync(join(root, '.gitignore'), 'utf8'),
    /^\.next-staging\/$/m,
  )
  const launcher = readFileSync(join(root, 'scripts/dev-staging.mjs'), 'utf8')
  // the production-mode branch comes after every refusal check
  assert.ok(
    launcher.indexOf("process.argv.includes('--prod')") >
      launcher.indexOf('NOT STARTING'),
  )
})

test('preflight:staging stops on production configuration without contacting anything', () => {
  const dir = tempProject({
    '.env.staging.local': envText(
      productionEnv({ NEXT_PUBLIC_APP_URL: 'http://localhost:5001' }),
    ),
  })
  try {
    const r = runScript('staging-preflight.mjs', dir)
    assert.equal(r.code, 1)
    assert.match(r.out, /\[FAIL\] target is not production/)
    assert.match(r.out, /DO NOT PROCEED/)
    assert.doesNotMatch(r.out, /\[PASS\] (authentication|database)/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================================== 5. wiring and hygiene
test('npm scripts: the guard runs before dev and start; staging has its own commands', () => {
  const scripts = JSON.parse(read('package.json')).scripts
  assert.equal(
    scripts.predev,
    'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/env-guard.mjs',
  )
  assert.equal(
    scripts.prestart,
    'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/env-guard.mjs',
  )
  assert.equal(
    scripts['dev:staging'],
    'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/dev-staging.mjs',
  )
  assert.equal(
    scripts['preflight:staging'],
    'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/staging-preflight.mjs',
  )
  assert.equal(
    scripts.dev,
    'next dev -p 5000',
    'the normal dev command is unchanged',
  )
  assert.equal(
    scripts.build,
    'next build',
    'builds (CI, Vercel) are not guarded',
  )
})

test('the staging template lists names only, is not git-ignored, and the real file is', () => {
  const template = parseEnvFile(join(root, '.env.staging.example'))
  const filled = Object.entries(template).filter(([, v]) => v !== '')
  assert.deepEqual(Object.fromEntries(filled), {
    NEXT_PUBLIC_APP_URL: 'http://localhost:5001',
    NEXT_PUBLIC_APP_NAME: 'Food4Love (staging)',
    NEXT_PUBLIC_ANALYTICS_ENABLED: 'false',
  })
  assert.doesNotMatch(
    read('.env.staging.example'),
    /eyJ|sk_(live|test)_|re_[A-Za-z0-9]{10,}|supabase\.co/,
  )
  const ignore = read('.gitignore')
  assert.match(
    ignore,
    /^\.env\*\.local$/m,
    '.env.staging.local is ignored by the existing pattern',
  )
  assert.doesNotMatch(ignore, /\.env\.staging\.example/)
})

test('the production project reference is the one in the engineering notes', () => {
  assert.equal(PRODUCTION_SUPABASE_REF, 'oynhaqpuqzvaymntnzqo')
  assert.match(read('src/lib/env/supabaseGuard.ts'), /PUBLIC identifier/)
})

// ============================================================================== 6. preview vs production on Vercel
// VERCEL is set for every deployment, so it cannot tell the live site from a pull-request preview.
// VERCEL_ENV can. These tests pin that difference.
import {
  productionForbiddenHere,
  runtimeEnvironment,
} from '../src/lib/env/supabaseGuard.ts'

test('Vercel: the live deployment may use production, a preview or `vercel dev` never may', () => {
  assert.equal(runtimeEnvironment({}), 'local')
  assert.equal(runtimeEnvironment({ VERCEL: '1' }), 'unknown')
  assert.equal(
    runtimeEnvironment({ VERCEL: '1', VERCEL_ENV: 'Production' }),
    'production',
  )
  assert.equal(
    runtimeEnvironment({ VERCEL: '1', VERCEL_ENV: 'preview' }),
    'preview',
  )
  assert.equal(
    runtimeEnvironment({ VERCEL: '1', VERCEL_ENV: 'something-new' }),
    'unknown',
  )

  const live = productionEnv({ VERCEL: '1', VERCEL_ENV: 'production' })
  assert.equal(assessSupabaseEnv(live).ok, true)
  assert.equal(productionForbiddenHere(live), false)

  for (const stage of ['preview', 'development']) {
    const env = productionEnv({ VERCEL: '1', VERCEL_ENV: stage })
    const assessment = assessSupabaseEnv(env)
    assert.equal(assessment.ok, false, stage)
    assert.match(assessment.problems.join(' '), /Vercel .* deployment/, stage)
    assert.equal(productionForbiddenHere(env), true, stage)
    assert.equal(mayUseProductionHere(env), false, stage)
    // the override phrase is for a developer's computer; it does not open a preview
    const overridden = {
      ...env,
      F4L_ALLOW_PRODUCTION_LOCAL: PRODUCTION_OVERRIDE_VALUE,
    }
    assert.equal(mayUseProductionHere(overridden), false, `${stage} + override`)
    assert.throws(
      () => assertSupabaseTargetAllowed(overridden),
      /Vercel preview/,
      `${stage} + override`,
    )
  }
})

test('Vercel: a preview on the staging project is fine, and when VERCEL_ENV is hidden the old behaviour is kept', () => {
  const preview = stagingEnv({ VERCEL: '1', VERCEL_ENV: 'preview' })
  assert.equal(assessSupabaseEnv(preview).ok, true)
  assert.equal(productionForbiddenHere(preview), false)
  assert.doesNotThrow(() => assertSupabaseTargetAllowed(preview))
  // the platform did not report the stage: do not take the live site down
  assert.equal(productionForbiddenHere(productionEnv({ VERCEL: '1' })), false)
  // a plain local process on production is still refused, and still allowed with the phrase
  assert.equal(productionForbiddenHere(productionEnv()), true)
  assert.equal(
    productionForbiddenHere(
      productionEnv({ F4L_ALLOW_PRODUCTION_LOCAL: PRODUCTION_OVERRIDE_VALUE }),
    ),
    false,
  )
  // nothing configured is not "production"
  assert.equal(
    productionForbiddenHere({ VERCEL: '1', VERCEL_ENV: 'preview' }),
    false,
  )
})

test('a preview that holds the production service key cannot build an admin client', async () => {
  const adminModule = await import('../src/lib/supabase/admin.ts')
  const previous = { ...process.env }
  try {
    for (const k of Object.keys(process.env)) delete process.env[k]
    Object.assign(
      process.env,
      productionEnv({ VERCEL: '1', VERCEL_ENV: 'preview' }),
    )
    assert.throws(() => adminModule.createAdminClient(), /preview deployment/)
    Object.assign(
      process.env,
      productionEnv({ VERCEL: '1', VERCEL_ENV: 'production' }),
    )
    assert.ok(adminModule.createAdminClient())
  } finally {
    for (const k of Object.keys(process.env)) delete process.env[k]
    Object.assign(process.env, previous)
  }
})

test('the middleware refuses every request first when production is forbidden here', () => {
  const src = read('src/middleware.ts')
  assert.match(src, /productionForbiddenHere\(process\.env\)/)
  assert.ok(
    src.indexOf('productionForbiddenHere(process.env)') <
      src.indexOf('createServerClient('),
    'the check must come before any Supabase client is built',
  )
  assert.ok(
    src.indexOf('productionForbiddenHere(process.env)') <
      src.indexOf("pathname === '/'"),
    'and before the redirects',
  )
  assert.match(src, /status: 503/)
})

function runBuildGuard(env) {
  // a clean environment: only what the test names, so nothing from this machine leaks in
  const result = spawnSync(
    process.execPath,
    ['scripts/vercel-build-guard.mjs'],
    {
      cwd: root,
      env: { PATH: process.env.PATH, ...env },
      encoding: 'utf8',
    },
  )
  return { code: result.status, out: `${result.stdout}${result.stderr}` }
}

test('build guard: a preview build against production is stopped, with names only', () => {
  const env = productionEnv({ VERCEL: '1', VERCEL_ENV: 'preview' })
  const run = runBuildGuard(env)
  assert.equal(run.code, 1)
  assert.match(run.out, /PRODUCTION project/)
  assert.match(run.out, /PRODUCTION key/)
  for (const secret of [
    env.SUPABASE_SERVICE_ROLE_KEY,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ])
    assert.ok(!run.out.includes(secret), 'no key is ever printed')
  // production key next to a staging address is also stopped in a preview
  const mixed = runBuildGuard(
    stagingEnv({
      VERCEL: '1',
      VERCEL_ENV: 'preview',
      SUPABASE_SERVICE_ROLE_KEY: jwt(PRODUCTION_SUPABASE_REF, 'service_role'),
    }),
  )
  assert.equal(mixed.code, 1)
})

test('build guard: production builds, staging previews and builds outside Vercel are never blocked', () => {
  assert.equal(
    runBuildGuard(productionEnv({ VERCEL: '1', VERCEL_ENV: 'production' }))
      .code,
    0,
  )
  // VERCEL_ENV not reported: never blocks (cannot tell, and the live site must keep deploying)
  assert.equal(runBuildGuard(productionEnv({ VERCEL: '1' })).code, 0)
  assert.equal(
    runBuildGuard(stagingEnv({ VERCEL: '1', VERCEL_ENV: 'preview' })).code,
    0,
  )
  // a preview with no Supabase settings at all still builds (as today)
  assert.equal(runBuildGuard({ VERCEL: '1', VERCEL_ENV: 'preview' }).code, 0)
  // GitHub Actions and laptops have no VERCEL
  assert.equal(runBuildGuard(productionEnv()).code, 0)
  assert.equal(runBuildGuard({}).code, 0)
})

test('build guard: it is wired before `next build`, and names the same production project as the app guard', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.scripts.prebuild, 'node scripts/vercel-build-guard.mjs')
  assert.equal(pkg.scripts.build, 'next build')
  assert.match(
    read('scripts/vercel-build-guard.mjs'),
    new RegExp(`PRODUCTION_REF = '${PRODUCTION_SUPABASE_REF}'`),
  )
  assert.doesNotMatch(read('scripts/vercel-build-guard.mjs'), /^import /m)
})
