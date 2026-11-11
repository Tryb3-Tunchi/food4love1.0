// Small in-memory sliding-window limiter (no imports, so it is unit-testable).
// It is per server instance: a deliberate, best-effort brake on bursts of
// signups from one address, not a security boundary. Vercel may run several
// instances, so it will not catch a slow distributed abuse pattern.

export function createLimiter(options: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>()

  return function allow(key: string, now = Date.now()): boolean {
    const since = now - options.windowMs
    const recent = (hits.get(key) ?? []).filter((time) => time > since)
    if (recent.length >= options.limit) {
      hits.set(key, recent)
      return false
    }
    recent.push(now)
    hits.set(key, recent)

    // Keep memory bounded on long-lived instances.
    if (hits.size > 5000) {
      hits.forEach((times, mapKey) => {
        if (times.every((time) => time <= since)) hits.delete(mapKey)
      })
    }
    return true
  }
}

export function clientKey(headers: { get(name: string): string | null }) {
  const forwarded = headers.get('x-forwarded-for')
  return (
    forwarded?.split(',')[0] ??
    headers.get('x-real-ip') ??
    'unknown'
  ).trim()
}
