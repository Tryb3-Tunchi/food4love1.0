'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Search,
  Trash2,
  Eye,
  Heart,
  Loader2,
  Users,
  MessageCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [filtered, setFiltered] = useState<MatchRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

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
    const supabase = createClient()
    const { data, error } = await supabase
      .from('matches')
      .select(
        `
        *,
        user1:profiles!matches_user1_id_fkey(full_name, avatar_url, role),
        user2:profiles!matches_user2_id_fkey(full_name, avatar_url, role)
      `,
      )
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Failed to load matches')
    } else {
      setMatches((data as any) ?? [])
      setFiltered((data as any) ?? [])
    }
    setLoading(false)
  }

  async function deleteMatch(id: string) {
    if (!confirm('Delete this match? This cannot be undone.')) return
    setDeleting(id)
    const supabase = createClient()
    const { error } = await supabase.from('matches').delete().eq('id', id)
    if (error) {
      toast.error('Failed to delete match')
    } else {
      toast.success('Match deleted')
      setMatches((prev) => prev.filter((m) => m.id !== id))
    }
    setDeleting(null)
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
                            href={`/chat/${match.id}`}
                            className="rounded-lg bg-[var(--bg-2)] p-2 text-[var(--text-2)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => deleteMatch(match.id)}
                            disabled={deleting === match.id}
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
