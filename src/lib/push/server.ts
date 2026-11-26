// Small server-side helpers for the push routes (type-only imports: unit-testable).
import type { SupabaseClient } from '@supabase/supabase-js'

// The push migration has not been applied to this database (table or function missing).
export function isPushSchemaMissing(
  error: { code?: string | null } | null | undefined,
): boolean {
  return ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error?.code ?? '')
}

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Who may register a device for Web Push: everyone signed in once public.push_settings is 'open';
// until then, accounts listed in public.push_pilot_members
// (supabase-migration-push-pilot-allowlist.sql), managed by the team in Supabase. Nobody by default.
// Looked up with the service-role client for the SIGNED-IN user's own id only; nothing the browser
// sends can change the answer. FAILS CLOSED: any error means "not enrolled".
// The old PUSH_ENROLLMENT / PUSH_PILOT_USER_IDS environment variables are no longer read.
export type EnrollmentResult = 'enrolled' | 'not_enrolled' | 'unavailable'

export async function pushEnrollmentFor(
  admin: Pick<SupabaseClient, 'from'>,
  userId: string,
): Promise<EnrollmentResult> {
  if (!UUID_PATTERN.test(userId)) return 'not_enrolled'
  try {
    // 1. general opt-in switch (supabase-migration-push-general-opt-in.sql). Missing table = the
    //    switch is not installed yet = pilot only (today's behaviour). Any other error fails closed.
    const settings = await admin
      .from('push_settings')
      .select('enrollment')
      .eq('id', true)
      .maybeSingle()
    if (settings.error && !isPushSchemaMissing(settings.error))
      return 'unavailable'
    if (
      !settings.error &&
      (settings.data as { enrollment?: string } | null)?.enrollment === 'open'
    )
      return 'enrolled'
    // 2. pilot membership of the SIGNED-IN user only
    const { data, error } = await admin
      .from('push_pilot_members')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) return 'unavailable'
    return data ? 'enrolled' : 'not_enrolled'
  } catch {
    return 'unavailable'
  }
}

// The database refuses a device for a non-pilot account (trigger): recognise that answer.
export function isNotEnrolledError(
  error: { message?: string | null } | null | undefined,
): boolean {
  return /not_enrolled/.test(error?.message ?? '')
}

// One test push per member per minute; the event key makes a double press a no-op.
export function pushTestEventKey(userId: string, now = Date.now()): string {
  return `push_test:${userId}:${Math.floor(now / 60_000)}`
}
