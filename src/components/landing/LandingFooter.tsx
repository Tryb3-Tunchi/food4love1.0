import Link from 'next/link'
import { ChefHat } from 'lucide-react'

const FOOTER_LINKS = [
  { label: 'How it works', href: '#how' },
  { label: 'Featured chefs', href: '#chefs' },
  { label: 'Become a chef', href: '/signup?role=cook' },
  { label: 'Sign in', href: '/login' },
]

export function LandingFooter() {
  return (
    <footer className="bg-smoke px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-10 rounded-[2.25rem] border border-white/10 bg-white/5 p-6 sm:p-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-mint text-meadow shadow-sm">
                <ChefHat className="h-5 w-5" />
              </div>
              <span className="font-heading text-xl font-extrabold tracking-tight text-white">
                Food<span className="text-ember">4</span>Love
              </span>
            </div>
            <p className="mt-4 text-sm leading-7 text-white/65">
              A softer way to discover home chefs, book meals you actually want,
              and make dinner feel personal again.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm sm:grid-cols-4">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-white/70 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} Food4Love. All rights reserved.
          </span>
          <span>Built for home chefs, dinner plans, and everyday comfort.</span>
        </div>
      </div>
    </footer>
  )
}
