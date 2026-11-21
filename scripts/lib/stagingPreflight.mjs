// A READ-ONLY check that a configuration is a safe place to test, run BEFORE anything is applied to it.
// It only ever sends GET requests, never reads a row of application data, and never prints a key.
// Used by scripts/staging-preflight.mjs, and unit-tested with a fake `fetch` (no real service involved).
import {
  PRODUCTION_SUPABASE_REF,
  assessSupabaseEnv,
  classifySupabaseTarget,
} from '../../src/lib/env/supabaseGuard.ts'

// Tables the new features need to ALREADY exist (the baseline a new Supabase project does not have).
export const BASELINE_TABLES = [
  'profiles',
  'notifications',
  'matches',
  'bookings',
  'cook_availability',
  'admin_audit_log',
]

// Tables the pending migrations create (their presence tells us how far staging has got).
export const MIGRATION_TABLES = [
  'booking_interests',
  'booking_events',
  'email_deliveries',
  'tester_invitations',
  'interest_email_cutover',
]

// The order the migrations must be applied in, and the table each one creates.
export const MIGRATION_ORDER = [
  {
    file: 'supabase-migration-booking-verification.sql',
    creates: 'booking_interests',
  },
  {
    file: 'supabase-migration-email-deliveries.sql',
    creates: 'email_deliveries',
  },
  {
    file: 'supabase-migration-interest-verification-email.sql',
    creates: 'interest_email_cutover',
  },
  {
    file: 'supabase-migration-tester-invitations.sql',
    creates: 'tester_invitations',
  },
]

// "GET /rest/v1/" on a Supabase project returns an OpenAPI document whose `paths` name every exposed
// table ("/profiles") and function ("/rpc/some_function"). Names only: no rows.
export function tablesFromOpenApi(doc) {
  const paths = doc && typeof doc === 'object' && doc.paths ? doc.paths : {}
  const tables = []
  const functions = []
  for (const path of Object.keys(paths)) {
    const rpc = /^\/rpc\/([A-Za-z0-9_]+)$/.exec(path)
    if (rpc) functions.push(rpc[1])
    else {
      const table = /^\/([A-Za-z0-9_]+)$/.exec(path)
      if (table) tables.push(table[1])
    }
  }
  return { tables, functions }
}

// env: plain object of settings. fetchFn: (url, { headers }) => Promise<{ ok, status, headers.get, json() }>
export async function runPreflight(env, fetchFn, options = {}) {
  const productionRef = options.productionRef ?? PRODUCTION_SUPABASE_REF
  const checks = []
  const add = (name, status, detail) => checks.push({ name, status, detail })
  const result = (presentTables = [], nextMigrations = []) => ({
    ok: checks.every((c) => c.status !== 'fail'),
    checks,
    presentTables,
    nextMigrations,
  })

  // 1. WHICH project is this? Never go any further if it could be production.
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const target = classifySupabaseTarget(url, productionRef)
  const assessment = assessSupabaseEnv(env, {
    productionRef,
    requireServiceKey: true,
  })
  if (target === 'production') {
    add(
      'target is not production',
      'fail',
      'The configuration points at the PRODUCTION project. Nothing was contacted.',
    )
    return result()
  }
  add(
    'target is not production',
    'pass',
    `project ${assessment.ref ?? '(local address)'} differs from production`,
  )
  if (target === 'unknown')
    add(
      'target is a Supabase project',
      'fail',
      'NEXT_PUBLIC_SUPABASE_URL is missing or is not a *.supabase.co address.',
    )
  else
    add(
      'target is a Supabase project',
      'pass',
      target === 'local' ? 'a local address' : 'a hosted staging project',
    )
  if (!assessment.ok) {
    for (const problem of assessment.problems)
      add('configuration is consistent', 'fail', problem)
    return result()
  }
  add('keys belong to this project', 'pass', 'no key names a different project')

  // 2. isolation of everything else a test could touch
  if ((env.PAYSTACK_SECRET_KEY ?? '').startsWith('sk_live_'))
    add(
      'payments are in test mode',
      'fail',
      'PAYSTACK_SECRET_KEY is a LIVE key. Staging must use a test key or none.',
    )
  else add('payments are in test mode', 'pass', 'no live payment key')
  const appUrl = env.NEXT_PUBLIC_APP_URL
  if (!appUrl)
    add(
      'site address is set',
      'fail',
      'NEXT_PUBLIC_APP_URL is not set (invitation and reset links need it).',
    )
  else if (/food4love\.app/i.test(appUrl) && !/staging/i.test(appUrl))
    add(
      'site address is set',
      'fail',
      'NEXT_PUBLIC_APP_URL looks like the live site. Links in test emails must not point at production.',
    )
  else add('site address is set', 'pass', appUrl)
  add(
    'email sending',
    'info',
    env.RESEND_API_KEY
      ? 'a Resend key is set: make sure it is a STAGING-only key and every test address is yours'
      : 'no Resend key: invitations will be saved but no email will be sent',
  )
  if (!checks.every((c) => c.status !== 'fail')) return result()

  // 3. is the staging project reachable? (GET only)
  const base = url.replace(/\/+$/, '')
  const service = env.SUPABASE_SERVICE_ROLE_KEY
  const authHeaders = { apikey: service, Authorization: `Bearer ${service}` }
  try {
    const health = await fetchFn(`${base}/auth/v1/health`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    })
    add(
      'authentication service reachable',
      health.ok ? 'pass' : 'fail',
      `HTTP ${health.status}`,
    )
  } catch {
    add('authentication service reachable', 'fail', 'could not connect')
    return result()
  }

  let present = []
  let functions = []
  try {
    const rest = await fetchFn(`${base}/rest/v1/`, { headers: authHeaders })
    if (!rest.ok) {
      add(
        'database API reachable',
        'fail',
        `HTTP ${rest.status} (is the service key from THIS project?)`,
      )
      return result()
    }
    add('database API reachable', 'pass', `HTTP ${rest.status}`)
    const parsed = tablesFromOpenApi(await rest.json())
    present = parsed.tables
    functions = parsed.functions
  } catch {
    add('database API reachable', 'fail', 'could not read the table list')
    return result()
  }

  // 4. the baseline the migrations depend on
  const missingBaseline = BASELINE_TABLES.filter((t) => !present.includes(t))
  if (missingBaseline.length)
    add(
      'baseline tables exist',
      'fail',
      `missing: ${missingBaseline.join(', ')}. A new project has none of Food4Love's existing tables: build the baseline first (STAGING-ENVIRONMENT-PLAN section 2). Do NOT apply the new migrations yet.`,
    )
  else add('baseline tables exist', 'pass', BASELINE_TABLES.join(', '))

  // 5. how far have the migrations got, and what is next (information only)
  const done = MIGRATION_TABLES.filter((t) => present.includes(t))
  add(
    'migrations already applied',
    'info',
    done.length ? done.join(', ') : 'none of the four yet',
  )
  const next = MIGRATION_ORDER.filter((m) => !present.includes(m.creates)).map(
    (m) => m.file,
  )
  add(
    'next migrations, in this order',
    'info',
    next.length
      ? next.join(' > ')
      : 'all four appear applied: run the diagnostic to confirm',
  )

  // 6. how many auth users? Staging must hold only fabricated people (count only)
  try {
    const users = await fetchFn(
      `${base}/auth/v1/admin/users?page=1&per_page=1`,
      { headers: authHeaders },
    )
    const total = users.headers.get('x-total-count')
    add(
      'auth users in this project',
      'info',
      users.ok
        ? `${total ?? 'an unknown number of'} user(s): all must be fabricated test accounts`
        : `HTTP ${users.status}`,
    )
  } catch {
    add('auth users in this project', 'info', 'could not count')
  }
  void functions
  return result(present, next)
}
