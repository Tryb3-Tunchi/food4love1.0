'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Check, ChefHat, MapPin, Utensils } from 'lucide-react'

export function WaitlistLanding() {
  const [email, setEmail] = useState('')
  const [audience, setAudience] = useState<'food_lover' | 'cook'>('food_lover')
  const [updatesConsent, setUpdatesConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >('idle')

  const joinWaitlist = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('submitting')

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, audience, updatesConsent, website }),
      })

      if (!response.ok) throw new Error('Waitlist signup failed')
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  return (
    <main className="relative isolate flex min-h-screen items-center overflow-hidden bg-cream px-5 py-8 text-ink sm:px-8">
      <div
        className="waitlist-map-bg pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
      />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-cream/75 via-cream/90 to-cream" />

      <div className="mx-auto w-full max-w-6xl">
        <header className="flex items-center justify-between">
          <Link
            href="/waitlist"
            className="inline-flex items-center gap-3"
            aria-label="Food4Love home"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-meadow text-white shadow-card">
              <ChefHat className="h-5 w-5" />
            </span>
            <span className="font-heading text-xl font-extrabold">
              Food<span className="text-pepper">4</span>Love
            </span>
          </Link>
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-body text-sm font-semibold transition hover:bg-white/70 hover:text-ink"
          >
            Already a member? Sign in
          </Link>
        </header>

        <div className="grid items-center gap-12 py-16 lg:grid-cols-[1fr_0.82fr] lg:py-24">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-2xl"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-meadow/15 bg-white/75 px-3.5 py-2 text-xs font-bold uppercase text-meadow">
              <span className="h-2 w-2 animate-pulse rounded-full bg-pepper" />
              Pre-launch list is open
            </div>
            <h1 className="font-heading text-5xl font-bold leading-[1.03] sm:text-6xl lg:text-7xl">
              Good food is closer than you think.
            </h1>
            <p className="mt-6 max-w-xl text-base text-body leading-8 sm:text-lg">
              We are bringing neighborhood home cooks and the people who love
              their food together. Join the early list for launch news and a
              first taste of what is next.
            </p>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-body text-sm font-semibold">
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-meadow" />
                Local cooks, discovered nearby
              </span>
              <span className="inline-flex items-center gap-2">
                <Utensils className="h-4 w-4 text-pepper" />
                Meals made in real kitchens
              </span>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.12 }}
            className="relative"
            aria-labelledby="waitlist-title"
          >
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-meadow/10 blur-2xl" />
            <div className="rounded-2xl border border-white/80 bg-white/90 p-6 shadow-float backdrop-blur-md sm:p-9">
              {status === 'success' ? (
                <div className="py-8 text-center" role="status">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-mint text-meadow">
                    <Check className="h-7 w-7" />
                  </span>
                  <h2
                    id="waitlist-title"
                    className="mt-5 font-heading text-2xl font-bold"
                  >
                    You are on the list.
                  </h2>
                  <p className="mt-2 text-body text-sm leading-6">
                    We will be in touch when Food4Love is ready to welcome you.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-bold uppercase text-pepper">
                    A seat at the table
                  </p>
                  <h2
                    id="waitlist-title"
                    className="mt-2 font-heading text-2xl font-bold sm:text-3xl"
                  >
                    Get launch updates
                  </h2>
                  <p className="mt-2 text-body text-sm leading-6">
                    Tell us where you fit and we will keep you posted.
                  </p>

                  <form onSubmit={joinWaitlist} className="mt-6 space-y-5">
                    <div
                      className="grid grid-cols-2 gap-2"
                      role="group"
                      aria-label="I am joining as a"
                    >
                      <button
                        type="button"
                        aria-pressed={audience === 'food_lover'}
                        onClick={() => setAudience('food_lover')}
                        className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${audience === 'food_lover' ? 'border-meadow bg-mint text-meadow' : 'border-border bg-white text-body hover:bg-cream'}`}
                      >
                        <Utensils className="h-4 w-4" /> Food lover
                      </button>
                      <button
                        type="button"
                        aria-pressed={audience === 'cook'}
                        onClick={() => setAudience('cook')}
                        className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${audience === 'cook' ? 'border-pepper bg-blush text-pepper' : 'border-border bg-white text-body hover:bg-cream'}`}
                      >
                        <ChefHat className="h-4 w-4" /> Home cook
                      </button>
                    </div>

                    <div>
                      <label
                        htmlFor="waitlist-email"
                        className="mb-2 block text-sm font-semibold"
                      >
                        Email address
                      </label>
                      <input
                        id="waitlist-email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        className="h-12 w-full rounded-lg border border-border bg-white px-4 text-sm outline-none transition placeholder:text-muted focus:border-meadow focus:ring-2 focus:ring-meadow/15"
                      />
                    </div>

                    <label className="flex items-start gap-3 text-body text-xs leading-5">
                      <input
                        type="checkbox"
                        checked={updatesConsent}
                        onChange={(event) =>
                          setUpdatesConsent(event.target.checked)
                        }
                        className="mt-1 h-4 w-4 shrink-0 accent-meadow"
                      />
                      <span>
                        Also send me launch news, occasional product updates,
                        and early-member offers. I can unsubscribe at any time.
                      </span>
                    </label>

                    <div
                      className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
                      aria-hidden="true"
                    >
                      <label htmlFor="waitlist-website">
                        Leave this field empty
                      </label>
                      <input
                        id="waitlist-website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={website}
                        onChange={(event) => setWebsite(event.target.value)}
                      />
                    </div>

                    {status === 'error' && (
                      <p
                        className="text-sm font-medium text-red-700"
                        role="alert"
                      >
                        We could not save your signup. Please try again.
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={status === 'submitting'}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-pepper px-5 text-sm font-bold text-white shadow-warm transition hover:bg-[#d9482a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pepper focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
                    >
                      {status === 'submitting'
                        ? 'Adding you...'
                        : 'Join the waitlist'}
                      {status !== 'submitting' && (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </button>
                    <p className="text-center text-xs text-muted">
                      Joining the list does not create an account.
                    </p>
                  </form>
                </>
              )}
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  )
}
