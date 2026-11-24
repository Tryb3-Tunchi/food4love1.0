// No imports on purpose: unit-tested with `node --test`.

// The address that links in emails point at. The configured address wins; the request's own
// origin is only a fallback (local development), and only ever comes from a request an
// authorised admin made, never from an anonymous visitor.
export function resolveAppUrl(requestOrigin: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (
    configured &&
    !(
      process.env.NODE_ENV === 'production' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(new URL(configured).hostname)
    )
  )
    return configured
  return requestOrigin.replace(/\/+$/, '')
}

// For links sent in response to an ANONYMOUS request (password reset). The request's own origin
// comes from the Host header, which an attacker controls, so it must never be used in production:
// a forged Host would put the attacker's address into a genuine reset email ("reset-link
// poisoning"). Returns null when no trustworthy address is available, and the caller then refuses
// to send. Outside production the request origin is accepted so local development still works.
export function resolveTrustedAppUrl(requestOrigin: string): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (configured) return configured
  return process.env.NODE_ENV === 'production'
    ? null
    : requestOrigin.replace(/\/+$/, '')
}
