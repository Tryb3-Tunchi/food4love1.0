'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Search,
  Trash2,
  Heart,
  Loader2,
  Users,
  MessageCircle,
  Plus,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface MatchRow {
  id: string
  user1_id: string
  user2_id: string
  status: string
  created_at: string
  expires_at: string
  user1: { full_name: string; avatar_url: string | null; role: string }
  user2: { full_name: string; avatar_url: string | null; role: string }
}

interface MatchCandidate {
  id: string
  full_name: string
  role: 'cook' | 'buyer'
  suspended: boolean
  kyc_status: 'unverified' | 'pending' | 'verified' | 'rejected'
}

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [filtered, setFiltered] = useState<MatchRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<MatchCandidate[]>([])
  const [buyerId, setBuyerId] = useState('')
  const [cookId, setCookId] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchMatches()
  }, [])

  useEffect(() => {
    const term = search.toLowerCase()
    setFiltered(
      matches.filter(
        (m) =>
          m.user1.full_name.toLowerCase().includes(term) ||
          m.user2.full_name.toLowerCase().includes(term) ||
          m.status.toLowerCase().includes(term),
      ),
    )
  }, [search, matches])

  async function fetchMatches() {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/matches', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Failed to load matches')
      setMatches(result.matches ?? [])
      setFiltered(result.matches ?? [])
      setProfiles(result.profiles ?? [])
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to load matches',
      )
    }
    setLoading(false)
  }

  async function unmatch(id: string) {
    const reason = window.prompt('Reason for unmatching:')
    if (!reason?.trim()) return
    setDeleting(id)
    try {
      const response = await fetch('/api/admin/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unmatch',
          match_id: id,
          reason: reason.trim(),
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not unmatch users')
      toast.success('Users unmatched; chat history retained')
      await fetchMatches()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not unmatch users',
      )
    }
    setDeleting(null)
  }

  async function createMatch() {
    if (!buyerId || !cookId) {
      toast.error('Choose one buyer and one cook')
      return
    }
    const reason = window.prompt('Reason for creating this match:')
    if (!reason?.trim()) return
    setCreating(true)
    try {
      const response = await fetch('/api/admin/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          user1_id: buyerId,
          user2_id: cookId,
          reason: reason.trim(),
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || 'Could not create match')
      toast.success('Match created')
      setBuyerId('')
      setCookId('')
      await fetchMatches()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not create match',
      )
    }
    setCreating(false)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-1)]">
              Match Management
            </h1>
            <p className="mt-1 text-sm text-[var(--text-3)]">
              View, search, and moderate user matches
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">
            <Users className="h-4 w-4" />
            {matches.length} matches
          </div>
        </div>

        <section className="mb-6 flex flex-wrap items-end gap-3 border-b border-[var(--border)] pb-6">
          <label className="min-w-52 flex-1 text-xs font-medium text-[var(--text-2)]">
            Buyer
            <select
              value={buyerId}
              onChange={(event) => setBuyerId(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--text-1)]"
            >
              <option value="">Select buyer</option>
              {profiles
                .filter((profile) => profile.role === 'buyer')
                .map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </option>
                ))}
            </select>
          </label>
          <label className="min-w-52 flex-1 text-xs font-medium text-[var(--text-2)]">
            Cook
            <select
              value={cookId}
              onChange={(event) => setCookId(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-[var(--text-1)]"
            >
              <option value="">Select cook</option>
              {profiles
                .filter((profile) => profile.role === 'cook')
                .map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name} · {profile.kyc_status}
                  </option>
                ))}
            </select>
          </label>
          <button
            onClick={createMatch}
            disabled={creating}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create match
          </button>
        </section>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-3)]" />
          <input
            type="text"
            placeholder="Search by name or status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)] py-3 pl-10 pr-4 text-sm text-[var(--text-1)] outline-none transition placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--accent)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]">
            <Heart className="mb-3 h-10 w-10 text-[var(--text-3)] opacity-40" />
            <p className="text-[var(--text-2)]">No matches found</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-strong)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-2)]">
                    <th className="px-4 py-3 font-semibold text-[var(--text-2)]">
                      Users
                    </th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-2)]">
                      Status
                    </th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-2)]">
                      Created
                    </th>
                    <th className="px-4 py-3 font-semibold text-[var(--text-2)]">
                      Expires
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-[var(--text-2)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((match, i) => (
                    <motion.tr
                      key={match.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-[var(--bg-2)]/50 border-b border-[var(--border)] transition-colors last:border-0"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)] ring-2 ring-[var(--bg)]">
                              {match.user1.full_name.charAt(0)}
                            </div>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--theme-soft)] text-xs font-bold text-[var(--theme-lead)] ring-2 ring-[var(--bg)]">
                              {match.user2.full_name.charAt(0)}
                            </div>
                          </div>
                          <div>
                            <p className="font-medium text-[var(--text-1)]">
                              {match.user1.full_name} & {match.user2.full_name}
                            </p>
                            <p className="text-xs text-[var(--text-3)]">
                              {match.user1.role} + {match.user2.role}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                            match.status === 'matched'
                              ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                              : match.status === 'expired'
                                ? 'bg-[var(--surface-muted)] text-[var(--text-3)]'
                                : 'bg-[var(--theme-soft)] text-[var(--theme-lead)]'
                          }`}
                        >
                          {match.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-2)]">
                        {new Date(match.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-2)]">
                        {new Date(match.expires_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/messages?match_id=${match.id}`}
                            className="rounded-lg bg-[var(--bg-2)] p-2 text-[var(--text-2)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => unmatch(match.id)}
                            disabled={
                              deleting === match.id ||
                              match.status !== 'matched'
                            }
                            aria-label="Unmatch users and retain chat history"
                            title="Unmatch users and retain chat history"
                            className="rounded-lg bg-[var(--bg-2)] p-2 text-[var(--text-2)] transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                          >
                            {deleting === match.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
