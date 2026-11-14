import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { returnLabel, safeReturnPath } from '@/lib/profileLinks'

// "Back to Matches" / "Back to the conversation" / "Back to the map".
// The destination comes from the address bar, so it is checked against an
// allow-list of in-app pages first; anything else falls back to Matches.
export function BackLink({ from }: { from?: string | string[] | null }) {
  const raw = Array.isArray(from) ? from[0] : from
  const path = safeReturnPath(raw) ?? '/matches'
  return (
    <Link
      href={path}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold"
      style={{ color: 'var(--accent)' }}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {safeReturnPath(raw) ? returnLabel(path) : 'Back to Matches'}
    </Link>
  )
}
