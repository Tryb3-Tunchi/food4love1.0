import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export type OpsSeverity = 'info' | 'warning' | 'error' | 'critical'

// Records a short operational note for the System Health page. Summaries only:
// never pass request bodies, tokens, emails or other personal data. Failures
// here are swallowed on purpose; logging must never break the request.
export async function logOpsEvent(input: {
  severity: OpsSeverity
  service: string
  code?: string
  summary: string
}) {
  try {
    const admin = createAdminClient()
    await admin.from('ops_events').insert({
      severity: input.severity,
      service: input.service.slice(0, 40),
      code: input.code?.slice(0, 60) ?? null,
      summary: input.summary.slice(0, 200),
    })
  } catch {
    // Ignored deliberately.
  }
}

// True when a Supabase error just means "the migration has not been applied".
export function isMissingTable(error: { code?: string } | null | undefined) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}
