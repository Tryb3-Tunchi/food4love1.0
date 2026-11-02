'use client'

import { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  Heart,
  LoaderCircle,
  Share2,
  Wallet,
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Role } from '@/types/db'

interface WalletInfo {
  referral_code: string | null
  balance_naira: number
  referral_count: number
  completed_referrals: number
  transactions: Array<{
    id: string
    amount_naira: number
    transaction_type: string
    created_at: string
  }>
  pending_topups: Array<{
    amount_naira: number
    paystack_reference: string
    created_at: string
  }>
}

const REWARD_LABELS: Record<string, string> = {
  referral_signup: 'Signup referral reward',
  referral_second_milestone: 'Referral milestone reward',
  paystack_topup: 'Wallet top-up',
  booking_payment: 'Booking payment',
}

export function WalletRewardsCard({ role }: { role: Role }) {
  const [wallet, setWallet] = useState<WalletInfo | null>(null)
  const [amount, setAmount] = useState('5000')
  const [loading, setLoading] = useState(true)
  const [funding, setFunding] = useState(false)
  const [verifyingReference, setVerifyingReference] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/wallet', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok)
          throw new Error(result.error || 'Could not load rewards')
        setWallet(result)
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(
          cause instanceof Error ? cause.message : 'Could not load rewards',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const shareReferral = async () => {
    if (!wallet?.referral_code) return
    const link = `${window.location.origin}/signup?ref=${encodeURIComponent(wallet.referral_code)}`
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Your referral link was copied')
    } catch {
      toast.error('Could not copy the referral link')
    }
  }

  const addFunds = async () => {
    const amountNaira = Number(amount)
    if (
      !Number.isInteger(amountNaira) ||
      amountNaira < 500 ||
      amountNaira > 500000
    ) {
      toast.error('Choose an amount from ₦500 to ₦500,000')
      return
    }
    setFunding(true)
    try {
      const response = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_naira: amountNaira }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not start wallet funding')
      window.location.assign(result.authorization_url)
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : 'Could not start wallet funding',
      )
      setFunding(false)
    }
  }

  const verifyPendingTopup = async (reference: string) => {
    setVerifyingReference(reference)
    try {
      const response = await fetch('/api/wallet/topup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not verify payment')
      const refresh = await fetch('/api/wallet', { cache: 'no-store' })
      if (refresh.ok) setWallet(await refresh.json())
      toast.success('Wallet payment verified')
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : 'Could not verify payment',
      )
    } finally {
      setVerifyingReference('')
    }
  }

  return (
    <section
      aria-labelledby="wallet-rewards-heading"
      className="f4l-card p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'var(--accent-l)' }}
        >
          <Wallet className="h-5 w-5" style={{ color: 'var(--accent)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="wallet-rewards-heading"
            className="text-sm font-bold"
            style={{ color: 'var(--text-1)' }}
          >
            Wallet &amp; referrals
          </h2>
          {loading ? (
            <p
              className="mt-2 flex items-center gap-2 text-xs"
              style={{ color: 'var(--text-3)' }}
            >
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Loading
              wallet…
            </p>
          ) : error ? (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {error}
            </p>
          ) : (
            <>
              <p
                className="mt-1 text-2xl font-bold"
                style={{ color: 'var(--text-1)' }}
              >
                ₦{(wallet?.balance_naira ?? 0).toLocaleString()}
              </p>
              <p
                className="mt-1 text-xs leading-5"
                style={{ color: 'var(--text-3)' }}
              >
                Your friend’s email-confirmed signup earns ₦500. Their first
                paid booking earns another ₦500; for cooks, full KYC
                verification also qualifies.
              </p>
            </>
          )}
        </div>
      </div>

      {wallet && (
        <>
          {wallet.pending_topups.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs font-semibold text-[var(--text-1)]">
                A wallet payment may still need verification
              </p>
              {wallet.pending_topups.map((topup) => (
                <div
                  key={topup.paystack_reference}
                  className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <span className="text-[var(--text-2)]">
                    ₦{topup.amount_naira.toLocaleString()} ·{' '}
                    {new Date(topup.created_at).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void verifyPendingTopup(topup.paystack_reference)
                    }
                    disabled={Boolean(verifyingReference)}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 font-semibold text-[var(--text-1)] disabled:opacity-50"
                  >
                    {verifyingReference === topup.paystack_reference && (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Verify payment
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void shareReferral()}
              disabled={!wallet.referral_code}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              <Share2 className="h-4 w-4" /> Share referral link
            </button>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>
              {wallet.referral_count} joined · {wallet.completed_referrals}{' '}
              completed both milestones
            </span>
          </div>

          {role === 'buyer' ? (
            <div
              className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row"
              style={{ borderColor: 'var(--divider)' }}
            >
              <label
                className="min-w-0 flex-1 text-xs font-semibold"
                style={{ color: 'var(--text-2)' }}
              >
                Add money with Paystack
                <input
                  type="number"
                  min={500}
                  max={500000}
                  step={500}
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-1 min-h-10 w-full rounded-lg border bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--accent)]"
                  style={{
                    borderColor: 'var(--border)',
                    color: 'var(--text-1)',
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => void addFunds()}
                disabled={funding || loading || Boolean(error)}
                className="mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--text-1)' }}
              >
                {funding ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDownToLine className="h-4 w-4" />
                )}
                Add funds
              </button>
            </div>
          ) : (
            <p
              className="mt-4 border-t pt-3 text-xs leading-5"
              style={{ borderColor: 'var(--divider)', color: 'var(--text-3)' }}
            >
              Your referral rewards stay in this wallet. Booking and wallet
              payments are currently available to buyer accounts.
            </p>
          )}

          {wallet.transactions.length > 0 && (
            <ul
              aria-label="Recent wallet activity"
              className="mt-4 divide-y"
              style={{ borderColor: 'var(--divider)' }}
            >
              {wallet.transactions.slice(0, 5).map((transaction) => (
                <li
                  key={transaction.id}
                  className="flex items-center justify-between gap-3 py-2 text-xs"
                >
                  <span style={{ color: 'var(--text-2)' }}>
                    {REWARD_LABELS[transaction.transaction_type] ??
                      'Wallet activity'}
                  </span>
                  <span
                    className="shrink-0 font-semibold"
                    style={{
                      color:
                        transaction.amount_naira > 0
                          ? 'var(--success)'
                          : 'var(--text-1)',
                    }}
                  >
                    {transaction.amount_naira > 0 ? '+' : '−'}₦
                    {Math.abs(transaction.amount_naira).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p
            className="mt-2 flex items-center gap-1 text-[10px]"
            style={{ color: 'var(--text-3)' }}
          >
            <Heart className="h-3 w-3" /> Rewards are credited once per
            milestone.
          </p>
        </>
      )}
    </section>
  )
}
