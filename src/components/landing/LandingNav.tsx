'use client'

import Link from 'next/link'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChefHat, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const NAV_ITEMS = [
  { label: 'How it works', href: '#how' },
  { label: 'Featured chefs', href: '#chefs' },
  { label: 'For cooks', href: '#join' },
]

export function LandingNav() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="f4l-nav flex h-16 items-center justify-between rounded-full border border-border/80 bg-white/80 px-3 shadow-card sm:px-4">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-full px-2 py-1.5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-mint text-meadow shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
              <ChefHat className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <span className="font-heading text-lg font-extrabold tracking-tight text-ink sm:text-xl">
              Food<span className="text-pepper">4</span>Love
            </span>
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-full px-4 py-2 text-body text-sm font-medium transition-colors hover:bg-ivory hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <Link href="/login">
              <Button
                variant="secondary"
                size="md"
                pill
                className="border-border/80 bg-white/75 text-ink shadow-none hover:bg-ivory"
              >
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button
                size="md"
                pill
                className="bg-meadow text-white shadow-[0_10px_28px_rgba(47,106,67,0.18)] hover:bg-herb"
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Get started
              </Button>
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white/80 text-ink shadow-sm transition-colors hover:bg-ivory sm:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-white/92 mt-3 overflow-hidden rounded-[2rem] border border-border p-4 shadow-float sm:hidden"
            >
              <div className="flex flex-col gap-2">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-2xl px-4 py-3 text-body text-sm font-medium transition-colors hover:bg-ivory hover:text-ink"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2">
                <Link href="/login" onClick={() => setOpen(false)}>
                  <Button
                    variant="secondary"
                    size="lg"
                    fullWidth
                    pill
                    className="border-border/80 bg-white text-ink shadow-none hover:bg-ivory"
                  >
                    Sign in
                  </Button>
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)}>
                  <Button
                    size="lg"
                    fullWidth
                    pill
                    className="bg-meadow text-white hover:bg-herb"
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Get started
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  )
}
