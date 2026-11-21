'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Lock, Sparkles } from 'lucide-react'
import { Brand } from '@/components/ui/Brand'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Problem = 'invalid' | 'expired' | 'revoked' | 'used' | 'unavailable'

type Phase =
  | { name: 'checking' }
  | { name: 'ready'; firstName: string; role: 'buyer' | 'cook'; label: string }
  | { name: 'problem'; reason: Problem }
  | { name: 'done' }

const PROBLEM_COPY: Record<Problem, { title: string; body: string }> = {
  invalid: {
    title: 'This invitation link is not valid',
    body: 'Check that you opened the latest email we sent you, or ask the Food4Love team for a new invitation.',
  },
  expired: {
    title: 'This invitation has expired',
    body: 'Invitations only last a few days. Ask the Food4Love team to send you a new one.',
  },
  revoked: {
    title: 'This invitation is no longer available',
    body: 'It was cancelled. If you think that is a mistake, ask the Food4Love team.',
  },
  used: {
    title: 'This invitation has already been used',
    body: 'If that was you, you can sign in with the password you chose.',
  },
  unavailable: {
    title: 'We could not check your invitation',
    body: 'Something went wrong on our side. Please try the link again in a moment.',
  },
}

// The secret in the link sits after the "#", which browsers never send to a server, so it
// is not in any access log. It is read once, removed from the address bar, and kept only
// in memory for this visit.
function readTokenFromHash(): string | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const token = params.get('token')
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname)
  }
  return token
}

export default function AcceptInvitationPage() {
  const tokenRef = useRef<string | null | undefined>(undefined)
  const [phase, setPhase] = useState<Phase>({ name: 'checking' })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    // Read the fragment ONCE. Reading it also removes it from the address bar, so a second
    // read (React runs effects twice in development) would find nothing and wrongly decide
    // there is no secret. `undefined` means "not read yet"; refs survive that second run.
    if (tokenRef.current === undefined) tokenRef.current = readTokenFromHash()
    const token = tokenRef.current
    if (!token) {
      setPhase({ name: 'problem', reason: 'invalid' })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const response = await fetch('/api/invitations/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const body = await response.json().catch(() => ({}))
        if (cancelled) return
        if (response.ok && body.valid) {
          setPhase({
            name: 'ready',
            firstName: body.first_name || '',
            role: body.profile_role === 'cook' ? 'cook' : 'buyer',
            label: body.access_label || '',
          })
        } else if (response.ok) {
          setPhase({
            name: 'problem',
            reason: (body.reason as Problem) ?? 'invalid',
          })
        } else {
          setPhase({ name: 'problem', reason: 'unavailable' })
        }
      } catch {
        if (!cancelled) setPhase({ name: 'problem', reason: 'unavailable' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Move focus to the new heading when the screen changes, for keyboard and screen readers.
  useEffect(() => {
    if (phase.name !== 'checking') headingRef.current?.focus()
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
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenRef.current, password }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.ok && body.ok) {
        setPhase({ name: 'done' })
        window.location.assign(body.redirectTo || '/onboarding/setup')
        return
      }
      if (response.status === 410) {
        setPhase({
          name: 'problem',
          reason: (body.code as Problem) ?? 'invalid',
        })
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

  const role = phase.name === 'ready' ? phase.role : 'buyer'

  return (
    <div
      className={`${role === 'cook' ? 'theme-cook' : 'theme-buyer'} f4l-auth-grid px-4 py-6 sm:px-6 lg:px-8`}
    >
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] max-w-7xl gap-6 lg:grid-cols-[0.94fr_1.06fr]">
        <div className="f4l-auth-spotlight hidden rounded-[2.75rem] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="relative z-10">
            <Brand href="/" size="large" tone="dark" />
            <h1 className="mt-10 max-w-md font-heading text-5xl font-bold leading-[1.02] tracking-[-0.05em]">
              Bringing people together, one meal at a time.
            </h1>
            <p className="text-white/76 mt-5 max-w-md text-base leading-8">
              You are among the first people to experience Food4Love. Your
              feedback helps us make it better.
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

            {phase.name === 'checking' && (
              <p role="status" className="text-body text-sm">
                Checking your invitation…
              </p>
            )}

            {phase.name === 'problem' && (
              <div role="alert">
                <h2
                  ref={headingRef}
                  tabIndex={-1}
                  className="font-heading text-3xl font-bold tracking-[-0.04em] text-ink outline-none"
                >
                  {PROBLEM_COPY[phase.reason].title}
                </h2>
                <p className="mt-3 text-body text-sm leading-7">
                  {PROBLEM_COPY[phase.reason].body}
                </p>
                <Link
                  href="/login"
                  className="mt-6 inline-flex min-h-11 items-center font-semibold text-[color:var(--accent)] hover:underline"
                >
                  Go to sign in
                </Link>
              </div>
            )}

            {phase.name === 'ready' && (
              <>
                <div className="mb-8">
                  <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold [background:var(--accent-soft)] [color:var(--accent)]">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    {phase.label ? `Invited as ${phase.label}` : 'Early access'}
                  </div>
                  <h2
                    ref={headingRef}
                    tabIndex={-1}
                    className="mt-4 font-heading text-4xl font-bold tracking-[-0.04em] text-ink outline-none"
                  >
                    Welcome to Food4Love! ❤️
                  </h2>
                  <p className="mt-3 text-body text-sm leading-7">
                    {phase.firstName ? `Hi ${phase.firstName}. ` : ''}
                    You&rsquo;ve been invited to experience Food4Love early. Set
                    up your password and let&rsquo;s get started.
                  </p>
                </div>

                <form onSubmit={submit} className="space-y-4" noValidate>
                  <Input
                    label="Create a password"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    leftIcon={<Lock className="h-4 w-4" />}
                    hint="At least 10 characters, with a letter and a number."
                  />
                  <Input
                    label="Confirm your password"
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
                    Set password and continue
                  </Button>
                </form>

                <p className="mt-6 text-center text-xs text-muted">
                  By continuing you agree to our{' '}
                  <Link href="/terms" className="underline hover:text-ink">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="underline hover:text-ink">
                    Privacy Policy
                  </Link>
                  . This invitation is for you and should not be shared.
                </p>
              </>
            )}

            {phase.name === 'done' && (
              <p role="status" className="text-body text-sm">
                You&rsquo;re all set. Taking you into Food4Love…
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
