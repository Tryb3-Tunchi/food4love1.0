import Link from 'next/link'
import { LegalFooter } from '@/components/legal/LegalFooter'

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
        <Link
          href="/waitlist"
          className="font-heading text-lg font-bold"
          style={{ color: 'var(--text-1)' }}
        >
          Food4Love
        </Link>
        <Link
          href="/legal"
          className="text-sm underline"
          style={{ color: 'var(--text-2)' }}
        >
          All legal information
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 pb-10">
        <LegalFooter />
      </footer>
    </div>
  )
}
