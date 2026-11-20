// Runs before `npm run build` (npm's "prebuild" hook). On Vercel it stops a PREVIEW build whose Supabase
// settings point at the PRODUCTION project, so the mistake shows up as a failed check on the pull request
// instead of a running copy of the app wired to real customer data.
//
// Deliberately standalone plain JavaScript (no TypeScript import): it must run on any Node version Vercel
// picks. tests/env-guard.test.mjs checks that its project reference matches src/lib/env/supabaseGuard.ts.
//
// It NEVER blocks the production deployment (VERCEL_ENV=production), outside Vercel (CI, a laptop) it does
// nothing, and it prints names and the public project reference only, never a key.
const PRODUCTION_REF = 'oynhaqpuqzvaymntnzqo'
const env = process.env

function refFromUrl(url) {
  try {
    const m = /^([a-z0-9]{10,40})\.supabase\.(co|in|net)$/.exec(
      new URL(url).hostname.toLowerCase(),
    )
    return m ? m[1] : null
  } catch {
    return null
  }
}
function refFromKey(key) {
  const parts = String(key ?? '').split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    )
    return typeof payload.ref === 'string' ? payload.ref : null
  } catch {
    return null
  }
}

if (!env.VERCEL) {
  console.log('[build guard] not building on Vercel: nothing to check.')
  process.exit(0)
}
const stage = (env.VERCEL_ENV ?? '').trim().toLowerCase()
if (stage !== 'preview' && stage !== 'development') {
  console.log(
    `[build guard] Vercel environment: ${stage || 'not reported'}. Production and unreported builds are never blocked here.`,
  )
  process.exit(0)
}

const urlRef = refFromUrl(env.NEXT_PUBLIC_SUPABASE_URL)
const problems = []
if (urlRef === PRODUCTION_REF)
  problems.push('NEXT_PUBLIC_SUPABASE_URL is the PRODUCTION project.')
for (const name of [
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]) {
  if (refFromKey(env[name]) === PRODUCTION_REF)
    problems.push(`${name} is the PRODUCTION key.`)
}
if (problems.length === 0) {
  console.log(
    `[build guard] Vercel ${stage} build uses ${urlRef ? `Supabase project ${urlRef}` : 'no Supabase project address'}: not production. OK.`,
  )
  process.exit(0)
}
console.error(`\n[build guard] STOPPING this ${stage} build:\n`)
for (const p of problems) console.error(`  - ${p}`)
console.error(
  '\nPreview deployments must never use the production database. In Vercel -> Settings -> Environment Variables,' +
    '\nscope the production values to "Production" only and give "Preview" the staging project values.' +
    '\nNothing was built and nothing was contacted.\n',
)
process.exit(1)
