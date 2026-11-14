import Link from 'next/link'

// Compact links to the key legal pages. Shown on the waitlist page and the legal pages.
export function LegalFooter({ className = '' }: { className?: string }) {
  const links = [
    ['/terms', 'Terms'],
    ['/privacy', 'Privacy'],
    ['/cookies', 'Cookies & privacy choices'],
    ['/community-guidelines', 'Community guidelines'],
    ['/safety', 'Safety'],
    ['/email-consent', 'Email consent'],
  ] as const
  return (
    <nav
      aria-label="Legal"
      className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs ${className}`}
    >
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          className="underline-offset-2 hover:underline"
          style={{ color: 'var(--text-3)' }}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
