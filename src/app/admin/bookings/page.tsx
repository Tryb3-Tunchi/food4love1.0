'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, RotateCcw, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { STATUS_LABELS, type BookingStatus } from '@/lib/booking/lifecycle'

interface RefundRecord {
  id: string
  amount_kobo: number
  reason: string
  status: string
  provider_refund_id: string | null
  created_at: string
}

interface BookingRecord {
  id: string
  buyer_id: string
  cook_id: string
  status: string
  payment_status: string
  payment_reference: string | null
  amount: number | null
  price: number
  created_at: string
  scheduled_for?: string | null
  service_type?: string | null
  buyer?: { id: string; full_name: string } | null
  cook?: { id: string; full_name: string } | null
  payment_refunds?: RefundRecord[]
}

interface Demand {
  cook_id: string
  name: string
  state: string
  active: number
  notify: number
}

const naira = (amount: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(
    amount,
  )

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refunding, setRefunding] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [demand, setDemand] = useState<Demand[] | null>(null)
  const [interestTotals, setInterestTotals] = useState<{
    active: number
    fulfilled: number
    withdrawn: number
  } | null>(null)
  const [pendingVerification, setPendingVerification] = useState<number | null>(
    null,
  )
  const [openDisputes, setOpenDisputes] = useState<number | null>(null)
  const [paymentsConfigured, setPaymentsConfigured] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  async function loadBookings() {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/bookings', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not load bookings')
      setBookings(result.bookings ?? [])
      setCounts(result.counts ?? {})
      setDemand(result.interests?.demand ?? null)
      setInterestTotals(result.interests?.totals ?? null)
      setPendingVerification(result.pending_verification ?? null)
      setOpenDisputes(result.open_disputes ?? null)
      setPaymentsConfigured(result.payments_configured !== false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not load bookings',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBookings()
  }, [])

  async function requestRefund(booking: BookingRecord) {
    const paidAmount = Number(booking.amount ?? booking.price ?? 0)
    const amountInput = window.prompt(
      `Refund amount in NGN. Maximum: ${paidAmount}`,
    )
    if (!amountInput) return
    const amount = Number(amountInput)
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > paidAmount) {
      toast.error('Enter a whole NGN amount within the paid total')
      return
    }
    const reason = window.prompt('Reason for refund (at least 10 characters):')
    if (!reason?.trim() || reason.trim().length < 10) return

    setRefunding(booking.id)
    try {
      const response = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking.id,
          amount_ngn: amount,
          reason: reason.trim(),
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not request refund')
      toast.success('Refund sent to Paystack and marked pending reconciliation')
      await loadBookings()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not request refund',
      )
    } finally {
      setRefunding(null)
    }
  }

  async function reconcileRefund(refund: RefundRecord) {
    if (!refund.provider_refund_id) {
      toast.error(
        'Paystack did not return a refund ID; reconcile this request manually before retrying',
      )
      return
    }
    const confirmation = window.prompt(
      `Confirm refund is processed in Paystack by entering this ID exactly: ${refund.provider_refund_id}`,
    )
    if (confirmation !== refund.provider_refund_id) return
    const verificationReason = window.prompt(
      'Record how you verified settlement in Paystack (minimum 10 characters):',
    )
    if (!verificationReason?.trim() || verificationReason.trim().length < 10)
      return

    setRefunding(refund.id)
    try {
      const response = await fetch('/api/admin/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refund_id: refund.id,
          provider_refund_id: confirmation,
          verification_reason: verificationReason.trim(),
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not reconcile refund')
      toast.success(
        result.booking_fully_refunded
          ? 'Refund settled; booking marked refunded'
          : 'Refund settlement recorded',
      )
      await loadBookings()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not reconcile refund',
      )
    } finally {
      setRefunding(null)
    }
  }

  const needle = search.trim().toLowerCase()
  const visible = bookings.filter((booking) => {
    if (filter !== 'all' && booking.status !== filter) return false
    if (!needle) return true
    return (
      booking.id.toLowerCase().includes(needle) ||
      (booking.buyer?.full_name ?? '').toLowerCase().includes(needle) ||
      (booking.cook?.full_name ?? '').toLowerCase().includes(needle)
    )
  })
  const filters: { key: string; label: string }[] = [
    { key: 'all', label: 'All' },
    ...(
      [
        'pending',
        'alternative_proposed',
        'confirmed',
        'completed',
        'cancelled',
      ] as BookingStatus[]
    ).map((key) => ({ key, label: STATUS_LABELS[key] })),
  ]

  return (
    <div className="mx-auto min-h-screen max-w-7xl bg-char p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bookings & payments</h1>
          <p className="mt-1 text-sm text-mist">
            Payment status is verified separately from refund settlement.
          </p>
        </div>
        <button
          onClick={loadBookings}
          disabled={loading}
          aria-label="Refresh bookings"
          className="rounded-lg border border-white/10 p-2 text-white hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {!paymentsConfigured && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200"
        >
          Online payment is not configured on this site, so customers cannot pay
          yet. Bookings stay unpaid and nothing is marked paid.
        </p>
      )}

      <section
        aria-label="Booking summary"
        className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <Link
          href="/admin/kyc"
          className="rounded-xl border border-white/10 p-3 hover:bg-white/5"
        >
          <span className="block text-xs uppercase text-mist">
            Cooks awaiting verification
          </span>
          <span className="text-2xl font-bold text-white">
            {pendingVerification ?? '–'}
          </span>
        </Link>
        <Link
          href="/admin/disputes"
          className="rounded-xl border border-white/10 p-3 hover:bg-white/5"
        >
          <span className="block text-xs uppercase text-mist">
            Open disputes
          </span>
          <span className="text-2xl font-bold text-white">
            {openDisputes ?? '–'}
          </span>
        </Link>
        <div className="rounded-xl border border-white/10 p-3">
          <span className="block text-xs uppercase text-mist">
            Interest requests (active)
          </span>
          <span className="text-2xl font-bold text-white">
            {interestTotals?.active ?? '–'}
          </span>
        </div>
        <div className="rounded-xl border border-white/10 p-3">
          <span className="block text-xs uppercase text-mist">
            Interest fulfilled
          </span>
          <span className="text-2xl font-bold text-white">
            {interestTotals?.fulfilled ?? '–'}
          </span>
        </div>
      </section>

      <div
        className="mb-4 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filter by booking state"
      >
        {filters.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
            className={`min-h-10 rounded-full border px-3 text-xs font-semibold ${
              filter === item.key
                ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200'
                : 'border-white/10 text-white/80 hover:bg-white/5'
            }`}
          >
            {item.label}
            <span className="ml-1.5 text-mist">
              {item.key === 'all'
                ? Object.values(counts).reduce((a, b) => a + b, 0)
                : (counts[item.key] ?? 0)}
            </span>
          </button>
        ))}
        <label className="relative ml-auto">
          <span className="sr-only">Search bookings</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or booking ID"
            className="min-h-10 w-64 rounded-lg border border-white/10 bg-transparent pl-9 pr-3 text-sm text-white placeholder:text-mist"
          />
        </label>
      </div>

      {demand && demand.length > 0 && (
        <section
          aria-label="Demand waiting on verification"
          className="mb-6 rounded-xl border border-white/10 p-4"
        >
          <h2 className="text-sm font-semibold text-white">
            Demand waiting on verification
          </h2>
          <p className="mt-1 text-xs text-mist">
            Customers who asked to be told when a cook becomes available. Counts
            only; customers are not shown.
          </p>
          <ul className="mt-3 divide-y divide-white/5 text-sm">
            {demand.map((row) => (
              <li
                key={row.cook_id}
                className="flex items-center justify-between gap-3 py-2 text-white/80"
              >
                <span>
                  {row.name}
                  <span className="ml-2 text-xs capitalize text-mist">
                    {row.state}
                  </span>
                </span>
                <span>
                  {row.active} interested
                  <span className="ml-2 text-xs text-mist">
                    {row.notify} want an update
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading ? (
        <p className="py-10 text-sm text-mist">Loading bookings...</p>
      ) : (
        <div className="overflow-x-auto border-y border-white/10">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-mist">
              <tr>
                <th className="py-3 pr-4">Booking</th>
                <th className="py-3 pr-4">Buyer / cook</th>
                <th className="py-3 pr-4">Created</th>
                <th className="py-3 pr-4">Booking state</th>
                <th className="py-3 pr-4">Payment</th>
                <th className="py-3 pr-4">Refund requests</th>
                <th className="py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((booking) => {
                const amount = Number(booking.amount ?? booking.price ?? 0)
                const inFlight = (booking.payment_refunds ?? []).some(
                  (refund) => ['requested', 'pending'].includes(refund.status),
                )
                return (
                  <tr
                    key={booking.id}
                    className="border-b border-white/5 align-top text-white/80"
                  >
                    <td className="py-3 pr-4">
                      <span className="block font-mono text-xs">
                        {booking.id.slice(0, 8)}
                      </span>
                      <span className="text-white">{naira(amount)}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="block">
                        {booking.buyer?.full_name ?? 'Buyer'}
                      </span>
                      <span className="text-xs text-mist">
                        Cook: {booking.cook?.full_name ?? 'Cook'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4">
                      {new Date(booking.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4">
                      {STATUS_LABELS[booking.status as BookingStatus] ??
                        booking.status}
                      {booking.scheduled_for && (
                        <span className="block text-xs text-mist">
                          For {new Date(booking.scheduled_for).toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="block capitalize">
                        {booking.payment_status}
                      </span>
                      <span className="font-mono text-xs text-mist">
                        {booking.payment_reference ?? 'No reference'}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {(booking.payment_refunds ?? []).length ? (
                        booking.payment_refunds?.map((refund) => (
                          <div key={refund.id} className="mb-2">
                            <span className="capitalize">{refund.status}</span>{' '}
                            · {naira(refund.amount_kobo / 100)}
                            <p className="max-w-xs text-xs text-mist">
                              {refund.reason}
                            </p>
                            {refund.status === 'pending' && (
                              <button
                                onClick={() => reconcileRefund(refund)}
                                disabled={refunding === refund.id}
                                className="mt-1 rounded border border-emerald-500/20 px-2 py-1 text-[10px] text-emerald-300 disabled:opacity-40"
                              >
                                {refunding === refund.id
                                  ? 'Saving...'
                                  : 'Record verified settlement'}
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className="text-mist">None</span>
                      )}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => requestRefund(booking)}
                        disabled={
                          booking.payment_status !== 'paid' ||
                          inFlight ||
                          refunding === booking.id
                        }
                        title={
                          booking.payment_status !== 'paid'
                            ? 'Only paid bookings are eligible'
                            : inFlight
                              ? 'A refund is already pending'
                              : 'Request Paystack refund'
                        }
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {refunding === booking.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        Request refund
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!visible.length && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-mist">
                    {bookings.length
                      ? 'No bookings match this filter.'
                      : 'No bookings recorded.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
