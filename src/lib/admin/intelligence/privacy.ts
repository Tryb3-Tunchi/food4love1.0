// Pure module with NO imports so it can be unit-tested with node --test.

// "ada.obi@example.com" -> "a***@e*****.com": enough to recognise, not to use.
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return '—'
  const [local, domain] = email.split('@')
  const dot = domain.lastIndexOf('.')
  const host = dot > 0 ? domain.slice(0, dot) : domain
  const tld = dot > 0 ? domain.slice(dot) : ''
  return `${local.slice(0, 1)}***@${host.slice(0, 1)}*****${tld}`
}

// Two signups that are really the same inbox: Gmail ignores dots and "+tags".
export function normalizeEmailForDuplicates(email: string): string {
  const lower = email.trim().toLowerCase()
  const at = lower.lastIndexOf('@')
  if (at < 1) return lower
  let local = lower.slice(0, at)
  let domain = lower.slice(at + 1)
  const plus = local.indexOf('+')
  if (plus > 0) local = local.slice(0, plus)
  if (domain === 'googlemail.com') domain = 'gmail.com'
  if (domain === 'gmail.com') local = local.replace(/\./g, '')
  return `${local}@${domain}`
}

// CSV cell that is safe to open in Excel/Sheets: quotes are doubled, and a cell
// that starts with = + - @ (or a control character) is neutralised so it cannot
// run as a formula ("CSV injection").
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',')
}

// Keep strings that go into analytics short and plain. Returns null when the
// value is missing or contains anything unexpected.
export function cleanTag(value: unknown, maxLength = 64): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim().toLowerCase().slice(0, maxLength)
  return /^[a-z0-9][a-z0-9 _.\-]*$/.test(text) ? text : null
}

// Only the path is ever stored, never the query string or fragment, because
// those can carry tokens or personal data.
export function cleanPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const path = value.split(/[?#]/)[0].slice(0, 200)
  // "//host" is a protocol-relative URL (another website), not a path.
  if (path.startsWith('//')) return null
  if (!/^\/[A-Za-z0-9\-._~/%]*$/.test(path)) return null
  return normalizePath(path)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A URL segment that is really an identifier or a secret, not a page name.
function looksLikeId(segment: string): boolean {
  if (UUID.test(segment)) return true
  if (/^\d{5,}$/.test(segment)) return true // long numbers
  if (/^[0-9a-f]{16,}$/i.test(segment)) return true // hex tokens
  if (segment.includes('%')) return true // encoded text such as an email
  // long mixed tokens (reset links, share codes); page names are short words
  return (
    segment.length >= 20 &&
    /^[A-Za-z0-9_-]+$/.test(segment) &&
    /[0-9]/.test(segment)
  )
}

// /chat/<match id> -> /chat/:id. Without this the dashboard would list who chats,
// who is booked and which chef pages are viewed, by member id. Page NAMES stay.
export function normalizePath(path: string): string {
  return path
    .split('/')
    .map((segment) => (segment && looksLikeId(segment) ? ':id' : segment))
    .join('/')
}

// True when the request says it came from this site's own pages. Browsers always
// send an Origin header on a POST; a missing or different one is refused. This
// stops OTHER websites from using a visitor's browser to post to us. It does not
// stop a scripted client, which can forge the header.
export function isSameOrigin(
  origin: string | null | undefined,
  host: string | null | undefined,
): boolean {
  if (!origin || !host) return false
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase()
  } catch {
    return false
  }
}
