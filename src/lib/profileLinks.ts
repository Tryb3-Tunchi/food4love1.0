// Pure module with NO imports so it can be unit-tested with node --test.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

// Where a "back" link is allowed to point. Anything else is ignored, so a crafted
// ?from= value can never send someone to another website or an arbitrary page.
const RETURN_PATTERNS: { test: RegExp; label: string }[] = [
  {
    test: /^\/matches(\?tab=(matches|received|sent|activity))?$/,
    label: 'Back to Matches',
  },
  { test: /^\/likes$/, label: 'Back to Likes' },
  { test: /^\/map$/, label: 'Back to the map' },
  { test: /^\/swipe$/, label: 'Back to Discover' },
  { test: /^\/requests$/, label: 'Back to Requests' },
  { test: /^\/chat$/, label: 'Back to Chat' },
  {
    test: /^\/chat\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    label: 'Back to the conversation',
  },
]

export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 80) return null
  return RETURN_PATTERNS.some((p) => p.test.test(value)) ? value : null
}

export function returnLabel(path: string | null): string {
  if (!path) return 'Back'
  return RETURN_PATTERNS.find((p) => p.test.test(path))?.label ?? 'Back'
}

// Chefs have the public chef page; every other member has the member page.
// Returns null for anything that is not a real id and a known role, so a broken
// row can never produce a link to the wrong place.
export function profileHref(
  profile: { id?: unknown; role?: unknown } | null | undefined,
  from?: string | null,
): string | null {
  if (!profile || !isUuid(profile.id)) return null
  const base =
    profile.role === 'cook'
      ? `/cook/${profile.id}`
      : profile.role === 'buyer'
        ? `/member/${profile.id}`
        : null
  if (!base) return null
  const back = safeReturnPath(from)
  return back ? `${base}?from=${encodeURIComponent(back)}` : base
}
