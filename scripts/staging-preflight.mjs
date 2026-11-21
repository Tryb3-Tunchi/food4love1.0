// `npm run preflight:staging`: a READ-ONLY report on the staging project named in .env.staging.local.
// Run it BEFORE applying any migration. It sends GET requests only, reads no application data (only the
// list of table names and a count of auth users) and prints no key. Exit code 1 means "do not proceed".
import { existsSync } from 'node:fs'
import { parseEnvFile } from './lib/envfile.mjs'
import { runPreflight } from './lib/stagingPreflight.mjs'

const file = `${process.cwd()}/.env.staging.local`
if (!existsSync(file)) {
  console.error(
    '\n[preflight] .env.staging.local not found. Copy .env.staging.example and fill in the STAGING values.\n',
  )
  process.exit(1)
}

const result = await runPreflight(parseEnvFile(file), (url, init) =>
  fetch(url, { ...init, method: 'GET' }),
)

const mark = { pass: 'PASS', fail: 'FAIL', info: 'INFO' }
console.log('\nFood4Love staging preflight (read-only)\n')
for (const check of result.checks)
  console.log(`  [${mark[check.status]}] ${check.name}: ${check.detail}`)
console.log(
  result.ok
    ? '\nResult: nothing blocks testing. Migrations are STILL not applied by this tool; apply them yourself, in the order shown, after you decide.\n'
    : '\nResult: DO NOT PROCEED. Fix the FAIL lines first. Nothing was changed.\n',
)
process.exit(result.ok ? 0 : 1)
