// Runs automatically before `npm run dev` and `npm start` (npm's pre-scripts). It loads the environment
// exactly the way Next.js does and REFUSES to continue if this local process would talk to the real
// production Supabase project. It prints names and the (public) project reference only, never a key.
//
// To test safely use a STAGING project:   npm run dev:staging
// To use production on purpose (rarely a good idea), in the SAME command:
//   PowerShell:  $env:F4L_ALLOW_PRODUCTION_LOCAL = "I_UNDERSTAND_THIS_USES_REAL_DATA"; npm run dev
//   bash:        F4L_ALLOW_PRODUCTION_LOCAL=I_UNDERSTAND_THIS_USES_REAL_DATA npm run dev
import nextEnv from '@next/env'
import { assessSupabaseEnv } from '../src/lib/env/supabaseGuard.ts'

nextEnv.loadEnvConfig(process.cwd(), true)
const assessment = assessSupabaseEnv(process.env)

if (assessment.ok) {
  console.log(
    `[env guard] Supabase target: ${assessment.target}${assessment.ref ? ` (${assessment.ref})` : ''}. OK to start.`,
  )
  if (assessment.target === 'production')
    console.log(
      '[env guard] WARNING: production was allowed by an explicit override. Real customer data is in play.',
    )
  process.exit(0)
}

console.error(
  '\n[env guard] NOT STARTING. This configuration is not safe for a local process:\n',
)
for (const problem of assessment.problems) console.error(`  - ${problem}`)
console.error(
  '\nWhat to do: create a staging Supabase project and run  npm run dev:staging  (see STAGING-ENVIRONMENT-PLAN.txt).\n' +
    'Nothing was started and nothing was contacted.\n',
)
process.exit(1)
