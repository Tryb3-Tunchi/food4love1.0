import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { assertSupabaseTargetAllowed } from '@/lib/env/supabaseGuard'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server credentials are not configured')
  }

  // The service-role key bypasses every access rule. A process running on a developer's computer must
  // never hold it against the REAL project (deployed code on Vercel is unaffected), and a key from one
  // project must never be paired with another project's address.
  assertSupabaseTargetAllowed(process.env)

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
