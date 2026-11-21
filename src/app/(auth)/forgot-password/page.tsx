'use client'

import Link from 'next/link'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, KeyRound, Mail } from 'lucide-react'
import { Brand } from '@/components/ui/Brand'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

// Same wording whether or not the address has an account (the server answers identically).
const SENT_MESSAGE =
  "If an account uses that email address, we've sent a link to reset its password. It can take a few minutes to arrive, so check your spam folder too."

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const value = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value))
      return setError('Enter a valid email address.')

    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.ok) setSent(true)
      else
        setError(
          body.error ||
            'Something went wrong. Please try again in a few minutes.',
        )
    } catch {
      setError(
        'We could not reach Food4Love. Check your connection and try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="theme-buyer f4l-auth-grid px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] max-w-7xl gap-6 lg:grid-cols-[0.94fr_1.06fr]">
        <div className="f4l-auth-spotlight hidden rounded-[2.75rem] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="relative z-10">
            <Brand href="/" size="large" tone="dark" />
            <h1 className="mt-10 max-w-md font-heading text-5xl font-bold leading-[1.02] tracking-[-0.05em]">
              Locked out? We&rsquo;ll get you back to the table.
            </h1>
            <p className="text-white/76 mt-5 max-w-md text-base leading-8">
              Tell us the email address you signed up with and we&rsquo;ll send
              you a secure link to choose a new password.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="f4l-auth-panel w-full max-w-xl rounded-[2.5rem] p-6 sm:p-8 lg:p-10"
          >
            <Brand href="/" size="regular" className="mb-8 lg:hidden" />

            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-meadow">
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                Password help
              </div>
              <h2 className="mt-4 font-heading text-4xl font-bold tracking-[-0.04em] text-ink">
                Forgot your password?
              </h2>
              <p className="mt-3 text-body text-sm leading-7">
                Enter your email address and we&rsquo;ll send you a link to
                reset it.
              </p>
            </div>

            {sent ? (
              <div role="status">
                <p className="rounded-2xl bg-mint px-4 py-4 text-sm leading-7 text-meadow">
                  {SENT_MESSAGE}
                </p>
                <Link
                  href="/login"
                  className="mt-6 inline-flex min-h-11 items-center font-semibold text-[color:var(--accent)] hover:underline"
                >
                  Back to sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4" noValidate>
                <Input
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  leftIcon={<Mail className="h-4 w-4" />}
                />
                <div role="alert" aria-live="assertive">
                  {error && (
                    <p className="text-sm font-medium text-[color:var(--danger)]">
                      {error}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  loading={submitting}
                  rightIcon={
                    !submitting ? <ArrowRight className="h-4 w-4" /> : undefined
                  }
                  className="mt-2"
                >
                  Send reset link
                </Button>
                <p className="text-center text-sm">
                  <Link
                    href="/login"
                    className="inline-flex min-h-11 items-center font-semibold text-[color:var(--accent)] hover:underline"
                  >
                    Back to sign in
                  </Link>
                </p>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
