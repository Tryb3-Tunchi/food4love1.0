'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function VerifyPage() {
  return (
    <div className="theme-buyer f4l-auth-grid flex min-h-screen items-center justify-center px-6 py-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="f4l-auth-panel w-full max-w-lg rounded-[2.5rem] p-8 text-center sm:p-10"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.8rem] bg-mint text-meadow shadow-card">
          <Mail className="h-9 w-9" />
        </div>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-sage px-3 py-1.5 text-xs font-semibold text-meadow">
          <Sparkles className="h-3.5 w-3.5" />
          One more step
        </div>
        <h1 className="mt-4 font-heading text-4xl font-bold tracking-[-0.04em] text-ink">
          Check your email
        </h1>
        <p className="mx-auto mt-4 max-w-md text-body text-sm leading-7 sm:text-base">
          We sent a verification link to your email. Open it to activate your
          account and continue into Food4Love.
        </p>
        <Link href="/login" className="mt-8 inline-flex">
          <Button size="lg" className="w-full sm:w-auto">
            Back to sign in
          </Button>
        </Link>
      </motion.div>
    </div>
  )
}
