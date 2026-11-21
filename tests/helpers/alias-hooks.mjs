// Node module-resolution hooks for the tests that run real server modules.
//
//   "@/..."            -> src/...  (the project's path alias)
//   "server-only"      -> an empty module (it throws outside a React Server Component)
//   Supabase admin     -> a stub that returns the in-memory fake (tests/helpers/fake-supabase.mjs)
//   admin audit log    -> a stub that records calls in memory
//
// Substituting the admin client and audit logger means a test can never build a real
// service-role client, so it can never reach a real database.

import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const here = (file) =>
  pathToFileURL(path.join(root, 'tests/helpers', file)).href

const stubs = {
  'server-only': 'data:text/javascript,export {}',
  '@/lib/supabase/admin': here('stub-admin.mjs'),
  '@/lib/admin/audit': here('stub-audit.mjs'),
  '@/lib/supabase/server': here('stub-server-client.mjs'),
}

export async function resolve(specifier, context, nextResolve) {
  if (stubs[specifier]) return { url: stubs[specifier], shortCircuit: true }
  // Node's ESM resolver wants the extension that Next's bundler adds for us.
  if (specifier === 'next/server') return nextResolve('next/server.js', context)
  if (specifier.startsWith('@/')) {
    const base = path.join(root, 'src', specifier.slice(2))
    for (const candidate of [`${base}.ts`, path.join(base, 'index.ts')]) {
      if (existsSync(candidate))
        return { url: pathToFileURL(candidate).href, shortCircuit: true }
    }
  }
  return nextResolve(specifier, context)
}
