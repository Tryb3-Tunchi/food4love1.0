// No imports on purpose: used by scripts and by the server, and unit-tested with `node --test`.
//
// WHY THIS EXISTS. Food4Love has exactly one real database. A developer's .env.local normally points
// at it, so a harmless-looking local command (dev server, a test, a script) can read or change real
// customers' data. These rules recognise which Supabase project a configuration points at and refuse
// to let a LOCAL process use production unless someone deliberately says so.
//
// The production project reference is a PUBLIC identifier (it is the first part of the project's web
// address and appears in every request the site makes), not a secret.

export const PRODUCTION_SUPABASE_REF = 'oynhaqpuqzvaymntnzqo'

// The exact words needed to let a local process use production. Deliberately awkward to type by accident.
export const PRODUCTION_OVERRIDE_VALUE = 'I_UNDERSTAND_THIS_USES_REAL_DATA'

export type SupabaseTarget =
  | 'production'
  | 'other-supabase' // a *.supabase.co project that is not production (staging)
  | 'local' // localhost / 127.0.0.1 (a local test double or local Supabase)
  | 'unknown' // missing, malformed, or a custom domain we cannot classify

type Env = Record<string, string | undefined>

// "https://abcd1234.supabase.co" -> "abcd1234". Anything else -> null.
export function supabaseRefFromUrl(
  url: string | undefined | null,
): string | null {
  if (!url) return null
  try {
    const host = new URL(url).hostname.toLowerCase()
    const match = /^([a-z0-9]{10,40})\.supabase\.(co|in|net)$/.exec(host)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export function isLocalUrl(url: string | undefined | null): boolean {
  if (!url) return false
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
  } catch {
    return false
  }
}

// Supabase's JWT-style keys include a `ref` claim naming their project. Returns it, or null for keys
// that are not JWTs (the newer sb_publishable_ / sb_secret_ keys carry no ref). Does NOT verify the
// signature: this only reads a label, it never trusts the key.
export function keyProjectRef(key: string | undefined | null): string | null {
  if (!key) return null
  const parts = key.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as { ref?: unknown }
    return typeof payload.ref === 'string' ? payload.ref : null
  } catch {
    return null
  }
}

export function classifySupabaseTarget(
  url: string | undefined | null,
  productionRef: string = PRODUCTION_SUPABASE_REF,
): SupabaseTarget {
  const ref = supabaseRefFromUrl(url)
  if (ref) return ref === productionRef ? 'production' : 'other-supabase'
  return isLocalUrl(url) ? 'local' : 'unknown'
}

// Where is this process running?
//   'production'   the live Vercel deployment (VERCEL_ENV=production)
//   'preview'      a Vercel preview deployment: every pull request and non-production branch gets one
//   'development'  `vercel dev`
//   'unknown'      VERCEL is set but VERCEL_ENV is not (the project hides Vercel's system variables)
//   'local'        not on Vercel at all (a developer's computer, CI)
// VERCEL alone cannot tell production from a preview: the platform sets it for both.
export type RuntimeEnvironment =
  'production' | 'preview' | 'development' | 'unknown' | 'local'

export function runtimeEnvironment(env: Env): RuntimeEnvironment {
  if (!env.VERCEL) return 'local'
  const stage = (env.VERCEL_ENV ?? '').trim().toLowerCase()
  if (stage === 'production' || stage === 'preview' || stage === 'development')
    return stage
  return 'unknown'
}

// May this process hold the PRODUCTION Supabase project?
//   * the live deployment: yes
//   * a Vercel preview or `vercel dev`: NEVER, not even with the override below. A preview is built from
//     any branch and is reachable by everyone on the team, so it must run on staging data.
//   * 'unknown' (VERCEL set, VERCEL_ENV hidden): yes, as before. Refusing here could take the live site down
//     if the project ever stops exposing system variables; the build check and the dashboard settings still apply.
//   * a local process: only with the deliberate override phrase.
export function mayUseProductionHere(env: Env): boolean {
  const where = runtimeEnvironment(env)
  if (where === 'preview' || where === 'development') return false
  if (where === 'production' || where === 'unknown') return true
  return env.F4L_ALLOW_PRODUCTION_LOCAL === PRODUCTION_OVERRIDE_VALUE
}

// True when this process points at production but is not allowed to. Needs only the address and the
// platform variables (no key parsing), so it is safe to call from the edge middleware on every request.
export function productionForbiddenHere(env: Env): boolean {
  return (
    classifySupabaseTarget(env.NEXT_PUBLIC_SUPABASE_URL) === 'production' &&
    !mayUseProductionHere(env)
  )
}

function whyProductionIsForbidden(env: Env): string {
  const where = runtimeEnvironment(env)
  return where === 'preview' || where === 'development'
    ? `This is a Vercel ${where} deployment and it points at PRODUCTION, which holds real customer data. Previews must use the staging Supabase project: set the Preview environment variables in Vercel to staging values.`
    : 'This configuration points at PRODUCTION, which holds real customer data, and this is a local process. Use a staging project (npm run dev:staging).'
}

export interface EnvAssessment {
  target: SupabaseTarget
  ref: string | null
  // true = safe to proceed in THIS process
  ok: boolean
  problems: string[]
}

// Looks at the Supabase settings in `env` and says whether this process may use them.
//   * production + a local process + no explicit override  -> refused
//   * a key whose project (JWT `ref`) differs from the URL's project -> refused (a production key next to a
//     staging address, or the reverse, is the classic way to hit production by accident)
//   * a service key equal to the public key, or missing -> refused
export function assessSupabaseEnv(
  env: Env,
  options: { productionRef?: string; requireServiceKey?: boolean } = {},
): EnvAssessment {
  const productionRef = options.productionRef ?? PRODUCTION_SUPABASE_REF
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = env.SUPABASE_SERVICE_ROLE_KEY
  const target = classifySupabaseTarget(url, productionRef)
  const ref = supabaseRefFromUrl(url)
  const problems: string[] = []

  if (!url) problems.push('NEXT_PUBLIC_SUPABASE_URL is not set.')
  if (!anon) problems.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.')
  if (options.requireServiceKey && !service)
    problems.push('SUPABASE_SERVICE_ROLE_KEY is not set.')
  if (service && anon && service === anon)
    problems.push('The service key and the public key are identical.')

  for (const [name, key] of [
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', anon],
    ['SUPABASE_SERVICE_ROLE_KEY', service],
  ] as const) {
    const keyRef = keyProjectRef(key)
    if (keyRef && ref && keyRef !== ref)
      problems.push(
        `${name} belongs to a different Supabase project than NEXT_PUBLIC_SUPABASE_URL${
          keyRef === productionRef ? ' (it is the PRODUCTION key)' : ''
        }.`,
      )
    if (keyRef === productionRef && target !== 'production')
      problems.push(
        `${name} is the PRODUCTION key but the URL is not production.`,
      )
  }

  if (target === 'production' && !mayUseProductionHere(env))
    problems.push(whyProductionIsForbidden(env))

  return { target, ref, ok: problems.length === 0, problems }
}

// Server-side last line of defence, called wherever a service-role client is built. A local process
// holding a production service key would otherwise have unlimited access to real data.
export function assertSupabaseTargetAllowed(env: Env): void {
  const assessment = assessSupabaseEnv(env, { requireServiceKey: false })
  if (assessment.target === 'production' && !mayUseProductionHere(env)) {
    const where = runtimeEnvironment(env)
    throw new Error(
      where === 'preview' || where === 'development'
        ? 'Refusing to use the production Supabase project from a Vercel preview deployment. Previews must use the staging project.'
        : 'Refusing to use the production Supabase project from a local process. Use a staging project (see STAGING-ENVIRONMENT-PLAN).',
    )
  }
  if (
    assessment.problems.some((p) =>
      /different Supabase project|PRODUCTION key/.test(p),
    )
  )
    throw new Error(
      'Refusing to start: a Supabase key does not match the project in NEXT_PUBLIC_SUPABASE_URL.',
    )
}

// Names (never values) that must NOT leak from a developer's normal .env.local into a staging run.
// The staging launcher blanks every variable that is not explicitly defined for staging.
export function namesToBlank(
  inheritedNames: Iterable<string>,
  stagingDefined: Set<string>,
): string[] {
  return Array.from(new Set(inheritedNames)).filter(
    (name) => name && !stagingDefined.has(name),
  )
}
