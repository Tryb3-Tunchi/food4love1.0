// Small server-side helpers for the push routes (no imports: unit-testable).

// The push migration has not been applied to this database (table or function missing).
export function isPushSchemaMissing(
  error: { code?: string | null } | null | undefined,
): boolean {
  return ['42P01', '42883', 'PGRST202', 'PGRST205'].includes(error?.code ?? '')
}

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// One test push per member per minute; the event key makes a double press a no-op.
export function pushTestEventKey(userId: string, now = Date.now()): string {
  return `push_test:${userId}:${Math.floor(now / 60_000)}`
}
