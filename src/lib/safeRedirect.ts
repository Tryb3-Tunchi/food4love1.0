// No imports on purpose: unit-tested with `node --test`.

// Where to send someone after sign-in or email confirmation. The address comes from a
// link, so it must stay on this site. A check for a leading "/" is not enough:
// browsers read "/\evil.example" and "/\t/evil.example" as "//evil.example", a
// different site. Instead the value is resolved against a placeholder origin and
// accepted only if it still lands on that same origin.
export function safeNextPath(input: unknown, fallback = '/swipe'): string {
  if (typeof input !== 'string' || input.length === 0 || input.length > 500)
    return fallback
  if (!input.startsWith('/')) return fallback
  // control characters and backslashes are never legitimate in an internal path
  if (/[\u0000-\u001f\u007f\\]/.test(input)) return fallback
  try {
    const base = 'https://internal.invalid'
    const url = new URL(input, base)
    if (url.origin !== base) return fallback
    const result = `${url.pathname}${url.search}${url.hash}`
    // Dot segments can collapse a path into "//host" once normalised.
    if (result.startsWith('//')) return fallback
    return result
  } catch {
    return fallback
  }
}
