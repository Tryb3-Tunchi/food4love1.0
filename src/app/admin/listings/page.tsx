'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'

interface Listing {
  id: string
  cook_id: string
  title: string
  description: string | null
  price: number
  image_url: string | null
  available_until: string
  moderation_status: 'active' | 'removed'
  moderation_reason: string | null
  created_at: string
  cook?: { full_name: string; role: string; suspended: boolean } | null
}

export default function AdminListingsPage() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  async function loadListings() {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/listings', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not load listings')
      setListings(result.listings ?? [])
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not load listings',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadListings()
  }, [])

  async function moderate(listing: Listing) {
    const action =
      listing.moderation_status === 'removed' ? 'restore' : 'remove'
    const reason = window.prompt(
      `${action === 'remove' ? 'Reason for removal' : 'Reason for restoration'} (minimum 5 characters):`,
    )
    if (!reason?.trim() || reason.trim().length < 5) return
    setSaving(listing.id)
    try {
      const response = await fetch('/api/admin/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: listing.id, action, reason: reason.trim() }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not moderate listing')
      toast.success(
        action === 'remove'
          ? 'Listing removed from customer surfaces'
          : 'Listing restored',
      )
      await loadListings()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not moderate listing',
      )
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl bg-char p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Meal listings</h1>
          <p className="mt-1 text-sm text-mist">
            Soft removal preserves records and moderation history.
          </p>
        </div>
        <button
          onClick={loadListings}
          disabled={loading}
          aria-label="Refresh listings"
          className="rounded-lg border border-white/10 p-2 text-white hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>
      {loading ? (
        <p className="py-10 text-sm text-mist">Loading listings...</p>
      ) : (
        <div className="divide-y divide-white/10 border-y border-white/10">
          {listings.map((listing) => (
            <article
              key={listing.id}
              className="flex flex-wrap items-center gap-4 py-4"
            >
              {listing.image_url ? (
                <img
                  src={listing.image_url}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/5">
                  <ShieldAlert className="h-5 w-5 text-mist" />
                </div>
              )}
              <div className="min-w-52 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-white">{listing.title}</h2>
                  <span
                    className={`rounded px-2 py-0.5 text-xs capitalize ${listing.moderation_status === 'removed' ? 'bg-red-500/10 text-red-300' : 'bg-emerald-500/10 text-emerald-300'}`}
                  >
                    {listing.moderation_status}
                  </span>
                </div>
                <p className="text-sm text-mist">
                  {listing.cook?.full_name ?? 'Cook'} · NGN{' '}
                  {Number(listing.price).toLocaleString()} · Available until{' '}
                  {new Date(listing.available_until).toLocaleString()}
                </p>
                {listing.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-white/50">
                    {listing.description}
                  </p>
                )}
                {listing.moderation_reason && (
                  <p className="mt-1 text-xs text-amber-300">
                    Last moderation reason: {listing.moderation_reason}
                  </p>
                )}
              </div>
              <button
                onClick={() => moderate(listing)}
                disabled={saving === listing.id}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/5 disabled:opacity-50"
              >
                {saving === listing.id
                  ? 'Saving...'
                  : listing.moderation_status === 'removed'
                    ? 'Restore'
                    : 'Remove listing'}
              </button>
            </article>
          ))}
          {!listings.length && (
            <p className="py-10 text-center text-mist">
              No meal listings found.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
