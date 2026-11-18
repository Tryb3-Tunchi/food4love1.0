// No imports on purpose: unit-tested with `node --test`.

// The address that links in emails point at. The configured address wins; the request's own
// origin is only a fallback (local development), and only ever comes from a request an
// authorised admin made, never from an anonymous visitor.
export function resolveAppUrl(requestOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  return configured || requestOrigin.replace(/\/+$/, '')
}
