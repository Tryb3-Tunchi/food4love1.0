'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react'

export default function WalletTopupVerification({
  reference,
}: {
  reference: string
}) {
  const router = useRouter()
  const [state, setState] = useState<'checking' | 'success' | 'error'>(
    'checking',
  )
  const [message, setMessage] = useState('Verifying your Paystack payment…')

  useEffect(() => {
    if (!reference) {
      setState('error')
      setMessage('The payment reference is missing.')
      return
    }
    const controller = new AbortController()
    fetch('/api/wallet/topup/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok)
          throw new Error(result.error || 'Payment verification failed')
        setState('success')
        setMessage('Your wallet has been credited.')
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setState('error')
        setMessage(
          cause instanceof Error
            ? cause.message
            : 'Payment verification failed',
        )
      })
    return () => controller.abort()
  }, [reference])

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[var(--bg)] px-4 py-12 text-[var(--text-1)]">
      <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-center shadow-lg">
        {state === 'checking' ? (
          <LoaderCircle className="mx-auto h-9 w-9 animate-spin text-[var(--accent)]" />
        ) : state === 'success' ? (
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        ) : (
          <TriangleAlert className="mx-auto h-10 w-10 text-amber-500" />
        )}
        <h1 className="mt-4 text-xl font-bold">
          {state === 'checking'
            ? 'Checking payment'
            : state === 'success'
              ? 'Payment received'
              : 'Payment not confirmed'}
        </h1>
        <p
          role={state === 'error' ? 'alert' : 'status'}
          className="mt-2 text-sm text-[var(--text-3)]"
        >
          {message}
        </p>
        {state !== 'checking' && (
          <Link
            href="/profile"
            onClick={() => router.refresh()}
            className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white"
          >
            Return to profile
          </Link>
        )}
      </section>
    </main>
  )
}
