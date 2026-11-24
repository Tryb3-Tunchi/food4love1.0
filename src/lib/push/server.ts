// Small server-side helpers for the push routes (no imports: unit-testable).

// The push migration has not been applied to this database (table or function missing).
export function isPushSchemaMissing(
  error: { code?: string | null } | null | undefined,
): boolean {
  return ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error?.code ?? '')
}

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Who may register a device for Web Push. FAILS CLOSED:
//   PUSH_ENROLLMENT=open        every signed-in member may opt in (each still opts in per device)
//   anything else / unset       only the account ids listed in PUSH_PILOT_USER_IDS
//                               (comma-separated UUIDs); an empty or missing list means nobody
// Server-only variables, so the decision cannot be changed from the browser.
export type PushEnrollment = 'open' | 'pilot'

export function pushEnrollment(env: Record<string, string | undefined>): {
  mode: PushEnrollment
  pilot: Set<string>
} {
  const pilot = new Set(
    (env.PUSH_PILOT_USER_IDS ?? '')
      .split(',')
      .map((id) => id.trim().toLowerCase())
      .filter((id) => UUID_PATTERN.test(id)),
  )
  return {
    mode: env.PUSH_ENROLLMENT?.trim() === 'open' ? 'open' : 'pilot',
    pilot,
  }
}

export function mayEnrollInPush(
  userId: string,
  env: Record<string, string | undefined>,
): boolean {
  const { mode, pilot } = pushEnrollment(env)
  return mode === 'open' || pilot.has(userId.toLowerCase())
}

// One test push per member per minute; the event key makes a double press a no-op.
export function pushTestEventKey(userId: string, now = Date.now()): string {
  return `push_test:${userId}:${Math.floor(now / 60_000)}`
}
