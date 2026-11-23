// `npm run dev:staging`: runs the app against a STAGING Supabase project and nothing else.
//
// ISOLATION. Next.js would normally also load .env.local, which points at production and holds real
// keys. This launcher therefore (1) reads ONLY .env.staging.local, (2) sets every variable that a
// normal .env file defines but staging does not define to an EMPTY string (Next never overrides a
// variable that is already set, even to ""), so no real Resend, payment or AI key can leak in, and
// (3) refuses to start if the result could touch production. It prints names, never values.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import {
  assessSupabaseEnv,
  namesToBlank,
} from '../src/lib/env/supabaseGuard.ts'
import { inheritedNames, parseEnvFile } from './lib/envfile.mjs'

const cwd = process.cwd()
const file = `${cwd}/.env.staging.local`
if (!existsSync(file)) {
  console.error(
    '\n[staging] .env.staging.local not found.\n' +
      'Create it: copy .env.staging.example to .env.staging.local and fill in the STAGING project values\n' +
      '(the file is git-ignored). See STAGING-ENVIRONMENT-PLAN.txt.\n',
  )
  process.exit(1)
}

const staging = parseEnvFile(file)
const definedHere = new Set(
  Object.keys(staging).filter((k) => staging[k] !== ''),
)
const env = { ...process.env }

// 1. blank everything a normal run would inherit, unless staging defines it
for (const name of namesToBlank(inheritedNames(cwd), definedHere))
  env[name] = ''
// 2. the platform and override switches must never be inherited into a staging run
env.VERCEL = ''
env.F4L_ALLOW_PRODUCTION_LOCAL = ''
// 3. staging values
for (const [name, value] of Object.entries(staging)) env[name] = value
env.F4L_ENV = 'staging'

const assessment = assessSupabaseEnv(env, { requireServiceKey: true })
const problems = [...assessment.problems]
if (assessment.target === 'production')
  problems.push(
    'This is the PRODUCTION project. The staging launcher never runs against production, with or without an override.',
  )
if (assessment.target === 'unknown')
  problems.push(
    'NEXT_PUBLIC_SUPABASE_URL must be a staging *.supabase.co project (or a local address).',
  )
if ((env.PAYSTACK_SECRET_KEY ?? '').startsWith('sk_live_'))
  problems.push(
    'PAYSTACK_SECRET_KEY is a LIVE payment key. Use a test key or leave it empty in staging.',
  )
if (!env.NEXT_PUBLIC_APP_URL) problems.push('NEXT_PUBLIC_APP_URL is not set.')

if (problems.length) {
  console.error('\n[staging] NOT STARTING:\n')
  for (const p of problems) console.error(`  - ${p}`)
  console.error('\nNothing was started and nothing was contacted.\n')
  process.exit(1)
}

const blanked = namesToBlank(inheritedNames(cwd), definedHere).length
console.log(
  `\n[staging] Supabase project ${assessment.ref ?? '(local address)'} (NOT production).\n` +
    `[staging] ${blanked} variable(s) from your normal .env files were blanked for this run.\n` +
    `[staging] Email: ${env.RESEND_API_KEY ? 'a Resend key is set (use only your own test addresses)' : 'no Resend key: emails will not be sent'}.\n`,
)

if (process.argv.includes('--check')) {
  // Report only. Starts nothing. Names only, never values.
  // Reported from the environment the server would ACTUALLY receive (names that a normal run would
  // inherit and that are empty here), not from a precomputed list, so this proves the blanking happened.
  const effectivelyBlank = [...inheritedNames(cwd)]
    .filter((name) => env[name] === '' && !definedHere.has(name))
    .sort()
  console.log(
    `[staging] --check: blank in the staging run: ${effectivelyBlank.join(', ') || '(nothing)'}`,
  )
  console.log('[staging] --check: configuration accepted; nothing was started.')
  process.exit(0)
}

const port = env.STAGING_PORT || '5001'
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '-p', port],
  {
    cwd,
    env,
    stdio: 'inherit',
  },
)
child.on('exit', (code) => process.exit(code ?? 0))
