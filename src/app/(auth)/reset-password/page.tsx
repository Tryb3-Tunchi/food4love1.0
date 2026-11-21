'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Lock } from 'lucide-react'
import { Brand } from '@/components/ui/Brand'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Phase = { name: 'ready' } | { name: 'problem' } | { name: 'done' }

// The one-time token in the emailed link sits after the "#", which browsers never send to a
// server, so it is in no access log. It is read once, removed from the address bar, and kept only
// in memory for this visit.
function readTokenFromHash(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const token = params.get('token')
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname)
  }
  return token
}

export default function ResetPasswordPage() {
  // `undefined` = not read yet. Refs survive React's double effect run in development; a second read
  // would find the already-removed fragment and wrongly decide there is no link.
  const tokenRef = useRef<string | null | undefined>(undefined)
  const [phase, setPhase] = useState<Phase>({ name: 'ready' })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (tokenRef.current === undefined) tokenRef.current = readTokenFromHash()
    if (!tokenRef.current) setPhase({ name: 'problem' })
  }, [])

  // Move focus to the new heading when the screen changes, for keyboard and screen readers.
  useEffect(() => {
    if (phase.name !== 'ready') headingRef.current?.focus()
  }, [phase.name])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password.length < 10) return setError('Use at least 10 characters.')
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
      return setError('Include at least one letter and one number.')
    if (password !== confirm) return setError('The two passwords do not match.')

    setSubmitting(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenRef.current, password }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.ok && body.ok) {
        // The link is used up; do not keep the token or the password around.
        tokenRef.current = null
        setPassword('')
        setConfirm('')
        setPhase({ name: 'done' })
        return
      }
      if (response.status === 410) {
        tokenRef.current = null
        setPhase({ name: 'problem' })
        return
      }
      setError(body.error || 'Something went wrong. Please try again.')
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
              A fresh start, one new password away.
            </h1>
            <p className="text-white/76 mt-5 max-w-md text-base leading-8">
              Choose something only you know. We&rsquo;ll sign you out
              everywhere so your account stays yours.
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

            {phase.name === 'problem' && (
              <div role="alert">
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="font-heading text-3xl font-bold tracking-[-0.04em] text-ink outline-none"
                >
                  This reset link is not valid
                </h2>
                <p className="mt-3 text-body text-sm leading-7">
                  It may have expired, or it may already have been used. Reset
                  links work once and only for a short time. Request a new one
                  and we&rsquo;ll email it straight away.
                </p>
                <Link
                  href="/forgot-password"
                  className="mt-6 inline-flex min-h-11 items-center font-semibold text-[color:var(--accent)] hover:underline"
                >
                  Request a new link
                </Link>
              </div>
            )}

            {phase.name === 'ready' && (
              <>
                <div className="mb-8">
                  <h2
                    ref={headingRef}
                    tabIndex={-1}
                    className="font-heading text-4xl font-bold tracking-[-0.04em] text-ink outline-none"
                  >
                    Choose a new password
                  </h2>
                  <p className="mt-3 text-body text-sm leading-7">
                    Pick a password you don&rsquo;t use anywhere else.
                  </p>
                </div>

                <form onSubmit={submit} className="space-y-4" noValidate>
                  <Input
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    leftIcon={<Lock className="h-4 w-4" />}
                    hint="At least 10 characters, with a letter and a number."
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    leftIcon={<Lock className="h-4 w-4" />}
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
                      !submitting ? (
                        <ArrowRight className="h-4 w-4" />
                      ) : undefined
                    }
                    className="mt-2"
                  >
                    Update password
                  </Button>
                </form>
              </>
            )}

            {phase.name === 'done' && (
              <div role="status">
                <CheckCircle2
                  className="h-10 w-10 text-[color:var(--accent)]"
                  aria-hidden="true"
                />
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="mt-4 font-heading text-3xl font-bold tracking-[-0.04em] text-ink outline-none"
                >
                  Your password has been updated
                </h2>
                <p className="mt-3 text-body text-sm leading-7">
                  For your security you&rsquo;ve been signed out everywhere.
                  Sign in with your new password.
                </p>
                <Link
                  href="/login?reset=1"
                  className="mt-6 inline-flex min-h-11 items-center rounded-full px-6 font-semibold text-white [background:var(--accent)] hover:opacity-90"
                >
                  Go to sign in
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
